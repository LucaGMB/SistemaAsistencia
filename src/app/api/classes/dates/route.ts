import { NextResponse } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import { addDays, classDayForDateStr, nowInSchoolTZ } from "@/lib/schedule";

/**
 * Últimas fechas de clase (de la más reciente hacia atrás), para poblar el
 * selector de la vista por clase sin que el profesor tenga que recordar qué
 * días cayeron martes, jueves o viernes.
 */
export async function GET(req: Request) {
  const { error } = await requireSession(["PROFESOR", "ADMIN"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 12), 1), 60);

  const today = nowInSchoolTZ().dateStr;
  const dates: { date: string; dayOfWeek: string }[] = [];

  // Se recorre hacia atrás desde hoy. El tope de 400 días evita cualquier
  // riesgo de bucle infinito si el cronograma quedara vacío.
  let cursor = today;
  for (let i = 0; i < 400 && dates.length < limit; i++) {
    if (cursor < "2026-09-01") break;
    const classDay = classDayForDateStr(cursor);
    if (classDay) dates.push({ date: cursor, dayOfWeek: classDay.dayOfWeek });
    cursor = addDays(cursor, -1);
  }

  return NextResponse.json({ dates });
}
