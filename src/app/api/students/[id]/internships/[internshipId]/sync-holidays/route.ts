import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { nowInSchoolTZ } from "@/lib/schedule";
import { getHolidaysBetween } from "@/lib/holidays";

export async function POST(
  req: Request,
  { params }: { params: { id: string; internshipId: string } }
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const isStaff = session!.user.role === "PROFESOR" || session!.user.role === "ADMIN";
  if (!isStaff && session!.user.id !== params.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const internship = await prisma.internship.findUnique({
    where: { id: params.internshipId },
    include: { exceptions: true },
  });

  if (!internship || internship.studentId !== params.id) {
    return NextResponse.json({ error: "Pasantía no encontrada." }, { status: 404 });
  }

  let schedule: Record<string, number> = {};
  try {
    schedule = JSON.parse(internship.weeklySchedule);
  } catch {
    return NextResponse.json({ error: "Cronograma semanal inválido." }, { status: 400 });
  }

  const today = nowInSchoolTZ().dateStr;
  const effectiveEnd = internship.endDate && internship.endDate < today ? internship.endDate : today;

  if (internship.startDate > effectiveEnd) {
    return NextResponse.json({ ok: true, createdCount: 0, message: "La pasantía aún no ha comenzado." });
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
      added.push(`${h.date} (${h.name})`);
    }
  }

  return NextResponse.json({
    ok: true,
    createdCount,
    added,
  });
}
