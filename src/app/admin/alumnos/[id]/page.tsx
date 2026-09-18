"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import ExportHoursButton from "@/components/ExportHoursButton";

import HourBreakdownCard from "@/components/HourBreakdownCard";
import HourConceptsManager, { HourConceptItem } from "@/components/HourConceptsManager";
import InternshipsManager, { InternshipItem } from "@/components/InternshipsManager";
import type { HourBreakdown } from "@/lib/hours";

type Attendance = {
  id: string;
  date: string;
  dayOfWeek: string;
  hours: number;
  source: string;
  note: string | null;
  cancelled: boolean;
};
type StudentInfo = {
  id: string; dni: string; nombre: string; apellido: string; active: boolean;
};

const DEFAULT_BREAKDOWN: HourBreakdown = {
  classHours: 0,
  priorHours: 0,
  coursesHours: 0,
  internshipHours: 0,
  total: 0,
};

export default function AlumnoDetalleAdmin({ params }: { params: { id: string } }) {
  const { data: session } = useSession();
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [breakdown, setBreakdown] = useState<HourBreakdown>(DEFAULT_BREAKDOWN);
  const [hourConcepts, setHourConcepts] = useState<HourConceptItem[]>([]);
  const [internships, setInternships] = useState<InternshipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const [newDate, setNewDate] = useState("");
  const [newHours, setNewHours] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetch(`/api/students/${params.id}`).then((r) => r.json());
    setStudent(data.student ?? null);
    setAttendances(data.attendances ?? []);
    setBreakdown(
      data.breakdown ?? {
        classHours: 0,
        priorHours: 0,
        coursesHours: 0,
        internshipHours: 0,
        total: data.totalHours ?? 0,
      }
    );
    setHourConcepts(data.hourConcepts ?? []);
    setInternships(data.internships ?? []);
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive() {
    if (!student) return;
    const res = await fetch(`/api/admin/users/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !student.active }),
    });
    if (res.ok) load();
  }

  async function resetPassword() {
    if (newPassword.length < 4) {
      setMessage({ text: "La contraseña debe tener al menos 4 caracteres.", ok: false });
      return;
    }
    const res = await fetch(`/api/admin/users/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    const data = await res.json();
    setMessage(res.ok ? { text: "Contraseña restablecida.", ok: true } : { text: data.error, ok: false });
    if (res.ok) setNewPassword("");
  }

  async function addOrEditAttendance() {
    setMessage(null);
    const res = await fetch("/api/admin/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: params.id,
        date: newDate,
        hours: newHours === "" ? undefined : Number(newHours),
      }),
    });
    const data = await res.json();
    setMessage(res.ok ? { text: "Asistencia guardada.", ok: true } : { text: data.error, ok: false });
    if (res.ok) {
      setNewDate("");
      setNewHours("");
      load();
    }
  }

  async function deleteAttendance(date: string) {
    if (!confirm(`¿Eliminar la asistencia del ${date}?`)) return;
    const res = await fetch("/api/admin/attendance", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: params.id, date }),
    });
    if (res.ok) load();
  }

  if (!session) return null;

  const creditedCount = attendances.filter((a) => !a.cancelled).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar nombre={session.user.nombre} apellido={session.user.apellido} roleLabel="Administrador" />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <Link href="/admin" className="text-sm font-semibold text-primary hover:underline">
          ← Volver al listado
        </Link>

        {loading ? (
          <p className="text-slate-500">Cargando...</p>
        ) : !student ? (
          <p className="text-slate-500">Alumno no encontrado.</p>
        ) : (
          <>
            <section className="card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-primary">{student.apellido}, {student.nombre}</h2>
                  <p className="text-sm text-slate-500">DNI {student.dni}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <ExportHoursButton label="Exportar horas (CSV)" studentId={student.id} />
                  <button onClick={toggleActive} className={student.active ? "btn-danger" : "btn-outline"}>
                    {student.active ? "Desactivar cuenta" : "Reactivar cuenta"}
                  </button>
                </div>
              </div>
            </section>

            {/* Desglose por concepto */}
            <HourBreakdownCard breakdown={breakdown} creditedCount={creditedCount} />

            {/* Gestor de Conceptos individuales */}
            <HourConceptsManager
              studentId={student.id}
              concepts={hourConcepts}
              canEdit={true}
              onChanged={load}
            />

            {/* Gestor de Pasantías con excepciones */}
            <InternshipsManager
              studentId={student.id}
              internships={internships}
              canEdit={true}
              onChanged={load}
            />

            {message && (
              <p className={`text-sm font-medium ${message.ok ? "text-green-700" : "text-red-600"}`}>{message.text}</p>
            )}

            <section className="card">
              <h3 className="mb-2 font-bold text-primary">Restablecer contraseña</h3>
              <div className="flex max-w-md gap-2">
                <input
                  type="text"
                  className="input"
                  placeholder="Nueva contraseña"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button className="btn-outline whitespace-nowrap" onClick={resetPassword}>Restablecer</button>
              </div>
            </section>

            <section className="card">
              <h3 className="mb-2 font-bold text-primary">Cargar / corregir asistencia de una clase pasada</h3>
              <p className="mb-3 text-sm text-slate-500">
                Solo se pueden cargar fechas de martes, jueves o viernes que ya sucedieron y que no
                estén anuladas. Si dejás "Horas" vacío, se acredita el total del día (3hs).
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="label">Fecha</label>
                  <input
                    type="date"
                    min="2026-09-01"
                    className="input"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Horas (opcional)</label>
                  <input
                    type="number"
                    min={0}
                    max={3}
                    className="input w-24"
                    value={newHours}
                    onChange={(e) => setNewHours(e.target.value)}
                  />
                </div>
                <button className="btn-primary" onClick={addOrEditAttendance} disabled={!newDate}>
                  Guardar
                </button>
              </div>
            </section>

            <section className="card">
              <h3 className="mb-4 font-bold text-primary">Historial de asistencias</h3>
              {attendances.length === 0 ? (
                <p className="text-sm text-slate-500">Sin asistencias registradas.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table-base">
                    <thead>
                      <tr><th>Fecha</th><th>Día</th><th>Horas</th><th>Origen</th><th></th></tr>
                    </thead>
                    <tbody>
                      {attendances.map((a) => (
                        <tr key={a.id} className={a.cancelled ? "text-slate-400" : undefined}>
                          <td>{a.date}</td>
                          <td>{a.dayOfWeek}</td>
                          <td>
                            {a.cancelled ? (
                              <span className="badge bg-amber-100 text-amber-700">Clase anulada</span>
                            ) : (
                              `${a.hours}hs`
                            )}
                          </td>
                          <td>{a.source === "ADMIN" ? "Carga manual" : "Autoregistrado"}</td>
                          <td>
                            <button className="btn-danger" onClick={() => deleteAttendance(a.date)}>Eliminar</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
