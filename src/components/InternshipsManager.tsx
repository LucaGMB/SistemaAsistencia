"use client";

import React, { useState } from "react";
import { ArrowPathIcon, XMarkIcon } from "@/components/Icons";
import { formatDateDMY } from "@/lib/dateFormat";
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
  endDate: string | null;
  weeklySchedule: string;
  active: boolean;
  note: string | null;
  createdById?: string | null;
  createdBy?: {
    id: string;
    nombre: string;
    apellido: string;
    role: string;
  } | null;
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
  currentUserId?: string;
  currentUserRole?: string;
  onChanged: () => void;
};

const WEEKDAYS = [
  { day: "1", name: "Lunes" },
  { day: "2", name: "Martes" },
  { day: "3", name: "Miércoles" },
  { day: "4", name: "Jueves" },
  { day: "5", name: "Viernes" },
];

function getValidInternshipDates(intern: InternshipItem): { date: string; dayName: string; hours: number }[] {
  let schedule: Record<string, number> = {};
  try {
    schedule = JSON.parse(intern.weeklySchedule);
  } catch {
    return [];
  }

  const today = new Date().toISOString().slice(0, 10);
  const endLimit = intern.endDate && intern.endDate < today ? intern.endDate : today;
  const existingExceptions = new Set(intern.exceptions.map((e) => e.date));

  const validDates: { date: string; dayName: string; hours: number }[] = [];
  let current = intern.startDate;
  let guard = 0;

  while (current <= endLimit && guard < 1000) {
    guard++;
    const [y, m, d] = current.split("-").map(Number);
    const asUTCNoon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const dayOfWeek = asUTCNoon.getUTCDay().toString();

    const hoursForDay = Number(schedule[dayOfWeek]) || 0;
    if (hoursForDay > 0 && !existingExceptions.has(current)) {
      validDates.push({
        date: current,
        dayName: WEEKDAY_LABELS[dayOfWeek] || "",
        hours: hoursForDay,
      });
    }

    const nextDate = new Date(asUTCNoon.getTime() + 86400000);
    const nextY = nextDate.getUTCFullYear();
    const nextM = String(nextDate.getUTCMonth() + 1).padStart(2, "0");
    const nextD = String(nextDate.getUTCDate()).padStart(2, "0");
    current = `${nextY}-${nextM}-${nextD}`;
  }

  return validDates.reverse();
}

export default function InternshipsManager({
  studentId,
  internships,
  canEdit,
  currentUserId,
  currentUserRole,
  onChanged,
}: Props) {
  const [showNewForm, setShowNewForm] = useState(false);
  const [company, setCompany] = useState("");
  const [roleOrTask, setRoleOrTask] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isOpenEnded, setIsOpenEnded] = useState(false);
  const [scheduleState, setScheduleState] = useState<Record<string, { enabled: boolean; hours: number }>>({
    "1": { enabled: false, hours: 4 },
    "2": { enabled: false, hours: 4 },
    "3": { enabled: false, hours: 4 },
    "4": { enabled: false, hours: 4 },
    "5": { enabled: false, hours: 4 },
  });
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Edición de pasantía
  const [editingInternship, setEditingInternship] = useState<InternshipItem | null>(null);
  const [editCompany, setEditCompany] = useState("");
  const [editRoleOrTask, setEditRoleOrTask] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editIsOpenEnded, setEditIsOpenEnded] = useState(false);
  const [editActive, setEditActive] = useState(true);
  const [editScheduleState, setEditScheduleState] = useState<Record<string, { enabled: boolean; hours: number }>>({
    "1": { enabled: false, hours: 4 },
    "2": { enabled: false, hours: 4 },
    "3": { enabled: false, hours: 4 },
    "4": { enabled: false, hours: 4 },
    "5": { enabled: false, hours: 4 },
  });
  const [editNote, setEditNote] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Excepción en proceso
  const [activeExceptionInternshipId, setActiveExceptionInternshipId] = useState<string | null>(null);
  const [exceptionDate, setExceptionDate] = useState("");
  const [exceptionReason, setExceptionReason] = useState<string>(INTERNSHIP_EXCEPTION_REASONS[0]);
  const [exceptionNote, setExceptionNote] = useState("");
  const [savingException, setSavingException] = useState(false);
  const [exceptionError, setExceptionError] = useState<string | null>(null);
  const [syncingHolidayId, setSyncingHolidayId] = useState<string | null>(null);

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
      setFormError("Debes seleccionar al menos un día de semana (lunes a viernes).");
      return;
    }

    if (!startDate) {
      setFormError("Debes indicar la fecha de inicio.");
      return;
    }

    const effectiveEndDate = isOpenEnded ? null : endDate.trim();
    if (!isOpenEnded && !effectiveEndDate) {
      setFormError("Ingresá la fecha de fin o marcá que la pasantía está en curso.");
      return;
    }

    if (effectiveEndDate && startDate > effectiveEndDate) {
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
          endDate: effectiveEndDate || undefined,
          weeklySchedule,
          note: note.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "No se pudo guardar la pasantía.");
      } else {
        setCompany("");
        setRoleOrTask("");
        setStartDate("");
        setEndDate("");
        setIsOpenEnded(false);
        setNote("");
        setScheduleState({
          "1": { enabled: false, hours: 4 },
          "2": { enabled: false, hours: 4 },
          "3": { enabled: false, hours: 4 },
          "4": { enabled: false, hours: 4 },
          "5": { enabled: false, hours: 4 },
        });
        setShowNewForm(false);
        onChanged();
      }
    } catch {
      setFormError("Error de conexión al guardar la pasantía.");
    } finally {
      setSaving(false);
    }
  }

  function handleStartEdit(intern: InternshipItem) {
    setEditingInternship(intern);
    setEditCompany(intern.company);
    setEditRoleOrTask(intern.roleOrTask || "");
    setEditStartDate(intern.startDate);
    setEditEndDate(intern.endDate || "");
    setEditIsOpenEnded(!intern.endDate);
    setEditActive(intern.active);
    setEditNote(intern.note || "");
    setEditError(null);

    let sched: Record<string, number> = {};
    try {
      sched = JSON.parse(intern.weeklySchedule);
    } catch {}

    const newSchedState: Record<string, { enabled: boolean; hours: number }> = {
      "1": { enabled: !!sched["1"], hours: sched["1"] || 4 },
      "2": { enabled: !!sched["2"], hours: sched["2"] || 4 },
      "3": { enabled: !!sched["3"], hours: sched["3"] || 4 },
      "4": { enabled: !!sched["4"], hours: sched["4"] || 4 },
      "5": { enabled: !!sched["5"], hours: sched["5"] || 4 },
    };
    setEditScheduleState(newSchedState);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingInternship) return;
    setEditError(null);

    const weeklySchedule: Record<string, number> = {};
    for (const [day, val] of Object.entries(editScheduleState)) {
      if (val.enabled && val.hours > 0) {
        weeklySchedule[day] = val.hours;
      }
    }

    if (Object.keys(weeklySchedule).length === 0) {
      setEditError("Debes seleccionar al menos un día de semana (lunes a viernes).");
      return;
    }

    const effectiveEndDate = editIsOpenEnded ? null : editEndDate.trim() || null;
    if (effectiveEndDate && editStartDate > effectiveEndDate) {
      setEditError("La fecha de inicio no puede ser posterior a la fecha de fin.");
      return;
    }

    setEditSaving(true);
    try {
      const res = await fetch(`/api/students/${studentId}/internships/${editingInternship.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: editCompany.trim(),
          roleOrTask: editRoleOrTask.trim() || null,
          startDate: editStartDate,
          endDate: effectiveEndDate,
          weeklySchedule,
          active: editActive,
          note: editNote.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error ?? "No se pudieron guardar los cambios.");
      } else {
        setEditingInternship(null);
        onChanged();
      }
    } catch {
      setEditError("Error al actualizar la pasantía.");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDeleteInternship(intern: InternshipItem) {
    if (!confirm(`¿Eliminar la pasantía en "${intern.company}"? Esta acción borrará también sus inasistencias.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/students/${studentId}/internships/${intern.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onChanged();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "No se pudo eliminar la pasantía.");
      }
    } catch {
      alert("Error al eliminar la pasantía.");
    }
  }

  async function handleAddException(internshipId: string, e: React.FormEvent) {
    e.preventDefault();
    setExceptionError(null);

    if (!exceptionDate) {
      setExceptionError("Seleccioná la fecha de la inasistencia.");
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
        setExceptionError(data.error ?? "No se pudo registrar la inasistencia.");
      } else {
        setExceptionDate("");
        setExceptionNote("");
        setActiveExceptionInternshipId(null);
        onChanged();
      }
    } catch {
      setExceptionError("Error al registrar la inasistencia.");
    } finally {
      setSavingException(false);
    }
  }

  async function handleDeleteException(internshipId: string, exceptionId: string) {
    if (!confirm("¿Quitar esta inasistencia? Las horas volverán a computarse como acreditadas.")) {
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

  async function handleSyncHolidays(intern: InternshipItem) {
    setSyncingHolidayId(intern.id);
    try {
      const res = await fetch(`/api/students/${studentId}/internships/${intern.id}/sync-holidays`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "No se pudieron sincronizar los feriados.");
      } else {
        if (data.createdCount > 0) {
          alert(`¡Feriados sincronizados! Se descontaron automáticamente ${data.createdCount} feriados: ${data.added.join(", ")}`);
        } else {
          alert("Los feriados oficiales del período ya se encuentran registrados o no coinciden con los días semanales de esta pasantía.");
        }
        onChanged();
      }
    } catch {
      alert("Error al sincronizar feriados.");
    } finally {
      setSyncingHolidayId(null);
    }
  }

  const totalCredited = internships.reduce((sum, i) => sum + (i.calculation?.creditedHours || 0), 0);

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-lg font-bold text-primary">Pasantías Externas</h3>
          <p className="text-xs text-slate-500">
            Convenios laborales, cronograma semanal (lunes a viernes) y descuento automático de inasistencias.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-600">
            Acreditadas: <strong className="text-emerald-700">{totalCredited}hs</strong>
          </span>
          {canEdit && !showNewForm && !editingInternship && (
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

      {/* Formulario de creación */}
      {canEdit && showNewForm && (
        <form
          onSubmit={handleCreateInternship}
          className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-primary">Registrar nueva pasantía</h4>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
              onClick={() => setShowNewForm(false)}
            >
              <XMarkIcon className="w-3.5 h-3.5" />
              <span>Cancelar</span>
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
              <div className="flex items-center justify-between mb-1">
                <label className="label text-xs !mb-0">Fecha Fin</label>
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isOpenEnded}
                    onChange={(e) => setIsOpenEnded(e.target.checked)}
                    className="rounded text-primary focus:ring-primary h-3.5 w-3.5"
                  />
                  <span>En curso (sin fin fijado)</span>
                </label>
              </div>
              <input
                type="date"
                disabled={isOpenEnded}
                className="input text-sm py-1.5 disabled:bg-slate-100 disabled:text-slate-400"
                value={isOpenEnded ? "" : endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required={!isOpenEnded}
              />
            </div>
          </div>

          {/* Cronograma semanal - Solo días de semana */}
          <div>
            <label className="label text-xs">Cronograma Semanal (Lunes a Viernes) *</label>
            <p className="text-[11px] text-slate-500 mb-2">
              Marcá los días que asistís y la cantidad de horas por día. No se permiten sábados ni domingos.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
              {WEEKDAYS.map((w) => {
                const isChecked = scheduleState[w.day]?.enabled || false;
                const hoursVal = scheduleState[w.day]?.hours || 4;

                return (
                  <div
                    key={w.day}
                    className={`rounded-lg border p-2 text-xs transition-colors ${
                      isChecked ? "border-primary/40 bg-white shadow-sm" : "border-slate-200 bg-slate-50/50"
                    }`}
                  >
                    <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) =>
                          setScheduleState({
                            ...scheduleState,
                            [w.day]: { ...scheduleState[w.day], enabled: e.target.checked },
                          })
                        }
                        className="rounded text-primary focus:ring-primary h-4 w-4"
                      />
                      <span>{w.name}</span>
                    </label>

                    {isChecked && (
                      <div className="mt-2 flex items-center gap-1">
                        <input
                          type="number"
                          min="1"
                          max="12"
                          value={hoursVal}
                          onChange={(e) =>
                            setScheduleState({
                              ...scheduleState,
                              [w.day]: {
                                ...scheduleState[w.day],
                                hours: Math.max(1, parseInt(e.target.value, 10) || 1),
                              },
                            })
                          }
                          className="input !py-1 text-center font-bold text-xs w-16"
                        />
                        <span className="text-slate-500 font-medium">hs</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="label text-xs">Nota / Observación (opcional)</label>
            <textarea
              rows={2}
              className="input text-sm py-1.5"
              placeholder="Convenio, tutor a cargo, detalles..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              className="btn-outline text-xs !py-1.5 !px-3 text-slate-600"
              onClick={() => setShowNewForm(false)}
            >
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="btn-primary text-xs !py-1.5 !px-4">
              {saving ? "Guardando..." : "Guardar pasantía"}
            </button>
          </div>
        </form>
      )}

      {/* Formulario de edición */}
      {canEdit && editingInternship && (
        <form
          onSubmit={handleSaveEdit}
          className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-primary">Editar pasantía en {editingInternship.company}</h4>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
              onClick={() => setEditingInternship(null)}
            >
              <XMarkIcon className="w-3.5 h-3.5" />
              <span>Cancelar</span>
            </button>
          </div>

          {editError && <div className="text-xs font-semibold text-red-600">{editError}</div>}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label text-xs">Empresa u Organismo *</label>
              <input
                type="text"
                className="input text-sm py-1.5"
                value={editCompany}
                onChange={(e) => setEditCompany(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label text-xs">Rol o Proyecto</label>
              <input
                type="text"
                className="input text-sm py-1.5"
                value={editRoleOrTask}
                onChange={(e) => setEditRoleOrTask(e.target.value)}
              />
            </div>
            <div>
              <label className="label text-xs">Fecha Inicio *</label>
              <input
                type="date"
                className="input text-sm py-1.5"
                value={editStartDate}
                onChange={(e) => setEditStartDate(e.target.value)}
                required
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label text-xs !mb-0">Fecha Fin</label>
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsOpenEnded}
                    onChange={(e) => setEditIsOpenEnded(e.target.checked)}
                    className="rounded text-primary focus:ring-primary h-3.5 w-3.5"
                  />
                  <span>En curso (sin fin fijado)</span>
                </label>
              </div>
              <input
                type="date"
                disabled={editIsOpenEnded}
                className="input text-sm py-1.5 disabled:bg-slate-100 disabled:text-slate-400"
                value={editIsOpenEnded ? "" : editEndDate}
                onChange={(e) => setEditEndDate(e.target.value)}
                required={!editIsOpenEnded}
              />
            </div>
          </div>

          {/* Cronograma semanal edición */}
          <div>
            <label className="label text-xs">Cronograma Semanal (Lunes a Viernes) *</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
              {WEEKDAYS.map((w) => {
                const isChecked = editScheduleState[w.day]?.enabled || false;
                const hoursVal = editScheduleState[w.day]?.hours || 4;

                return (
                  <div
                    key={w.day}
                    className={`rounded-lg border p-2 text-xs transition-colors ${
                      isChecked ? "border-primary/40 bg-white shadow-sm" : "border-slate-200 bg-slate-50/50"
                    }`}
                  >
                    <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) =>
                          setEditScheduleState({
                            ...editScheduleState,
                            [w.day]: { ...editScheduleState[w.day], enabled: e.target.checked },
                          })
                        }
                        className="rounded text-primary focus:ring-primary h-4 w-4"
                      />
                      <span>{w.name}</span>
                    </label>

                    {isChecked && (
                      <div className="mt-2 flex items-center gap-1">
                        <input
                          type="number"
                          min="1"
                          max="12"
                          value={hoursVal}
                          onChange={(e) =>
                            setEditScheduleState({
                              ...editScheduleState,
                              [w.day]: {
                                ...editScheduleState[w.day],
                                hours: Math.max(1, parseInt(e.target.value, 10) || 1),
                              },
                            })
                          }
                          className="input !py-1 text-center font-bold text-xs w-16"
                        />
                        <span className="text-slate-500 font-medium">hs</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={editActive}
                onChange={(e) => setEditActive(e.target.checked)}
                className="rounded text-primary focus:ring-primary h-4 w-4"
              />
              <span>Pasantía activa actualmente</span>
            </label>
          </div>

          <div>
            <label className="label text-xs">Nota / Observación</label>
            <textarea
              rows={2}
              className="input text-sm py-1.5"
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              className="btn-outline text-xs !py-1.5 !px-3 text-slate-600"
              onClick={() => setEditingInternship(null)}
            >
              Cancelar
            </button>
            <button type="submit" disabled={editSaving} className="btn-primary text-xs !py-1.5 !px-4">
              {editSaving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      )}

      {/* Listado de pasantías */}
      {internships.length === 0 ? (
        <p className="text-sm text-slate-500">No hay pasantías externas registradas.</p>
      ) : (
        <div className="space-y-4">
          {internships.map((intern) => {
            const isAddingException = activeExceptionInternshipId === intern.id;
            const calc = intern.calculation;
            let schedule: Record<string, number> = {};
            try {
              schedule = JSON.parse(intern.weeklySchedule);
            } catch {}

            const isStaff = currentUserRole === "PROFESOR" || currentUserRole === "ADMIN";
            const isCreator = !intern.createdById || intern.createdById === currentUserId;
            const canManageThis = isStaff || isCreator;
            const validDates = getValidInternshipDates(intern);

            return (
              <div
                key={intern.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3"
              >
                {/* Cabecera */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-primary text-base">{intern.company}</h4>
                      {intern.active ? (
                        <span className="badge bg-emerald-100 text-emerald-800">Activa</span>
                      ) : (
                        <span className="badge bg-slate-100 text-slate-600">Finalizada</span>
                      )}
                      {intern.createdBy?.role === "ALUMNO" ? (
                        <span className="badge bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Alumno
                        </span>
                      ) : (
                        <span className="badge bg-slate-100 text-slate-700 border border-slate-200">
                          Docente
                        </span>
                      )}
                    </div>
                    {intern.roleOrTask && (
                      <p className="text-xs text-slate-600 font-medium mt-0.5">{intern.roleOrTask}</p>
                    )}
                    <p className="text-xs text-slate-500 mt-0.5">
                      Período: <strong>{formatDateDMY(intern.startDate)}</strong> al{" "}
                      <strong>{intern.endDate ? formatDateDMY(intern.endDate) : "En curso (sin fin fijado)"}</strong>
                    </p>
                  </div>

                  {canEdit && canManageThis && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(intern)}
                        className="text-xs text-primary hover:underline font-semibold"
                      >
                        Editar
                      </button>
                      <span className="text-slate-300">·</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteInternship(intern)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>

                {/* Cronograma semanal */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-500 mr-1">Días:</span>
                  {Object.entries(schedule).map(([dayKey, h]) => (
                    <span
                      key={dayKey}
                      className="rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs text-slate-700 font-medium"
                    >
                      {WEEKDAY_LABELS[dayKey] || dayKey}: <strong>{h}hs</strong>
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
                      {intern.endDate ? `${calc?.plannedHours ?? 0}hs` : "En curso"}
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700">
                      Días no asistidos (feriados, exámenes, enfermedad)
                    </span>
                    <div className="flex items-center gap-3">
                      {canEdit && (
                        <button
                          type="button"
                          disabled={syncingHolidayId === intern.id}
                          className="inline-flex items-center gap-1 text-xs text-indigo-700 hover:underline font-semibold"
                          onClick={() => handleSyncHolidays(intern)}
                        >
                          <ArrowPathIcon className={`w-3.5 h-3.5 ${syncingHolidayId === intern.id ? "animate-spin" : ""}`} />
                          <span>{syncingHolidayId === intern.id ? "Sincronizando..." : "Sincronizar feriados"}</span>
                        </button>
                      )}
                      {canEdit && !isAddingException && (
                        <button
                          type="button"
                          className="text-xs text-primary font-semibold hover:underline"
                          onClick={() => {
                            setActiveExceptionInternshipId(intern.id);
                            setExceptionError(null);
                            setExceptionDate(validDates[0]?.date || "");
                          }}
                        >
                          + Registrar inasistencia
                        </button>
                      )}
                    </div>
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
                          <label className="block text-[11px] text-slate-600 mb-0.5">Día de pasantía a descontar *</label>
                          {validDates.length === 0 ? (
                            <p className="text-[11px] text-slate-500 italic py-1">
                              No hay días pasados de pasantía disponibles para descontar.
                            </p>
                          ) : (
                            <select
                              className="input !py-1 text-xs"
                              value={exceptionDate}
                              onChange={(e) => setExceptionDate(e.target.value)}
                              required
                            >
                              <option value="">Seleccionar día...</option>
                              {validDates.map((vd) => (
                                <option key={vd.date} value={vd.date}>
                                  {vd.dayName} {formatDateDMY(vd.date)} ({vd.hours}hs)
                                </option>
                              ))}
                            </select>
                          )}
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
                          className="btn-outline text-xs !py-1 !px-2.5 text-slate-600"
                          onClick={() => setActiveExceptionInternshipId(null)}
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={savingException || validDates.length === 0}
                          className="btn-primary text-xs !py-1 !px-3"
                        >
                          {savingException ? "Guardando..." : "Descontar día"}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Tabla de excepciones existentes */}
                  {intern.exceptions.length === 0 ? (
                    <p className="text-[11px] text-slate-500">
                      Sin inasistencias registradas. Todos los días previstos computan para las horas acreditadas.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-[11px] text-slate-500">
                            <th className="pb-1 font-semibold">Fecha</th>
                            <th className="pb-1 font-semibold">Motivo</th>
                            <th className="pb-1 font-semibold">Nota</th>
                            {canEdit && <th className="pb-1 text-right font-semibold"></th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {intern.exceptions.map((ex) => (
                            <tr key={ex.id} className="text-slate-700">
                              <td className="py-1 font-mono text-[11px]">{formatDateDMY(ex.date)}</td>
                              <td className="py-1">
                                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                                  {ex.reason}
                                </span>
                              </td>
                              <td className="py-1 text-slate-500">{ex.note || "—"}</td>
                              {canEdit && (
                                <td className="py-1 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteException(intern.id, ex.id)}
                                    className="text-[11px] text-red-600 hover:underline"
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

                {intern.note && (
                  <p className="text-xs text-slate-500 italic">Observación: {intern.note}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
