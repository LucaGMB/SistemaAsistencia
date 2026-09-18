"use client";

import { useCallback, useEffect, useState } from "react";
import { useAutoRefresh } from "@/lib/useAutoRefresh";

type CalendarDay = {
  date: string;
  dayOfWeek: string;
  start: string;
  end: string;
  hours: number;
  state: "CANCELADA" | "PRESENTE" | "AUSENTE" | "EN_CURSO" | "PROXIMA";
  isToday: boolean;
  reason: string | null;
  creditedHours: number;
};

type WeekData = {
  monday: string;
  sunday: string;
  isCurrentWeek: boolean;
  canPrev?: boolean;
  canNext?: boolean;
  days: CalendarDay[];
};

const STATE_STYLES: Record<CalendarDay["state"], { card: string; badge: string; label: string }> = {
  CANCELADA: {
    card: "border-slate-200 bg-slate-100",
    badge: "bg-slate-300 text-slate-600",
    label: "Clase anulada",
  },
  PRESENTE: {
    card: "border-green-200 bg-green-50",
    badge: "bg-green-100 text-green-700",
    label: "Presente",
  },
  AUSENTE: {
    card: "border-red-100 bg-red-50",
    badge: "bg-red-100 text-red-700",
    label: "Sin registrar",
  },
  EN_CURSO: {
    card: "border-accent bg-accent/10",
    badge: "bg-accent text-white",
    label: "En curso",
  },
  PROXIMA: {
    card: "border-slate-200 bg-white",
    badge: "bg-primary/10 text-primary",
    label: "Próxima",
  },
};

/** "2026-09-08" -> "8 de septiembre" */
function formatDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  return `${d} de ${meses[m - 1]}`;
}

export default function WeekCalendar({ studentId }: { studentId?: string }) {
  const [week, setWeek] = useState<WeekData | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (reference) params.set("week", reference);
    if (studentId) params.set("studentId", studentId);
    const query = params.toString();
    const data = await fetch(`/api/calendar${query ? `?${query}` : ""}`).then((r) => r.json());
    setWeek(data);
    setLoading(false);
  }, [reference, studentId]);

  // El "Cargando..." se muestra solo al abrir o al cambiar de semana; los
  // refrescos automáticos actualizan en silencio para no hacer parpadear
  // las tarjetas cada 30 segundos.
  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Una corrección de asistencia tiene que verse acá también, sin recargar.
  useAutoRefresh(load);

  function shiftWeek(days: number) {
    if (!week) return;
    if (days < 0 && week.canPrev === false) return;
    if (days > 0 && week.canNext === false) return;
    const [y, m, d] = week.monday.split("-").map(Number);
    const base = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    base.setUTCDate(base.getUTCDate() + days);
    setReference(base.toISOString().slice(0, 10));
  }

  const totalSemana = week?.days.reduce((sum, d) => sum + d.creditedHours, 0) ?? 0;

  return (
    <div>
      {/* Navegación: en mobile los controles ocupan el ancho completo */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-700">
            {week ? `${formatDate(week.monday)} al ${formatDate(week.sunday)}` : "—"}
          </p>
          {week && (
            <p className="text-sm text-slate-500">
              {week.isCurrentWeek ? "Semana actual" : "Otra semana"} · {totalSemana}hs acreditadas
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => shiftWeek(-7)}
            disabled={week?.canPrev === false}
            className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
              week?.canPrev === false
                ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                : "border-primary/30 text-primary hover:bg-primary/5"
            }`}
            aria-label="Semana anterior"
            title={week?.canPrev === false ? "Límite: Semana del 1 de septiembre de 2026" : undefined}
          >
            ← Anterior
          </button>
          {!week?.isCurrentWeek && (
            <button
              onClick={() => setReference(null)}
              className="rounded-lg border border-primary/30 px-3 py-1.5 text-sm font-semibold text-primary transition hover:bg-primary/5"
            >
              Hoy
            </button>
          )}
          <button
            onClick={() => shiftWeek(7)}
            disabled={week?.canNext === false}
            className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
              week?.canNext === false
                ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                : "border-primary/30 text-primary hover:bg-primary/5"
            }`}
            aria-label="Semana siguiente"
            title={week?.canNext === false ? "Límite: Máximo 2 semanas hacia adelante" : undefined}
          >
            Siguiente →
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Cargando...</p>
      ) : !week || week.days.length === 0 ? (
        <p className="text-sm text-slate-500">Esta semana no hay clases.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {week.days.map((d) => {
            const style = STATE_STYLES[d.state];
            return (
              <div
                key={d.date}
                className={`rounded-xl border p-4 ${style.card} ${
                  d.isToday ? "ring-2 ring-primary/40" : ""
                }`}
              >
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <p
                    className={`font-bold ${
                      d.state === "CANCELADA" ? "text-slate-500" : "text-primary"
                    }`}
                  >
                    {d.dayOfWeek}
                  </p>
                  {d.isToday && (
                    <span className="text-xs font-semibold uppercase text-primary">Hoy</span>
                  )}
                </div>

                <p className={`text-sm ${d.state === "CANCELADA" ? "text-slate-400" : "text-slate-500"}`}>
                  {formatDate(d.date)}
                </p>
                <p className={`text-sm ${d.state === "CANCELADA" ? "text-slate-400 line-through" : "text-slate-600"}`}>
                  {d.start} a {d.end}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={`badge ${style.badge}`}>{style.label}</span>
                  {d.state === "PRESENTE" && (
                    <span className="text-sm font-semibold text-green-700">+{d.creditedHours}hs</span>
                  )}
                  {d.state === "PROXIMA" && (
                    <span className="text-sm text-slate-500">{d.hours}hs</span>
                  )}
                </div>

                {d.reason && <p className="mt-2 text-xs text-slate-500">{d.reason}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
