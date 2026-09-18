import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { getCancelledDates, sumCreditedHours } from "@/lib/hours";

/**
 * Datos de un alumno concreto con su historial y total de horas.
 *
 * Existe para que las vistas de detalle no tengan que pedir el listado
 * completo (/api/admin/users, que trae los 26 alumnos con todas sus
 * asistencias) solo para mostrar un nombre.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { error } = await requireSession(["PROFESOR", "ADMIN"]);
  if (error) return error;

  const [student, cancelledDates] = await Promise.all([
    prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        dni: true,
        nombre: true,
        apellido: true,
        role: true,
        active: true,
        attendances: {
          orderBy: { date: "desc" },
          select: { id: true, date: true, dayOfWeek: true, hours: true, source: true, note: true },
        },
      },
    }),
    getCancelledDates(),
  ]);

  if (!student || student.role !== "ALUMNO") {
    return NextResponse.json({ error: "Alumno no encontrado." }, { status: 404 });
  }

  const { attendances, ...info } = student;

  return NextResponse.json({
    student: info,
    attendances: attendances.map((a) => ({ ...a, cancelled: cancelledDates.has(a.date) })),
    totalHours: sumCreditedHours(attendances, cancelledDates),
  });
}
