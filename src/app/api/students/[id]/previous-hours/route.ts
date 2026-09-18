import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { logAudit } from "@/lib/audit";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const isStaff = session!.user.role === "PROFESOR" || session!.user.role === "ADMIN";
  const isSelf = session!.user.id === params.id;

  if (!isStaff && !isSelf) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, role: true, previousTeacherHours: true, previousTeacherHoursLocked: true },
  });

  if (!user || user.role !== "ALUMNO") {
    return NextResponse.json({ error: "Alumno no encontrado." }, { status: 404 });
  }

  if (!isStaff && user.previousTeacherHoursLocked) {
    return NextResponse.json(
      { error: "Las horas del profesor anterior ya fueron guardadas y no pueden modificarse. Consultá con tu docente o administrador." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const hours = parseInt(body?.hours, 10);

  if (isNaN(hours) || hours < 0) {
    return NextResponse.json({ error: "La cantidad de horas debe ser un número entero mayor o igual a 0." }, { status: 400 });
  }

  const updatedUser = await prisma.user.update({
    where: { id: params.id },
    data: {
      previousTeacherHours: hours,
      previousTeacherHoursLocked: true, // Una vez guardado por el alumno o docente queda bloqueado para el alumno
    },
    select: {
      id: true,
      previousTeacherHours: true,
      previousTeacherHoursLocked: true,
    },
  });

  await logAudit({
    actorId: session!.user.id,
    action: isStaff ? "PREVIOUS_HOURS_TEACHER_UPDATE" : "PREVIOUS_HOURS_STUDENT_SET",
    targetId: params.id,
    details: `${hours}hs acreditadas del profesor anterior`,
  });

  return NextResponse.json({ ok: true, user: updatedUser });
}
