import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { classDayForDateStr } from "@/lib/schedule";
import { getCancelledDates, calculateInternshipHours } from "@/lib/hours";
import { buildCsv, csvHeaders } from "@/lib/csv";
import { logAudit } from "@/lib/audit";

/** "2026-09-08" -> "2026-09-08 21:10" usando el horario de inicio de esa clase. */
function fechaYHora(date: string): string {
  const classDay = classDayForDateStr(date);
  return classDay ? `${date} ${classDay.start}` : date;
}

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

/**
 * Exporta el reporte de horas en CSV.
 *
 * - Alumno: solo su propio reporte.
 * - Profesor / admin: el de un alumno concreto (?studentId=) o el
 *   consolidado de todos (?scope=all).
 *
 * Las asistencias de clases anuladas no se exportan, porque no acreditan horas.
 */
export async function GET(req: Request) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope");
  const queryStudentId = searchParams.get("studentId");
  const isStaff = session!.user.role === "PROFESOR" || session!.user.role === "ADMIN";

  const cancelledDates = await getCancelledDates();

  // --- Consolidado de todos los alumnos (solo profesor/admin) ---
  if (scope === "all") {
    if (!isStaff) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const students = await prisma.user.findMany({
      where: { role: "ALUMNO" },
      orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
      select: {
        dni: true,
        nombre: true,
        apellido: true,
        attendances: { orderBy: { date: "asc" }, select: { date: true, hours: true } },
        hourConcepts: {
          orderBy: { date: "asc" },
          select: { category: true, title: true, institution: true, hours: true, date: true },
        },
        internships: {
          include: { exceptions: { select: { date: true } } },
        },
      },
    });

    const rows: (string | number)[][] = [];
    for (const s of students) {
      const studentName = `${s.apellido}, ${s.nombre}`;
      // 1. Clases presenciales
      for (const a of s.attendances) {
        if (cancelledDates.has(a.date)) continue;
        rows.push([studentName, s.dni, "Clase presencial", fechaYHora(a.date), a.hours]);
      }
      // 2. Conceptos individuales
      for (const c of s.hourConcepts) {
        const detail = `${c.title}${c.institution ? ` (${c.institution})` : ""}`;
        rows.push([studentName, s.dni, `Concepto: ${c.category}`, `${detail}${c.date ? ` [${c.date}]` : ""}`, c.hours]);
      }
      // 3. Pasantías
      for (const intern of s.internships) {
        const calc = calculateInternshipHours(intern);
        if (calc.creditedHours > 0) {
          rows.push([
            studentName,
            s.dni,
            "Pasantía externa",
            `${intern.company} (${intern.startDate} al ${intern.endDate})`,
            calc.creditedHours,
          ]);
        }
      }
    }

    await logAudit({
      actorId: session!.user.id,
      action: "HOURS_EXPORTED",
      details: `Consolidado de todos los alumnos (${rows.length} registros)`,
    });

    const csv = buildCsv(["Alumno", "DNI", "Tipo", "Detalle / Período", "Horas"], rows);
    return new NextResponse(csv, { headers: csvHeaders("horas-todos-los-alumnos.csv") });
  }

  // --- Reporte individual ---
  let studentId = session!.user.id;
  if (queryStudentId && queryStudentId !== session!.user.id) {
    if (!isStaff) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    studentId = queryStudentId;
  }

  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: {
      dni: true,
      nombre: true,
      apellido: true,
      attendances: { orderBy: { date: "asc" }, select: { date: true, hours: true } },
      hourConcepts: {
        orderBy: { date: "asc" },
        select: { category: true, title: true, institution: true, hours: true, date: true },
      },
      internships: {
        include: { exceptions: { select: { date: true } } },
      },
    },
  });
  if (!student) return NextResponse.json({ error: "Alumno no encontrado." }, { status: 404 });

  const rows: (string | number)[][] = [];
  // 1. Clases presenciales
  for (const a of student.attendances) {
    if (cancelledDates.has(a.date)) continue;
    rows.push(["Clase presencial", fechaYHora(a.date), a.hours]);
  }
  // 2. Conceptos individuales
  for (const c of student.hourConcepts) {
    const detail = `${c.title}${c.institution ? ` (${c.institution})` : ""}`;
    rows.push([`Concepto: ${c.category}`, `${detail}${c.date ? ` [${c.date}]` : ""}`, c.hours]);
  }
  // 3. Pasantías
  for (const intern of student.internships) {
    const calc = calculateInternshipHours(intern);
    if (calc.creditedHours > 0) {
      rows.push([
        "Pasantía externa",
        `${intern.company} (${intern.startDate} al ${intern.endDate})`,
        calc.creditedHours,
      ]);
    }
  }

  await logAudit({
    actorId: session!.user.id,
    action: "HOURS_EXPORTED",
    targetId: studentId,
    details: `${rows.length} registros`,
  });

  const csv = buildCsv(["Tipo", "Detalle / Fecha", "Horas"], rows);
  const filename = `horas-${slug(`${student.apellido} ${student.nombre}`)}-${student.dni}.csv`;
  return new NextResponse(csv, { headers: csvHeaders(filename) });
}
