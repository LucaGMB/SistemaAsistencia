import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { classDayForDateStr } from "@/lib/schedule";
import { fetchArgentineHolidays } from "@/lib/holidays";
import { formatDateDMY } from "@/lib/dateFormat";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  const { session, error } = await requireSession(["PROFESOR", "ADMIN"]);
  if (error) return error;

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
          cancelledById: session!.user.id,
        },
      });
      createdCount++;
      synced.push(`${formatDateDMY(h.date)} (${h.name})`);
    }
  }

  if (createdCount > 0) {
    await logAudit({
      actorId: session!.user.id,
      action: "HOLIDAYS_SYNCED",
      details: `Sincronizados ${createdCount} feriados oficiales como clases anuladas: ${synced.join(", ")}`,
    });
  }

  return NextResponse.json({
    ok: true,
    totalHolidaysFound: classHolidays.length,
    newlyCancelled: createdCount,
    synced,
  });
}
