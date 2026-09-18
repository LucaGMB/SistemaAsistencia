"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import ExportHoursButton from "@/components/ExportHoursButton";
import RefreshIndicator from "@/components/RefreshIndicator";
import HoursDashboardCharts from "@/components/HoursDashboardCharts";
import PreviousTeacherHoursCard from "@/components/PreviousTeacherHoursCard";
import HourConceptsManager, { HourConceptItem } from "@/components/HourConceptsManager";
import InternshipsManager, { InternshipItem } from "@/components/InternshipsManager";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import {
  DashboardIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  AcademicCapIcon,
} from "@/components/Icons";
import { formatDateDMY } from "@/lib/dateFormat";
import type { HourBreakdown } from "@/lib/hours";

type Attendance = {
  id: string;
  date: string;
  dayOfWeek: string;
  hours: number;
  source: string;
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

export default function AlumnoDetalleProfesor({ params }: { params: { id: string } }) {
  const { data: session } = useSession();
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [breakdown, setBreakdown] = useState<HourBreakdown>(DEFAULT_BREAKDOWN);
  const [hourConcepts, setHourConcepts] = useState<HourConceptItem[]>([]);
  const [internships, setInternships] = useState<InternshipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentOpenClassDate, setCurrentOpenClassDate] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"dashboard" | "pasantias" | "cursos" | "asistencias">("dashboard");
  const [classDates, setClassDates] = useState<{ date: string; dayOfWeek: string }[]>([]);

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
    setCurrentOpenClassDate(data.currentOpenClassDate ?? null);
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const { lastUpdate, refreshing, refreshNow } = useAutoRefresh(load);

  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [newDate, setNewDate] = useState("");
  const [newHours, setNewHours] = useState("");

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
    setMessage(null);
    const res = await fetch("/api/admin/attendance", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: params.id, date }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage({ text: data.error ?? "No se pudo eliminar la asistencia.", ok: false });
    } else {
      load();
    }
  }

  if (!session) return null;

  const creditedCount = attendances.filter((a) => !a.cancelled).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar
        nombre={session.user.nombre}
        apellido={session.user.apellido}
        roleLabel={session.user.role === "ADMIN" ? "Administrador" : "Profesor"}
      />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <Link href="/profesor" className="text-sm font-semibold text-primary hover:underline">
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
                  <h2 className="text-xl font-bold text-primary">
                    {student.apellido}, {student.nombre}
                  </h2>
                  <p className="text-sm text-slate-500">DNI {student.dni}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <ExportHoursButton label="Exportar horas (CSV)" studentId={student.id} />
                  <RefreshIndicator lastUpdate={lastUpdate} refreshing={refreshing} onRefresh={refreshNow} />
                </div>
              </div>
            </section>

            {/* Navegación Modular por Módulos */}
            <div className="flex border-b border-slate-200 bg-white rounded-xl p-1.5 shadow-sm overflow-x-auto gap-1">
              <button
                type="button"
                onClick={() => setActiveTab("dashboard")}
                className={`flex-1 py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === "dashboard"
                    ? "bg-primary text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <DashboardIcon className="w-4 h-4 shrink-0" />
                <span>Resumen General</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("pasantias")}
                className={`flex-1 py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === "pasantias"
                    ? "bg-primary text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <BuildingOfficeIcon className="w-4 h-4 shrink-0" />
                <span>Pasantías</span>
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
                onClick={() => setActiveTab("asistencias")}
                className={`flex-1 py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === "asistencias"
                    ? "bg-primary text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <CalendarIcon className="w-4 h-4 shrink-0" />
                <span>Clases</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    activeTab === "asistencias" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {creditedCount} presentes
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
                <AcademicCapIcon className="w-4 h-4 shrink-0" />
                <span>Cursos</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    activeTab === "cursos" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {breakdown.coursesHours}hs
                </span>
              </button>
            </div>

            {/* PESTAÑA 1: DASHBOARD / RESUMEN GENERAL */}
            {activeTab === "dashboard" && (
              <div className="space-y-6">
                <HoursDashboardCharts breakdown={breakdown} creditedCount={creditedCount} />

                <PreviousTeacherHoursCard
                  studentId={student.id}
                  previousHours={student.previousTeacherHours ?? 0}
                  isLocked={student.previousTeacherHoursLocked ?? false}
                  canEditStaff={true}
                  isStudent={false}
                  onChanged={load}
                />
              </div>
            )}

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
                  <p className={`text-sm font-medium ${message.ok ? "text-green-700" : "text-red-600"}`}>
                    {message.text}
                  </p>
                )}

                <section className="card">
                  <h3 className="mb-2 font-bold text-primary">Cargar / corregir asistencia de una clase</h3>
                  <p className="mb-3 text-sm text-slate-500">
                    Podés registrar clases reales (martes, jueves o viernes) a partir del 01-09-2026, incluyendo clases adelantadas dentro del período lectivo. Si dejás "Horas" vacío, se acredita el total del día (3hs).
                  </p>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[220px]">
                      <label className="label">Fecha de clase *</label>
                      <select
                        className="input text-sm"
                        value={newDate}
                        onChange={(e) => setNewDate(e.target.value)}
                      >
                        <option value="">Seleccionar clase (pasada o adelantada)...</option>
                        {classDates.map((cd: any) => (
                          <option key={cd.date} value={cd.date}>
                            {cd.dayOfWeek} {formatDateDMY(cd.date)}{cd.isFuture ? " (Adelantada)" : ""}
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
                  <h3 className="mb-4 text-lg font-bold text-primary">Historial de asistencias regulares</h3>
                  {attendances.length === 0 ? (
                    <p className="text-sm text-slate-500">Sin asistencias registradas.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="table-base">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Día</th>
                            <th>Horas</th>
                            <th>Origen</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {attendances.map((a) => {
                            const canDelete = !a.cancelled;

                            return (
                              <tr key={a.id} className={a.cancelled ? "text-slate-400" : undefined}>
                                <td>{formatDateDMY(a.date)}</td>
                                <td>{a.dayOfWeek}</td>
                                <td>
                                  {a.cancelled ? (
                                    <span className="badge bg-amber-100 text-amber-700">Clase anulada</span>
                                  ) : (
                                    `${a.hours}hs`
                                  )}
                                </td>
                                <td>{a.source === "ADMIN" ? "Carga manual" : "Autoregistrado"}</td>
                                <td className="text-right">
                                  {canDelete && !a.cancelled && (
                                    <button
                                      onClick={() => deleteAttendance(a.date)}
                                      className="text-xs text-red-600 hover:underline"
                                    >
                                      Quitar
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
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
