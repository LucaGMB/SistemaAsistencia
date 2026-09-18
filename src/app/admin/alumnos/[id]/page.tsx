"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import ExportHoursButton from "@/components/ExportHoursButton";

import HourBreakdownCard from "@/components/HourBreakdownCard";
import PreviousTeacherHoursCard from "@/components/PreviousTeacherHoursCard";
import HourConceptsManager, { HourConceptItem } from "@/components/HourConceptsManager";
import InternshipsManager, { InternshipItem } from "@/components/InternshipsManager";
import RefreshIndicator from "@/components/RefreshIndicator";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
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
  id: string;
  dni: string;
  nombre: string;
  apellido: string;
  active: boolean;
  previousTeacherHours?: number;
  previousTeacherHoursLocked?: boolean;
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
  const [activeTab, setActiveTab] = useState<"pasantias" | "cursos" | "asistencias">("pasantias");
  const [classDates, setClassDates] = useState<{ date: string; dayOfWeek: string }[]>([]);

  const [newDate, setNewDate] = useState("");
  const [newHours, setNewHours] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    fetch("/api/classes/dates?limit=40")
      .then((r) => r.json())
      .then((d) => setClassDates(d.dates ?? []));
  }, []);

  const load = useCallback(async () => {
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

  const { lastUpdate, refreshing, refreshNow } = useAutoRefresh(load);

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
                  <div className="flex items-center gap-2">
                    <RefreshIndicator lastUpdate={lastUpdate} refreshing={refreshing} onRefresh={refreshNow} />
                    <ExportHoursButton label="Exportar horas (CSV)" studentId={student.id} />
                  </div>
                  <button onClick={toggleActive} className={student.active ? "btn-danger" : "btn-outline"}>
                    {student.active ? "Desactivar cuenta" : "Reactivar cuenta"}
                  </button>
                </div>
              </div>
            </section>

            {/* Desglose por concepto */}
            <HourBreakdownCard breakdown={breakdown} creditedCount={creditedCount} />

            {/* Horas del profesor anterior (gestión docente y admin) */}
            <PreviousTeacherHoursCard
              studentId={student.id}
              previousHours={student.previousTeacherHours ?? 0}
              isLocked={student.previousTeacherHoursLocked ?? false}
              canEditStaff={true}
              isStudent={false}
              onChanged={load}
            />

            {/* Acciones de administración: Contraseña */}
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

            {/* Navegación Modular por Módulos */}
            <div className="flex border-b border-slate-200 bg-white rounded-xl p-1.5 shadow-sm overflow-x-auto gap-1">
              <button
                type="button"
                onClick={() => setActiveTab("pasantias")}
                className={`flex-1 py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === "pasantias"
                    ? "bg-primary text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span>🏢 Pasantías</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    activeTab === "pasantias" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {breakdown.internshipHours}hs
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("cursos")}
                className={`flex-1 py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === "cursos"
                    ? "bg-primary text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span>🎓 Cursos y Talleres</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    activeTab === "cursos" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {breakdown.coursesHours}hs
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("asistencias")}
                className={`flex-1 py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === "asistencias"
                    ? "bg-primary text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span>📅 Clases Presenciales</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    activeTab === "asistencias" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {creditedCount} presentes
                </span>
              </button>
            </div>

            {/* Contenido según Módulo Activo */}
            {activeTab === "pasantias" && (
              <InternshipsManager
                studentId={student.id}
                internships={internships}
                canEdit={true}
                currentUserId={session.user.id}
                currentUserRole={session.user.role}
                onChanged={load}
              />
            )}

            {activeTab === "cursos" && (
              <HourConceptsManager
                studentId={student.id}
                concepts={hourConcepts}
                canEdit={true}
                currentUserId={session.user.id}
                currentUserRole={session.user.role}
                onChanged={load}
              />
            )}

            {activeTab === "asistencias" && (
              <div className="space-y-6">
                {message && (
                  <p className={`text-sm font-medium ${message.ok ? "text-green-700" : "text-red-600"}`}>{message.text}</p>
                )}

                <section className="card">
                  <h3 className="mb-2 font-bold text-primary">Cargar / corregir asistencia de una clase pasada</h3>
                  <p className="mb-3 text-sm text-slate-500">
                    Solo se pueden cargar clases reales (martes, jueves o viernes) a partir del 1
                    de septiembre de 2026. Si dejás "Horas" vacío, se acredita el total del día (3hs).
                  </p>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[220px]">
                      <label className="label">Fecha de clase *</label>
                      <select
                        className="input text-sm"
                        value={newDate}
                        onChange={(e) => setNewDate(e.target.value)}
                      >
                        <option value="">Seleccionar clase pasada...</option>
                        {classDates.map((cd) => (
                          <option key={cd.date} value={cd.date}>
                            {cd.dayOfWeek} {cd.date}
                          </option>
                        ))}
                      </select>
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
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
