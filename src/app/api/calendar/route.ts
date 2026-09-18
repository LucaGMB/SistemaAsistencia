import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import {
  addDays,
  classesInWeek,
  mondayOfWeek,
  nowInSchoolTZ,
  toMinutesOfDay,
  getCalendarBounds,
} from "@/lib/schedule";

export type CalendarDayState =
  | "CANCELADA"
  | "PRESENTE"
  | "AUSENTE"
  | "EN_CURSO"
  | "PROXIMA";

/**
 * Semana de cursada del alumno: qué clases tiene, cuáles ya cursó y cuáles
 * se vienen. `week` es cualquier fecha YYYY-MM-DD dentro de la semana
 * buscada (por defecto, hoy).
 */
export async function GET(req: Request) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const requested = searchParams.get("week");
  const today = nowInSchoolTZ();

  const reference = /^\d{4}-\d{2}-\d{2}$/.test(requested ?? "") ? requested! : today.dateStr;
  const bounds = getCalendarBounds();
  let monday = mondayOfWeek(reference);

  // Clampear la semana dentro del rango permitido
  if (monday < bounds.minMonday) {
    monday = bounds.minMonday;
  } else if (monday > bounds.maxMonday) {
    monday = bounds.maxMonday;
  }

  const canPrev = monday > bounds.minMonday;
  const canNext = monday < bounds.maxMonday;

  const classes = classesInWeek(monday);
  const dates = classes.map((c) => c.date);

  // El alumno consulta su propia semana; profesor/admin pueden mirar la de
  // un alumno concreto pasando ?studentId=.
  const queryStudentId = searchParams.get("studentId");
  let studentId = session!.user.id;
  if (queryStudentId && queryStudentId !== session!.user.id) {
    if (session!.user.role === "ALUMNO") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    studentId = queryStudentId;
  }

  const [cancelled, attendances] = await Promise.all([
    prisma.cancelledClass.findMany({
      where: { date: { in: dates } },
      select: { date: true, reason: true },
    }),
    prisma.attendance.findMany({
      where: { studentId, date: { in: dates } },
      select: { date: true, hours: true },
    }),
  ]);

  const cancelledByDate = new Map(cancelled.map((c) => [c.date, c.reason]));
  const attendanceByDate = new Map(attendances.map((a) => [a.date, a.hours]));

  const days = classes.map((c) => {
    const isCancelled = cancelledByDate.has(c.date);
    const attendedHours = attendanceByDate.get(c.date);

    let state: CalendarDayState;
    if (isCancelled) {
      state = "CANCELADA";
    } else if (attendedHours !== undefined) {
      state = "PRESENTE";
    } else if (c.date > today.dateStr) {
      state = "PROXIMA";
    } else if (c.date < today.dateStr) {
      state = "AUSENTE";
    } else {
      // Es hoy y no la registró todavía: depende del horario.
      const endMin = toMinutesOfDay(c.end);
      state = today.minutesOfDay > endMin ? "AUSENTE" : "EN_CURSO";
    }

    return {
      ...c,
      state,
      isToday: c.date === today.dateStr,
      reason: cancelledByDate.get(c.date) ?? null,
      creditedHours: isCancelled ? 0 : attendedHours ?? 0,
    };
  });

  return NextResponse.json({
    monday,
    sunday: addDays(monday, 6),
    isCurrentWeek: monday === mondayOfWeek(today.dateStr),
    today: today.dateStr,
    canPrev,
    canNext,
    days,
  });
}
