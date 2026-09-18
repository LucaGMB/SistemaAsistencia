"use client";

import { useState } from "react";

type Props = {
  studentId: string;
  previousHours: number;
  isLocked: boolean;
  canEditStaff: boolean;
  isStudent: boolean;
  onChanged: () => void;
};

export default function PreviousTeacherHoursCard({
  studentId,
  previousHours,
  isLocked,
  canEditStaff,
  isStudent,
  onChanged,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [hoursInput, setHoursInput] = useState(previousHours > 0 ? String(previousHours) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = parseInt(hoursInput, 10);
    if (isNaN(parsed) || parsed < 0) {
      setError("Ingresá un número válido mayor o igual a 0.");
      return;
    }

    if (isStudent && !confirm(`¿Confirmás que querés registrar ${parsed}hs del profesor anterior? Esta carga es por única vez y no podrás editarla luego.`)) {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/students/${studentId}/previous-hours`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours: parsed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudieron guardar las horas.");
      } else {
        setEditing(false);
        onChanged();
      }
    } catch {
      setError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card border-l-4 border-l-amber-500 bg-white">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden="true">⏱️</span>
            <h3 className="text-base font-bold text-primary">Horas con Profesor Anterior (antes del 1/9)</h3>
            {isLocked ? (
              <span className="badge bg-slate-100 text-slate-700 border border-slate-200">
                🔒 Bloqueado
              </span>
            ) : (
              <span className="badge bg-amber-50 text-amber-700 border border-amber-200">
                Pendiente de carga
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 max-w-xl">
            Horas acreditadas del 1er cuatrimestre antes de la implementación del sistema el 1 de septiembre de 2026.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-2xl font-black text-primary">+{previousHours}</span>
            <span className="text-xs font-semibold text-slate-500 ml-1">hs</span>
          </div>

          {canEditStaff && !editing && (
            <button
              type="button"
              onClick={() => {
                setHoursInput(String(previousHours));
                setEditing(true);
              }}
              className="btn-outline text-xs !py-1.5 !px-3"
            >
              Editar
            </button>
          )}

          {isStudent && !isLocked && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="btn-primary text-xs !py-1.5 !px-3"
            >
              Cargar mis horas
            </button>
          )}
        </div>
      </div>

      {editing && (
        <form onSubmit={handleSave} className="mt-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
          {isStudent && (
            <div className="rounded-lg bg-amber-100/70 p-3 text-xs text-amber-900 border border-amber-300/50">
              <strong className="font-bold">⚠️ Atención:</strong> Esta carga es por <strong>única vez</strong>. Una vez
              guardado el valor, quedará bloqueado y cualquier corrección posterior deberá ser efectuada por tu profesor o
              administrador.
            </div>
          )}

          {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40">
              <label className="label text-xs font-semibold">Total de horas previas</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="400"
                  required
                  className="input text-sm py-1.5 pr-8"
                  placeholder="Ej. 30"
                  value={hoursInput}
                  onChange={(e) => setHoursInput(e.target.value)}
                />
                <span className="absolute right-3 top-2 text-xs text-slate-400 font-medium">hs</span>
              </div>
            </div>

            <button type="submit" disabled={saving} className="btn-primary text-xs !py-2 !px-4">
              {saving ? "Guardando..." : isStudent ? "Confirmar y bloquear" : "Guardar cambios"}
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => setEditing(false)}
              className="btn-outline text-xs !py-2 !px-3 text-slate-600"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {isStudent && isLocked && (
        <p className="mt-2 text-[11px] text-slate-400">
          Ya registraste tus horas previas. Si necesitás corregir este valor, consultá con tu profesor.
        </p>
      )}
    </section>
  );
}
