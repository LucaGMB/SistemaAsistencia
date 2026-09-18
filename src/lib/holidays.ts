export type ArgentineHoliday = {
  date: string; // YYYY-MM-DD
  name: string;
  type: string;
};

const holidaysCache: Record<number, ArgentineHoliday[]> = {};

/**
 * Consulta los feriados nacionales oficiales de Argentina para un año determinado.
 * Utiliza api.argentinadatos.com con fallback a date.nager.at y respaldo estático.
 */
export async function fetchArgentineHolidays(year: number): Promise<ArgentineHoliday[]> {
  if (holidaysCache[year]) return holidaysCache[year];

  try {
    const res = await fetch(`https://api.argentinadatos.com/v1/feriados/${year}`);
    if (res.ok) {
      const data = await res.json();
      const list: ArgentineHoliday[] = data.map((item: { fecha: string; nombre: string; tipo?: string }) => ({
        date: item.fecha,
        name: item.nombre,
        type: item.tipo || "feriado",
      }));
      if (list.length > 0) {
        holidaysCache[year] = list;
        return list;
      }
    }
  } catch (err) {
    console.error("[holidays] Error fetching from argentinadatos:", err);
  }

  try {
    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/AR`);
    if (res.ok) {
      const data = await res.json();
      const list: ArgentineHoliday[] = data.map((item: { date: string; localName?: string; name: string }) => ({
        date: item.date,
        name: item.localName || item.name,
        type: "feriado",
      }));
      if (list.length > 0) {
        holidaysCache[year] = list;
        return list;
      }
    }
  } catch (err) {
    console.error("[holidays] Error fetching from nager.date fallback:", err);
  }

  // Respaldo estático para 2026
  if (year === 2026) {
    const fallbackList: ArgentineHoliday[] = [
      { date: "2026-01-01", name: "Año nuevo", type: "inamovible" },
      { date: "2026-02-16", name: "Carnaval", type: "inamovible" },
      { date: "2026-02-17", name: "Carnaval", type: "inamovible" },
      { date: "2026-03-23", name: "Puente turístico no laborable", type: "puente" },
      { date: "2026-03-24", name: "Día Nacional de la Memoria por la Verdad y la Justicia", type: "inamovible" },
      { date: "2026-04-02", name: "Día del Veterano y de los Caídos en la Guerra de Malvinas", type: "inamovible" },
      { date: "2026-04-03", name: "Viernes Santo", type: "inamovible" },
      { date: "2026-05-01", name: "Día del Trabajador", type: "inamovible" },
      { date: "2026-05-25", name: "Día de la Revolución de Mayo", type: "inamovible" },
      { date: "2026-06-15", name: "Paso a la Inmortalidad del Gral. Don Martín Miguel de Güemes", type: "trasladable" },
      { date: "2026-06-20", name: "Paso a la Inmortalidad del Gral. Manuel Belgrano", type: "inamovible" },
      { date: "2026-07-09", name: "Día de la Independencia", type: "inamovible" },
      { date: "2026-07-10", name: "Puente turístico no laborable", type: "puente" },
      { date: "2026-08-17", name: "Paso a la Inmortalidad del Gral. José de San Martín", type: "trasladable" },
      { date: "2026-10-12", name: "Día del Respeto a la Diversidad Cultural", type: "trasladable" },
      { date: "2026-11-23", name: "Día de la Soberanía Nacional (20/11)", type: "trasladable" },
      { date: "2026-12-07", name: "Puente turístico no laborable", type: "puente" },
      { date: "2026-12-08", name: "Día de la Inmaculada Concepción de María", type: "inamovible" },
      { date: "2026-12-25", name: "Navidad", type: "inamovible" },
    ];
    holidaysCache[year] = fallbackList;
    return fallbackList;
  }

  return [];
}

/**
 * Obtiene los feriados entre dos fechas (YYYY-MM-DD), inclusive.
 */
export async function getHolidaysBetween(startDate: string, endDate: string): Promise<ArgentineHoliday[]> {
  const startYear = parseInt(startDate.slice(0, 4), 10);
  const endYear = parseInt(endDate.slice(0, 4), 10);

  const years: number[] = [];
  for (let y = startYear; y <= endYear; y++) {
    years.push(y);
  }

  const allHolidays: ArgentineHoliday[] = [];
  for (const y of years) {
    const list = await fetchArgentineHolidays(y);
    allHolidays.push(...list);
  }

  return allHolidays.filter((h) => h.date >= startDate && h.date <= endDate);
}
