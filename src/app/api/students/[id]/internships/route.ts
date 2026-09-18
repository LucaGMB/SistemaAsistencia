import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { logAudit } from "@/lib/audit";
import { calculateInternshipHours } from "@/lib/hours";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession();
  if (error) return error;

  const isStaff = session!.user.role === "PROFESOR" || session!.user.role === "ADMIN";
  if (!isStaff && session!.user.id !== params.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const internships = await prisma.internship.findMany({
    where: { studentId: params.id },
    include: {
      exceptions: { orderBy: { date: "desc" } },
    },
    orderBy: { startDate: "desc" },
  });

  const enriched = internships.map((i) => ({
    ...i,
    calculation: calculateInternshipHours(i),
  }));

  return NextResponse.json({ internships: enriched });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession(["PROFESOR", "ADMIN"]);
  if (error) return error;

  const student = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, role: true, nombre: true, apellido: true },
  });

  if (!student || student.role !== "ALUMNO") {
    return NextResponse.json({ error: "Alumno no encontrado." }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const company = String(body?.company ?? "").trim();
  const roleOrTask = body?.roleOrTask ? String(body.roleOrTask).trim() : null;
  const startDate = String(body?.startDate ?? "").trim();
  const endDate = String(body?.endDate ?? "").trim();
  const note = body?.note ? String(body.note).trim() : null;
  const weeklyScheduleInput = body?.weeklySchedule;

  if (!company) {
    return NextResponse.json({ error: "La empresa u organismo es obligatorio." }, { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return NextResponse.json(
      { error: "Las fechas de inicio y fin deben tener formato YYYY-MM-DD." },
      { status: 400 }
    );
  }

  if (startDate > endDate) {
    return NextResponse.json(
      { error: "La fecha de inicio no puede ser posterior a la fecha de fin." },
      { status: 400 }
    );
  }

  let scheduleObj: Record<string, number> = {};
  if (typeof weeklyScheduleInput === "string") {
    try {
      scheduleObj = JSON.parse(weeklyScheduleInput);
    } catch {
      return NextResponse.json({ error: "El cronograma semanal no es válido." }, { status: 400 });
    }
  } else if (typeof weeklyScheduleInput === "object" && weeklyScheduleInput !== null) {
    scheduleObj = weeklyScheduleInput;
  } else {
    return NextResponse.json(
      { error: "Debes configurar los días y horas semanales de la pasantía." },
      { status: 400 }
    );
  }

  // Validar que haya al menos un día con horas > 0
  const validDays = Object.entries(scheduleObj).filter(([day, h]) => {
    const dNum = Number(day);
    return Number.isInteger(dNum) && dNum >= 0 && dNum <= 6 && Number(h) > 0;
  });

  if (validDays.length === 0) {
    return NextResponse.json(
      { error: "Debes asignar horas a por lo menos un día de la semana." },
      { status: 400 }
    );
  }

  const cleanedSchedule: Record<string, number> = {};
  for (const [day, h] of validDays) {
    cleanedSchedule[day] = Number(h);
  }

  const internship = await prisma.internship.create({
    data: {
      studentId: params.id,
      company,
      roleOrTask,
      startDate,
      endDate,
      weeklySchedule: JSON.stringify(cleanedSchedule),
      note,
      createdById: session!.user.id,
    },
    include: { exceptions: true },
  });

  await logAudit({
    actorId: session!.user.id,
    action: "INTERNSHIP_CREATED",
    targetId: params.id,
    details: `Pasantía ${company} (${startDate} a ${endDate}) para ${student.apellido}, ${student.nombre}`,
  });

  return NextResponse.json(
    {
      internship: {
        ...internship,
        calculation: calculateInternshipHours(internship),
      },
    },
    { status: 201 }
  );
}
