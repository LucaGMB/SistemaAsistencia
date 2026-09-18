"use client";

import React, { useState } from "react";
import {
  INTERNSHIP_EXCEPTION_REASONS,
  WEEKDAY_LABELS,
  InternshipCalculation,
} from "@/lib/hours";

export type InternshipItem = {
  id: string;
  studentId: string;
  company: string;
  roleOrTask: string | null;
  startDate: string;
  endDate: string;
  weeklySchedule: string;
  active: boolean;
  note: string | null;
  exceptions: {
    id: string;
    date: string;
    reason: string;
    note: string | null;
  }[];
  calculation: InternshipCalculation;
};

type Props = {
  studentId: string;
  internships: InternshipItem[];
  canEdit: boolean;
  onChanged: () => void;
};

export default function InternshipsManager({
  studentId,
  internships,
  canEdit,
  onChanged,
}: Props) {
  const [showNewForm, setShowNewForm] = useState(false);
  const [company, setCompany] = useState("");
  const [roleOrTask, setRoleOrTask] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [scheduleState, setScheduleState] = useState<Record<string, { enabled: boolean; hours: number }>>({
    "1": { enabled: false, hours: 4 },
    "2": { enabled: false, hours: 4 },
    "3": { enabled: false, hours: 4 },
    "4": { enabled: false, hours: 4 },
    "5": { enabled: false, hours: 4 },
    "6": { enabled: false, hours: 4 },
  });
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Excepción en proceso
  const [activeExceptionInternshipId, setActiveExceptionInternshipId] = useState<string | null>(null);
  const [exceptionDate, setExceptionDate] = useState("");
  const [exceptionReason, setExceptionReason] = useState<string>(INTERNSHIP_EXCEPTION_REASONS[0]);
  const [exceptionNote, setExceptionNote] = useState("");
  const [savingException, setSavingException] = useState(false);
  const [exceptionError, setExceptionError] = useState<string | null>(null);

  async function handleCreateInternship(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const weeklySchedule: Record<string, number> = {};
    for (const [day, val] of Object.entries(scheduleState)) {
      if (val.enabled && val.hours > 0) {
        weeklySchedule[day] = val.hours;
      }
    }

    if (Object.keys(weeklySchedule).length === 0) {
      setFormError("Debes seleccionar al menos un día y asignar sus horas semanales.");
      return;
    }

    if (!startDate || !endDate) {
      setFormError("Debes indicar fechas de inicio y fin.");
      return;
    }

    if (startDate > endDate) {
      setFormError("La fecha de inicio no puede ser posterior a la fecha de fin.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/students/${studentId}/internships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: company.trim(),
          roleOrTask: roleOrTask.trim() || undefined,
          startDate,
          endDate,
          weeklySchedule,
          note: note.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "No se pudo crear la pasantía.");
      } else {
        setCompany("");
        setRoleOrTask("");
        setStartDate("");
        setEndDate("");
        setNote("");
        setShowNewForm(false);
        onChanged();
      }
    } catch {
      setFormError("Error de conexión al crear la pasantía.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteInternship(internship: InternshipItem) {
    if (!confirm(`¿Eliminar la pasantía en "${internship.company}"?`)) return;

    try {
      const res = await fetch(`/api/students/${studentId}/internships/${internship.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onChanged();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "No se pudo eliminar la pasantía.");
      }
    } catch {
      alert("Error de conexión.");
    }
  }

  async function handleAddException(internshipId: string, e: React.FormEvent) {
    e.preventDefault();
    setExceptionError(null);

    if (!exceptionDate) {
      setExceptionError("Selecciona la fecha de inasistencia.");
      return;
    }

    setSavingException(true);
    try {
      const res = await fetch(`/api/students/${studentId}/internships/${internshipId}/exceptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: exceptionDate,
          reason: exceptionReason,
          note: exceptionNote.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setExceptionError(data.error ?? "No se pudo guardar la inasistencia.");
      } else {
        setExceptionDate("");
        setExceptionNote("");
        setActiveExceptionInternshipId(null);
        onChanged();
      }
    } catch {
      setExceptionError("Error al guardar inasistencia.");
    } finally {
      setSavingException(false);
    }
  }

  async function handleDeleteException(internshipId: string, exceptionId: string, date: string) {
    if (!confirm(`¿Eliminar la inasistencia del ${date}? Las horas correspondientes volverán a acreditarse.`)) {
      return;
    }

    try {
      const res = await fetch(
        `/api/students/${studentId}/internships/${internshipId}/exceptions?exceptionId=${exceptionId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        onChanged();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "No se pudo eliminar la inasistencia.");
      }
    } catch {
      alert("Error al eliminar la inasistencia.");
    }
  }

  const totalCredited = internships.reduce((sum, i) => sum + (i.calculation?.creditedHours || 0), 0);

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-lg font-bold text-primary">Pasantías Externas</h3>
          <p className="text-xs text-slate-500">
            Convenios con empresas, cronograma semanal y registro de inasistencias (feriados, estudio, etc.).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-600">
            Acreditadas: <strong className="text-emerald-700">{totalCredited}hs</strong>
          </span>
          {canEdit && !showNewForm && (
            <button
              type="button"
              className="btn-primary text-xs !py-1.5 !px-3"
              onClick={() => setShowNewForm(true)}
            >
              + Nueva Pasantía
            </button>
          )}
        </div>
      </div>

      {canEdit && showNewForm && (
        <form
          onSubmit={handleCreateInternship}
          className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-primary">Registrar nueva pasantía</h4>
            <button
              type="button"
              className="text-xs text-slate-500 hover:text-slate-800"
              onClick={() => setShowNewForm(false)}
            >
              ✕ Cancelar
            </button>
          </div>

          {formError && <div className="text-xs font-semibold text-red-600">{formError}</div>}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label text-xs">Empresa u Organismo *</label>
              <input
                type="text"
                className="input text-sm py-1.5"
                placeholder="Ej. Globant, Mercado Libre, Municipalidad..."
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label text-xs">Rol o Proyecto (opcional)</label>
              <input
                type="text"
                className="input text-sm py-1.5"
                placeholder="Ej. Soporte TI, Desarrollo Frontend..."
                value={roleOrTask}
                onChange={(e) => setRoleOrTask(e.target.value)}
              />
            </div>
            <div>
              <label className="label text-xs">Fecha Inicio *</label>
              <input
                type="date"
                className="input text-sm py-1.5"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label text-xs">Fecha Fin *</label>
              <input
                type="date"
                className="input text-sm py-1.5"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Días y Horas semanales */}
          <div>
            <label className="label text-xs mb-2">Cronograma Semanal (Días y Horas por día) *</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {["1", "2", "3", "4", "5", "6"].map((dayKey) => {
                const dayState = scheduleState[dayKey];
                return (
                  <div
                    key={dayKey}
                    className={`rounded-lg border p-2 text-xs transition ${
                      dayState.enabled
                        ? "border-primary bg-white shadow-xs"
                        : "border-slate-200 bg-slate-50/60 opacity-70"
                    }`}
                  >
                    <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={dayState.enabled}
                        onChange={(e) =>
                          setScheduleState((prev) => ({
                            ...prev,
                            [dayKey]: { ...prev[dayKey], enabled: e.target.checked },
                          }))
                        }
                        className="rounded text-primary focus:ring-primary"
                      />
                      <span>{WEEKDAY_LABELS[dayKey]}</span>
                    </label>
                    <div className="mt-1.5 flex items-center gap-1">
                      <input
                        type="number"
                        min="1"
                        max="12"
                        disabled={!dayState.enabled}
                        value={dayState.hours}
                        onChange={(e) =>
                          setScheduleState((prev) => ({
                            ...prev,
                            [dayKey]: {
                              ...prev[dayKey],
                              hours: Math.max(1, parseInt(e.target.value, 10) || 1),
                            },
                          }))
                        }
                        className="input !py-0.5 !px-1.5 text-center text-xs w-14 disabled:bg-slate-100"
                      />
                      <span className="text-[11px] text-slate-500">hs</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="label text-xs">Nota / Observación (opcional)</label>
            <input
              type="text"
              className="input text-sm py-1.5"
              placeholder="Convenio, tutor a cargo, detalles..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              onClick={() => setShowNewForm(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary text-xs !py-1.5 !px-4"
            >
              {saving ? "Guardando..." : "Guardar pasantía"}
            </button>
          </div>
        </form>
      )}

      {internships.length === 0 ? (
        <p className="text-sm text-slate-400 italic">No hay pasantías registradas para este alumno.</p>
      ) : (
        <div className="space-y-4">
          {internships.map((intern) => {
            let schedule: Record<string, number> = {};
            try {
              schedule = JSON.parse(intern.weeklySchedule);
            } catch {
              schedule = {};
            }

            const calc = intern.calculation;
            const isAddingException = activeExceptionInternshipId === intern.id;

            return (
              <div
                key={intern.id}
                className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold text-slate-800">{intern.company}</h4>
                      {intern.active ? (
                        <span className="badge bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Activa
                        </span>
                      ) : (
                        <span className="badge bg-slate-100 text-slate-600">Finalizada</span>
                      )}
                    </div>
                    {intern.roleOrTask && (
                      <p className="text-xs text-slate-600 font-medium mt-0.5">{intern.roleOrTask}</p>
                    )}
                    <p className="text-xs text-slate-500 mt-1">
                      Período: <strong className="text-slate-700">{intern.startDate}</strong> al{" "}
                      <strong className="text-slate-700">{intern.endDate}</strong>
                    </p>
                  </div>

                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleDeleteInternship(intern)}
                      className="text-xs text-red-600 hover:text-red-800 hover:underline"
                    >
                      Eliminar pasantía
                    </button>
                  )}
                </div>

                {/* Días semanales */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-500 mr-1">Días:</span>
                  {Object.entries(schedule).map(([dayKey, h]) => (
                    <span
                      key={dayKey}
                      className="rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs text-slate-700 font-medium"
                    >
                      {WEEKDAY_LABELS[dayKey]}: <strong>{h}hs</strong>
                    </span>
                  ))}
                </div>

                {/* Métricas de horas */}
                <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-2.5 text-center text-xs">
                  <div>
                    <div className="text-slate-500 font-medium">Acreditadas (hoy)</div>
                    <div className="text-lg font-bold text-emerald-700">
                      {calc?.creditedHours ?? 0}hs
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 font-medium">Planificadas</div>
                    <div className="text-lg font-bold text-slate-700">
                      {calc?.plannedHours ?? 0}hs
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 font-medium">Inasistencias</div>
                    <div className="text-lg font-bold text-amber-700">
                      -{calc?.deductedHours ?? 0}hs
                      <span className="text-[11px] font-normal text-slate-400 ml-1">
                        ({calc?.exceptionCount ?? 0})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sección de Excepciones / Inasistencias */}
                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      Días no asistidos (feriados, exámenes, enfermedad)
                    </span>
                    {canEdit && !isAddingException && (
                      <button
                        type="button"
                        className="text-xs text-primary font-semibold hover:underline"
                        onClick={() => {
                          setActiveExceptionInternshipId(intern.id);
                          setExceptionError(null);
                        }}
                      >
                        + Registrar inasistencia
                      </button>
                    )}
                  </div>

                  {canEdit && isAddingException && (
                    <form
                      onSubmit={(e) => handleAddException(intern.id, e)}
                      className="rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 space-y-2 text-xs"
                    >
                      <div className="font-semibold text-amber-900">Registrar día no asistido</div>
                      {exceptionError && (
                        <div className="text-red-600 font-medium">{exceptionError}</div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[11px] text-slate-600 mb-0.5">Fecha *</label>
                          <input
                            type="date"
                            min={intern.startDate}
                            max={intern.endDate}
                            className="input !py-1 text-xs"
                            value={exceptionDate}
                            onChange={(e) => setExceptionDate(e.target.value)}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-600 mb-0.5">Motivo *</label>
                          <select
                            className="input !py-1 text-xs"
                            value={exceptionReason}
                            onChange={(e) => setExceptionReason(e.target.value)}
                          >
                            {INTERNSHIP_EXCEPTION_REASONS.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-600 mb-0.5">Nota (opcional)</label>
                          <input
                            type="text"
                            placeholder="Detalle adicional..."
                            className="input !py-1 text-xs"
                            value={exceptionNote}
                            onChange={(e) => setExceptionNote(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          className="rounded border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-100"
                          onClick={() => setActiveExceptionInternshipId(null)}
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={savingException}
                          className="btn-primary !py-1 !px-3 text-xs"
                        >
                          {savingException ? "Guardando..." : "Descontar día"}
                        </button>
                      </div>
                    </form>
                  )}

                  {intern.exceptions.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">
                      Sin inasistencias registradas. Todos los días previstos computan para las horas acreditadas.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="table-base text-[11px]">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Motivo</th>
                            <th>Nota</th>
                            {canEdit && <th></th>}
                          </tr>
                        </thead>
                        <tbody>
                          {intern.exceptions.map((ex) => (
                            <tr key={ex.id}>
                              <td className="font-semibold text-slate-700">{ex.date}</td>
                              <td>
                                <span className="inline-block rounded bg-amber-100 text-amber-800 px-1.5 py-0.5 font-medium">
                                  {ex.reason}
                                </span>
                              </td>
                              <td className="text-slate-500">{ex.note || "—"}</td>
                              {canEdit && (
                                <td className="text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteException(intern.id, ex.id, ex.date)}
                                    className="text-red-600 hover:underline"
                                  >
                                    Quitar
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
