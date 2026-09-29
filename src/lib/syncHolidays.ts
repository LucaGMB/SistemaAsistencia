import { prisma } from "@/lib/prisma";
import { nowInSchoolTZ, classDayForDateStr } from "@/lib/schedule";
import { fetchArgentineHolidays, getHolidaysBetween } from "@/lib/holidays";
import { formatDateDMY } from "@/lib/dateFormat";
import { logAudit } from "@/lib/audit";

export async function syncInternshipHolidays(internshipId: string): Promise<{
  ok: boolean;
  createdCount: number;
  added: string[];
  error?: string;
}> {
  const internship = await prisma.internship.findUnique({
    where: { id: internshipId },
    include: { exceptions: true },
  });

  if (!internship) {
    return { ok: false, createdCount: 0, added: [], error: "Pasantía no encontrada." };
  }

  let schedule: Record<string, number> = {};
  try {
    schedule = JSON.parse(internship.weeklySchedule);
  } catch {
    return { ok: false, createdCount: 0, added: [], error: "Cronograma semanal inválido." };
  }

  const today = nowInSchoolTZ().dateStr;
  const effectiveEnd = internship.endDate && internship.endDate < today ? internship.endDate : today;

  if (internship.startDate > effectiveEnd) {
    return { ok: true, createdCount: 0, added: [] };
  }

  const holidays = await getHolidaysBetween(internship.startDate, effectiveEnd);
  const existingExceptionDates = new Set(internship.exceptions.map((e) => e.date));

  let createdCount = 0;
  const added: string[] = [];

  for (const h of holidays) {
    // Parse date in UTC noon to avoid timezone shifts
    const d = new Date(`${h.date}T12:00:00Z`);
    const dayOfWeek = d.getUTCDay(); // 0..6
    if (schedule[String(dayOfWeek)] && !existingExceptionDates.has(h.date)) {
      await prisma.internshipException.create({
        data: {
          internshipId: internship.id,
          date: h.date,
          reason: "Feriado",
          note: h.name,
        },
      });
      createdCount++;
      added.push(`${formatDateDMY(h.date)} (${h.name})`);
    }
  }

  return {
    ok: true,
    createdCount,
    added,
  };
}

export async function syncClassHolidays(cancelledById?: string): Promise<{
  ok: boolean;
  totalHolidaysFound: number;
  newlyCancelled: number;
  synced: string[];
}> {
  const currentYear = 2026;
  const holidays = await fetchArgentineHolidays(currentYear);

  // Filtrar feriados a partir del 1 de septiembre de 2026 que caigan en día de clase
  const classHolidays = holidays.filter((h) => {
    if (h.date < "2026-09-01") return false;
    const classDay = classDayForDateStr(h.date);
    return classDay !== null;
  });

  let createdCount = 0;
  const synced: string[] = [];

  for (const h of classHolidays) {
    const classDay = classDayForDateStr(h.date)!;
    const existing = await prisma.cancelledClass.findUnique({
      where: { date: h.date },
    });

    if (!existing) {
      await prisma.cancelledClass.create({
        data: {
          date: h.date,
          dayOfWeek: classDay.dayOfWeek,
          reason: `Feriado: ${h.name}`,
          cancelledById: cancelledById ?? null,
        },
      });
      createdCount++;
      synced.push(`${formatDateDMY(h.date)} (${h.name})`);
    }
  }

  if (createdCount > 0) {
    await logAudit({
      actorId: cancelledById ?? null,
      action: "HOLIDAYS_SYNCED",
      details: `Sincronizados ${createdCount} feriados oficiales como clases anuladas: ${synced.join(", ")}`,
    });
  }

  return {
    ok: true,
    totalHolidaysFound: classHolidays.length,
    newlyCancelled: createdCount,
    synced,
  };
}
