"use client";

import React, { useState } from "react";
import { XMarkIcon } from "@/components/Icons";
import { HOUR_CONCEPT_CATEGORIES, HourConceptCategory } from "@/lib/hours";

export type HourConceptItem = {
  id: string;
  category: string;
  title: string;
  institution: string | null;
  hours: number;
  date: string | null;
  note: string | null;
  createdById?: string | null;
  createdBy?: {
    id: string;
    nombre: string;
    apellido: string;
    role: string;
  } | null;
};

type Props = {
  studentId: string;
  concepts: HourConceptItem[];
  canEdit: boolean;
  currentUserId?: string;
  currentUserRole?: string;
  onChanged: () => void;
};

const CATEGORY_COLORS: Record<string, string> = {
  PREVIA: "bg-amber-100 text-amber-800 border-amber-200",
  CURSO: "bg-blue-100 text-blue-800 border-blue-200",
  CAPACITACION: "bg-purple-100 text-purple-800 border-purple-200",
  OTRO: "bg-slate-100 text-slate-800 border-slate-200",
};

const CATEGORY_LABELS: Record<string, string> = {
  PREVIA: "Horas Previas",
  CURSO: "Curso",
  CAPACITACION: "Capacitación",
  OTRO: "Otro",
};

export default function HourConceptsManager({
  studentId,
  concepts,
  canEdit,
  currentUserId,
  currentUserRole,
  onChanged,
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState<HourConceptCategory>("CURSO");
  const [title, setTitle] = useState("");
  const [institution, setInstitution] = useState("");
  const [hours, setHours] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedHours = parseInt(hours, 10);
    if (isNaN(parsedHours) || parsedHours <= 0) {
      setError("La cantidad de horas debe ser un número entero positivo.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/students/${studentId}/concepts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          title: title.trim(),
          institution: institution.trim() || undefined,
          hours: parsedHours,
          date: date || undefined,
          note: note.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar el concepto.");
      } else {
        setTitle("");
        setInstitution("");
        setHours("");
        setDate("");
        setNote("");
        setShowForm(false);
        onChanged();
      }
    } catch {
      setError("Error de conexión al guardar el concepto.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(concept: HourConceptItem) {
    if (!confirm(`¿Eliminar el concepto "${concept.title}" (${concept.hours}hs)?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/students/${studentId}/concepts/${concept.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "No se pudo eliminar el concepto.");
      } else {
        onChanged();
      }
    } catch {
      alert("Error de conexión al eliminar.");
    }
  }

  const totalConceptHours = concepts.reduce((acc, c) => acc + c.hours, 0);

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-lg font-bold text-primary">Cursos y Capacitaciones Externas</h3>
          <p className="text-xs text-slate-500">
            Cursos, talleres, certificaciones y capacitaciones extracurriculares individuales.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-600">
            Subtotal: <strong className="text-accent">{totalConceptHours}hs</strong>
          </span>
          {canEdit && !showForm && (
            <button
              type="button"
              className="btn-primary text-xs !py-1.5 !px-3"
              onClick={() => setShowForm(true)}
            >
              + Nuevo Curso / Concepto
            </button>
          )}
        </div>
      </div>

      {canEdit && showForm && (
        <form onSubmit={handleAdd} className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-primary">Cargar curso o capacitación</h4>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
              onClick={() => setShowForm(false)}
            >
              <XMarkIcon className="w-3.5 h-3.5" />
              <span>Cancelar</span>
            </button>
          </div>

          {error && <div className="text-xs font-semibold text-red-600">{error}</div>}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            <div>
              <label className="label text-xs">Categoría</label>
              <select
                className="input text-sm py-1.5"
                value={category}
                onChange={(e) => setCategory(e.target.value as HourConceptCategory)}
              >
                {HOUR_CONCEPT_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label text-xs">Título / Descripción *</label>
              <input
                type="text"
                className="input text-sm py-1.5"
                placeholder="Ej. Curso React, Certificación AWS..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label text-xs">Horas a acreditar *</label>
              <input
                type="number"
                min="1"
                step="1"
                className="input text-sm py-1.5"
                placeholder="Ej. 20"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label text-xs">Institución / Certificador (opcional)</label>
              <input
                type="text"
                className="input text-sm py-1.5"
                placeholder="Ej. Escuela, Coderhouse, Platzi..."
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
              />
            </div>

            <div>
              <label className="label text-xs">Fecha asociada (opcional)</label>
              <input
                type="date"
                className="input text-sm py-1.5"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div>
              <label className="label text-xs">Nota u Observación (opcional)</label>
              <input
                type="text"
                className="input text-sm py-1.5"
                placeholder="Observaciones adicionales..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              onClick={() => setShowForm(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary text-xs !py-1.5 !px-4"
            >
              {saving ? "Guardando..." : "Guardar concepto"}
            </button>
          </div>
        </form>
      )}

      {concepts.length === 0 ? (
        <p className="text-sm text-slate-400 italic">No hay conceptos de horas registrados.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-base text-xs">
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Concepto / Título</th>
                <th>Institución</th>
                <th>Fecha</th>
                <th>Horas</th>
                <th>Cargado por</th>
                <th>Nota</th>
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {concepts.map((c) => {
                const isStudent = currentUserRole === "ALUMNO";
                const isCreatedByTeacher = c.createdById && c.createdById !== currentUserId;
                const canDeleteThis = !isStudent || !isCreatedByTeacher;

                return (
                  <tr key={c.id}>
                    <td>
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold border ${
                          CATEGORY_COLORS[c.category] || CATEGORY_COLORS.OTRO
                        }`}
                      >
                        {CATEGORY_LABELS[c.category] || c.category}
                      </span>
                    </td>
                    <td className="font-medium text-slate-800">{c.title}</td>
                    <td className="text-slate-500">{c.institution || "—"}</td>
                    <td className="text-slate-500">{c.date || "—"}</td>
                    <td className="font-bold text-accent">+{c.hours}hs</td>
                    <td>
                      {c.createdBy?.role === "ALUMNO" ? (
                        <span className="badge bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Alumno
                        </span>
                      ) : (
                        <span className="badge bg-slate-100 text-slate-700 border border-slate-200">
                          Docente
                        </span>
                      )}
                    </td>
                    <td className="max-w-[150px] truncate text-slate-400" title={c.note || undefined}>
                      {c.note || "—"}
                    </td>
                    {canEdit && (
                      <td className="text-right">
                        {canDeleteThis ? (
                          <button
                            type="button"
                            onClick={() => handleDelete(c)}
                            className="text-xs text-red-600 hover:underline hover:text-red-800"
                          >
                            Eliminar
                          </button>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
