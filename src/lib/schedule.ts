/**
 * Horarios semanales de la materia "Practicas Profesionalizantes".
 * Cada clase se divide en modulos de 30 minutos; cada modulo registrado
 * equivale a 1 hora acreditada (ej: 1:30hs reales = 3 modulos = 3hs).
 *
 * getDay(): 0=Domingo, 1=Lunes, 2=Martes, 3=Miercoles, 4=Jueves, 5=Viernes, 6=Sabado
 */

export const TIME_ZONE = "America/Argentina/Buenos_Aires";
const MODULE_MINUTES = 30;

export type ClassWindow = {
  dayOfWeek: string;
  start: string; // "HH:MM"
  end: string; // "HH:MM"
};

export const WEEKLY_SCHEDULE: Record<number, ClassWindow> = {
  2: { dayOfWeek: "Martes", start: "21:10", end: "22:40" },
  4: { dayOfWeek: "Jueves", start: "18:00", end: "19:30" },
  5: { dayOfWeek: "Viernes", start: "20:40", end: "22:10" },
};

function hoursForWindow(win: ClassWindow): number {
  const [sh, sm] = win.start.split(":").map(Number);
  const [eh, em] = win.end.split(":").map(Number);
  const minutes = eh * 60 + em - (sh * 60 + sm);
  return Math.round(minutes / MODULE_MINUTES);
}

/** Devuelve las partes de fecha/hora "actuales" en la zona horaria del colegio. */
export function nowInSchoolTZ(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(now);

  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;

  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    map.weekday
  );

  return {
    dateStr: `${map.year}-${map.month}-${map.day}`, // YYYY-MM-DD
    hour: Number(map.hour),
    minute: Number(map.minute),
    weekday: weekdayIndex, // 0=Domingo ... 6=Sabado
    minutesOfDay: Number(map.hour) * 60 + Number(map.minute),
  };
}

/** "21:10" -> 1270 (minutos desde la medianoche). */
export function toMinutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

const toMinutes = toMinutesOfDay;

/** Info de la clase (si la hay) correspondiente a la fecha dada, sin importar la hora. */
export function classWindowForDate(date: Date = new Date()) {
  const { weekday, dateStr } = nowInSchoolTZ(date);
  const win = WEEKLY_SCHEDULE[weekday];
  if (!win) return null;
  return {
    ...win,
    date: dateStr,
    hours: hoursForWindow(win),
  };
}

/**
 * Info de la clase que corresponde a una fecha YYYY-MM-DD cualquiera, sea
 * pasada o futura. Devuelve null si esa fecha no es dia de clase.
 * Se usa para anular/reactivar clases (que si admite fechas futuras).
 */
export function classDayForDateStr(dateStr: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  // Se parsea como mediodia UTC para que el dia de la semana no se corra por TZ.
  const asUTCNoon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  if (Number.isNaN(asUTCNoon.getTime())) return null;
  const win = WEEKLY_SCHEDULE[asUTCNoon.getUTCDay()];
  if (!win) return null;
  return { ...win, date: dateStr, hours: hoursForWindow(win) };
}

export type AttendanceStatus =
  | { state: "NO_CLASS_TODAY" }
  | { state: "CANCELLED"; dayOfWeek: string; start: string; end: string; reason: string | null }
  | { state: "NOT_STARTED"; dayOfWeek: string; start: string; end: string; hours: number }
  | { state: "OPEN"; dayOfWeek: string; start: string; end: string; hours: number; date: string }
  | { state: "CLOSED"; dayOfWeek: string; start: string; end: string; hours: number };

/**
 * Determina si hoy corresponde clase y si la ventana de registro esta
 * abierta. La ventana se abre cuando comienza la clase y se cierra
 * cuando termina el modulo horario de ese dia.
 */
export function getAttendanceStatus(now: Date = new Date()): AttendanceStatus {
  const { weekday, minutesOfDay } = nowInSchoolTZ(now);
  const win = WEEKLY_SCHEDULE[weekday];
  if (!win) return { state: "NO_CLASS_TODAY" };

  const startMin = toMinutes(win.start);
  const endMin = toMinutes(win.end);
  const hours = hoursForWindow(win);

  if (minutesOfDay < startMin) {
    return { state: "NOT_STARTED", dayOfWeek: win.dayOfWeek, start: win.start, end: win.end, hours };
  }
  if (minutesOfDay > endMin) {
    return { state: "CLOSED", dayOfWeek: win.dayOfWeek, start: win.start, end: win.end, hours };
  }
  const { dateStr } = nowInSchoolTZ(now);
  return {
    state: "OPEN",
    dayOfWeek: win.dayOfWeek,
    start: win.start,
    end: win.end,
    hours,
    date: dateStr,
  };
}

export const CALENDAR_MIN_DATE = "2026-09-01";
export const CALENDAR_MIN_MONDAY = "2026-08-31";

/**
 * Valida que una fecha (YYYY-MM-DD) sea un dia de clase valido y que ya
 * haya sucedido (esta en el pasado, o es hoy y la ventana ya cerro/esta
 * abierta). Se usa para permitir al admin/profesor cargar/editar asistencias.
 * No permite fechas previas al 1 de septiembre de 2026, ni fechas futuras,
 * ni el "NOT_STARTED" de hoy.
 */
export function isPastOrCurrentClassDate(dateStr: string, now: Date = new Date()) {
  if (dateStr < CALENDAR_MIN_DATE) {
    return { ok: false as const, reason: "BEFORE_MIN_DATE" as const };
  }

  const today = nowInSchoolTZ(now);
  if (dateStr > today.dateStr) return { ok: false as const, reason: "FUTURE_DATE" as const };

  // Reconstruimos el dia de la semana a partir del string de fecha (evita líos de TZ
  // parseando como mediodia UTC).
  const [y, m, d] = dateStr.split("-").map(Number);
  const asUTCNoon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const weekday = asUTCNoon.getUTCDay();
  const win = WEEKLY_SCHEDULE[weekday];
  if (!win) return { ok: false as const, reason: "NOT_CLASS_DAY" as const };

  if (dateStr === today.dateStr) {
    const startMin = toMinutes(win.start);
    if (today.minutesOfDay < startMin) {
      return { ok: false as const, reason: "FUTURE_DATE" as const };
    }
  }

  return { ok: true as const, dayOfWeek: win.dayOfWeek, maxHours: hoursForWindow(win) };
}

// ---------------------------------------------------------------------------
// Helpers de fechas para la vista de calendario.
//
// Se opera siempre sobre strings YYYY-MM-DD parseados como mediodia UTC: asi
// el dia de la semana y los corrimientos nunca se desplazan por huso horario
// ni por horario de verano.
// ---------------------------------------------------------------------------

function parseDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

function formatDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Suma (o resta, con n negativo) dias a una fecha YYYY-MM-DD. */
export function addDays(dateStr: string, n: number): string {
  const d = parseDateStr(dateStr);
  d.setUTCDate(d.getUTCDate() + n);
  return formatDateStr(d);
}

/** Lunes de la semana a la que pertenece la fecha dada. */
export function mondayOfWeek(dateStr: string): string {
  const d = parseDateStr(dateStr);
  // getUTCDay(): 0=Domingo. Se normaliza para que la semana arranque el lunes.
  const offset = (d.getUTCDay() + 6) % 7;
  return addDays(dateStr, -offset);
}

export type CalendarClass = {
  date: string;
  dayOfWeek: string;
  start: string;
  end: string;
  hours: number;
};

/** Clases que corresponden a la semana que empieza en el lunes dado. */
export function classesInWeek(mondayStr: string): CalendarClass[] {
  const classes: CalendarClass[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(mondayStr, i);
    const classDay = classDayForDateStr(date);
    if (classDay) {
      classes.push({
        date,
        dayOfWeek: classDay.dayOfWeek,
        start: classDay.start,
        end: classDay.end,
        hours: classDay.hours,
      });
    }
  }
  return classes;
}

/**
 * Límites de navegación del calendario semanal:
 * - Mínimo: Lunes de la semana del 1 de septiembre de 2026 (2026-08-31)
 * - Máximo: 2 semanas hacia adelante desde la semana actual
 */
export function getCalendarBounds(now: Date = new Date()) {
  const today = nowInSchoolTZ(now);
  const currentMonday = mondayOfWeek(today.dateStr);
  const maxMonday = addDays(currentMonday, 14); // 2 semanas posteriores
  return {
    minMonday: CALENDAR_MIN_MONDAY,
    maxMonday,
    currentMonday,
  };
}
