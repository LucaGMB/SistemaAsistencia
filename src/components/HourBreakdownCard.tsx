import React from "react";
import type { HourBreakdown } from "@/lib/hours";

type HourBreakdownCardProps = {
  breakdown: HourBreakdown;
  creditedCount?: number;
};

export default function HourBreakdownCard({ breakdown, creditedCount }: HourBreakdownCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Resumen de Horas Acreditadas
        </h2>
        <div className="mt-1 flex items-baseline gap-3">
          <span className="text-4xl font-extrabold text-accent">{breakdown.total}hs</span>
          <span className="text-sm font-medium text-slate-500">total acumulado</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5">
          <div className="text-xs font-semibold text-slate-500">Clases regulares</div>
          <div className="mt-1 text-2xl font-bold text-slate-800">{breakdown.classHours}hs</div>
          {typeof creditedCount === "number" && (
            <div className="text-[11px] text-slate-500">
              {creditedCount} {creditedCount === 1 ? "asistencia" : "asistencias"}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3.5">
          <div className="text-xs font-semibold text-amber-700">Horas previas (antes 01-09-2026)</div>
          <div className="mt-1 text-2xl font-bold text-amber-900">{breakdown.priorHours}hs</div>
          <div className="text-[11px] text-amber-700/80">Profesor anterior</div>
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3.5">
          <div className="text-xs font-semibold text-blue-700">Cursos y talleres</div>
          <div className="mt-1 text-2xl font-bold text-blue-900">{breakdown.coursesHours}hs</div>
          <div className="text-[11px] text-blue-700/80">Capacitaciones</div>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3.5">
          <div className="text-xs font-semibold text-emerald-700">Pasantías</div>
          <div className="mt-1 text-2xl font-bold text-emerald-900">{breakdown.internshipHours}hs</div>
          <div className="text-[11px] text-emerald-700/80">Horas efectivas</div>
        </div>
      </div>
    </div>
  );
}
