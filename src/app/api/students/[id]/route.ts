import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import {
  getCancelledDates,
  calculateStudentBreakdown,
  calculateInternshipHours,
} from "@/lib/hours";
import { getAttendanceStatus } from "@/lib/schedule";

/**
 * Datos de un alumno concreto con su historial, conceptos individuales,
 * pasantías, desglose y total general de horas.
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
        hourConcepts: {
          include: {
            createdBy: {
              select: { id: true, nombre: true, apellido: true, role: true },
            },
          },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        },
        internships: {
          include: {
            exceptions: { orderBy: { date: "desc" } },
            createdBy: {
              select: { id: true, nombre: true, apellido: true, role: true },
            },
          },
          orderBy: { startDate: "desc" },
        },
      },
    }),
    getCancelledDates(),
  ]);

  if (!student || student.role !== "ALUMNO") {
    return NextResponse.json({ error: "Alumno no encontrado." }, { status: 404 });
  }

  const { attendances, hourConcepts, internships, ...info } = student;
  const status = getAttendanceStatus();
  const currentOpenClassDate = status.state === "OPEN" ? status.date : null;

  const breakdown = calculateStudentBreakdown({
    attendances,
    cancelledDates,
    concepts: hourConcepts,
    internships,
  });

  const enrichedInternships = internships.map((i) => ({
    ...i,
    calculation: calculateInternshipHours(i),
  }));

  return NextResponse.json({
    student: info,
    attendances: attendances.map((a) => ({ ...a, cancelled: cancelledDates.has(a.date) })),
    hourConcepts,
    internships: enrichedInternships,
    breakdown,
    totalHours: breakdown.total,
    currentOpenClassDate,
  });
}

