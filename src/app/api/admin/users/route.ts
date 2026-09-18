import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { logAudit } from "@/lib/audit";
import { Role } from "@/lib/roles";
import { getCancelledDates, calculateStudentBreakdown } from "@/lib/hours";

export async function GET() {
  const { session, error } = await requireSession(["ADMIN", "PROFESOR"]);
  if (error) return error;

  // El profesor solo puede ver alumnos: las cuentas administrativas no se
  // exponen en su respuesta (ni en la UI ni en el tráfico de red).
  const where = session!.user.role === "PROFESOR" ? { role: "ALUMNO" } : {};

  const users = await prisma.user.findMany({
    where,
    orderBy: [{ role: "asc" }, { apellido: "asc" }, { nombre: "asc" }],
    select: {
      id: true,
      dni: true,
      nombre: true,
      apellido: true,
      role: true,
      active: true,
      previousTeacherHours: true,
      previousTeacherHoursLocked: true,
      createdAt: true,
      attendances: { select: { date: true, hours: true } },
      hourConcepts: { select: { category: true, hours: true } },
      internships: {
        select: {
          startDate: true,
          endDate: true,
          weeklySchedule: true,
          exceptions: { select: { date: true } },
        },
      },
    },
  });

  const cancelledDates = await getCancelledDates();

  const withTotals = users.map((u) => {
    const breakdown = calculateStudentBreakdown({
      attendances: u.attendances,
      cancelledDates,
      previousTeacherHours: u.previousTeacherHours,
      concepts: u.hourConcepts,
      internships: u.internships,
    });
    return {
      id: u.id,
      dni: u.dni,
      nombre: u.nombre,
      apellido: u.apellido,
      role: u.role,
      active: u.active,
      createdAt: u.createdAt,
      totalHours: breakdown.total,
      breakdown,
      // Solo se cuentan las asistencias que efectivamente acreditan horas.
      totalAttendances: u.attendances.filter((a) => !cancelledDates.has(a.date)).length,
    };
  });

  return NextResponse.json({ users: withTotals });
}

export async function POST(req: Request) {
  const { session, error } = await requireSession(["ADMIN"]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const dni = String(body?.dni ?? "").trim();
  const nombre = String(body?.nombre ?? "").trim();
  const apellido = String(body?.apellido ?? "").trim();
  const password = String(body?.password ?? "");
  const role: Role = body?.role === "PROFESOR" || body?.role === "ADMIN" ? body.role : "ALUMNO";

  if (!dni || !nombre || !apellido || password.length < 4) {
    return NextResponse.json(
      { error: "Completá DNI, nombre, apellido y una contraseña de al menos 4 caracteres." },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { dni } });
  if (existing) {
    return NextResponse.json({ error: "Ya existe un usuario con ese DNI." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { dni, nombre, apellido, passwordHash, role },
  });

  await logAudit({
    actorId: session!.user.id,
    action: "USER_CREATED",
    targetId: user.id,
    details: `DNI ${dni} - rol ${role}`,
  });

  return NextResponse.json({ user: { id: user.id, dni: user.dni } });
}
