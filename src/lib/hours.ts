import { prisma } from "@/lib/prisma";
import { addDays, nowInSchoolTZ } from "@/lib/schedule";

/**
 * Fechas (YYYY-MM-DD) de clases anuladas. Las asistencias que caen en una de
 * estas fechas no acreditan horas, pero el registro no se borra: si la clase
 * se reactiva, vuelven a contar.
 */
export async function getCancelledDates(): Promise<Set<string>> {
  const cancelled = await prisma.cancelledClass.findMany({ select: { date: true } });
  return new Set(cancelled.map((c) => c.date));
}

export type HourBearing = { date: string; hours: number };

/** Suma de horas acreditadas de clases regulares, descartando las de clases anuladas. */
export function sumCreditedHours(attendances: HourBearing[], cancelledDates: Set<string>): number {
  return attendances.reduce((sum, a) => (cancelledDates.has(a.date) ? sum : sum + a.hours), 0);
}

export const HOUR_CONCEPT_CATEGORIES = [
  { value: "CURSO", label: "Curso" },
  { value: "CAPACITACION", label: "Capacitación / Taller" },
  { value: "OTRO", label: "Otro Concepto" },
] as const;

export type HourConceptCategory = (typeof HOUR_CONCEPT_CATEGORIES)[number]["value"];

export const INTERNSHIP_EXCEPTION_REASONS = [
  "Feriado",
  "Día de estudio",
  "Enfermedad / Certificado",
  "Suspensión de actividades",
  "Otro",
] as const;

export const WEEKDAY_LABELS: Record<string, string> = {
  "1": "Lunes",
  "2": "Martes",
  "3": "Miércoles",
  "4": "Jueves",
  "5": "Viernes",
  "6": "Sábado",
  "0": "Domingo",
};

export type InternshipCalculation = {
  creditedHours: number;
  plannedHours: number;
  deductedHours: number;
  exceptionCount: number;
  daysElapsed: number;
  isOpenEnded?: boolean;
};

/**
 * Calcula las horas de una pasantía:
 * - Para cada día que coincide con el cronograma semanal (weeklySchedule JSON: ej {"1": 4, "3": 4}):
 *   - Suma a plannedHours (si tiene endDate fijado).
 *   - Si el día es <= upToDate (por defecto hoy en horario local escolar):
 *     - Si la fecha está registrada como excepción (feriado, estudio, etc.), se suma a deductedHours.
 *     - Si no, se acredita a creditedHours.
 */
export function calculateInternshipHours(
  internship: {
    startDate: string;
    endDate?: string | null;
    weeklySchedule: string;
    exceptions?: { date: string }[];
  },
  upToDate?: string
): InternshipCalculation {
  const isOpenEnded = !internship.endDate;
  const result: InternshipCalculation = {
    creditedHours: 0,
    plannedHours: 0,
    deductedHours: 0,
    exceptionCount: internship.exceptions?.length || 0,
    daysElapsed: 0,
    isOpenEnded,
  };

  if (!internship.startDate) {
    return result;
  }

  let schedule: Record<string, number> = {};
  try {
    schedule = JSON.parse(internship.weeklySchedule || "{}");
  } catch {
    return result;
  }

  const exceptionDates = new Set((internship.exceptions || []).map((e) => e.date));
  const effectiveUpToDate = upToDate || nowInSchoolTZ().dateStr;
  const finalIterationDate = internship.endDate || effectiveUpToDate;

  if (internship.startDate > finalIterationDate) {
    return result;
  }

  let current = internship.startDate;
  let guard = 0;
  while (current <= finalIterationDate && guard < 1000) {
    guard++;
    const [y, m, d] = current.split("-").map(Number);
    const asUTCNoon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const dayOfWeek = asUTCNoon.getUTCDay().toString();

    const hoursForDay = Number(schedule[dayOfWeek]) || 0;
    if (hoursForDay > 0) {
      if (!isOpenEnded) {
        result.plannedHours += hoursForDay;
      }

      if (current <= effectiveUpToDate) {
        result.daysElapsed++;
        if (exceptionDates.has(current)) {
          result.deductedHours += hoursForDay;
        } else {
          result.creditedHours += hoursForDay;
        }
      }
    }

    current = addDays(current, 1);
  }

  if (isOpenEnded) {
    result.plannedHours = result.creditedHours + result.deductedHours;
  }

  return result;
}

export type HourBreakdown = {
  classHours: number;
  priorHours: number;
  coursesHours: number;
  internshipHours: number;
  total: number;
};

/**
 * Calcula el desglose completo de horas de un alumno sumando:
 * - Horas de clases regulares (sin clases anuladas)
 * - Horas del profesor anterior (previousTeacherHours o conceptos 'PREVIA')
 * - Cursos / capacitaciones / otros conceptos
 * - Horas devengadas de pasantías (descontando excepciones)
 */
export function calculateStudentBreakdown(params: {
  attendances: HourBearing[];
  cancelledDates: Set<string>;
  previousTeacherHours?: number;
  concepts?: { category: string; hours: number }[];
  internships?: {
    startDate: string;
    endDate?: string | null;
    weeklySchedule: string;
    exceptions?: { date: string }[];
  }[];
  upToDate?: string;
}): HourBreakdown {
  const classHours = sumCreditedHours(params.attendances, params.cancelledDates);

  let priorHours = params.previousTeacherHours ?? 0;
  let coursesHours = 0;
  for (const c of params.concepts || []) {
    if (c.category === "PREVIA") {
      priorHours += c.hours;
    } else {
      coursesHours += c.hours;
    }
  }

  let internshipHours = 0;
  for (const intern of params.internships || []) {
    const calc = calculateInternshipHours(intern, params.upToDate);
    internshipHours += calc.creditedHours;
  }

  return {
    classHours,
    priorHours,
    coursesHours,
    internshipHours,
    total: classHours + priorHours + coursesHours + internshipHours,
  };
}
