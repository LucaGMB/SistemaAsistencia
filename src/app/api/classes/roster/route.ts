import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { classDayForDateStr, nowInSchoolTZ, getAttendanceStatus } from "@/lib/schedule";

/**
 * Quiénes asistieron a la clase de una fecha y quiénes no.
 *
 * Es la consulta natural de quien toma asistencia en el aula, que antes
 * solo se podía responder mirando alumno por alumno.
 */
export async function GET(req: Request) {
  const { error } = await requireSession(["PROFESOR", "ADMIN"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? "";

  const classDay = classDayForDateStr(date);
  if (!classDay) {
    return NextResponse.json(
      { error: "Esa fecha no corresponde a un día de clase (martes, jueves o viernes)." },
      { status: 400 }
    );
  }

  const [students, attendances, cancelled] = await Promise.all([
    prisma.user.findMany({
      where: { role: "ALUMNO", active: true },
      orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
      select: { id: true, dni: true, nombre: true, apellido: true },
    }),
    prisma.attendance.findMany({
      where: { date },
      select: { studentId: true, hours: true, source: true },
    }),
    prisma.cancelledClass.findUnique({ where: { date } }),
  ]);

  const byStudent = new Map(attendances.map((a) => [a.studentId, a]));
  const today = nowInSchoolTZ();

  const roster = students.map((s) => {
    const att = byStudent.get(s.id);
    return {
      ...s,
      attended: !!att,
      hours: att?.hours ?? 0,
      source: att?.source ?? null,
    };
  });

  const presentes = roster.filter((r) => r.attended).length;
  const status = getAttendanceStatus();
  const isOpen = status.state === "OPEN" && status.date === date;

  return NextResponse.json({
    date,
    dayOfWeek: classDay.dayOfWeek,
    start: classDay.start,
    end: classDay.end,
    cancelled: !!cancelled,
    reason: cancelled?.reason ?? null,
    isFuture: date > today.dateStr,
    isOpen,
    presentes,
    ausentes: roster.length - presentes,
    total: roster.length,
    roster,
  });
}
