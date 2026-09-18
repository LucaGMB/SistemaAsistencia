"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import TopBar from "@/components/TopBar";
import ExportHoursButton from "@/components/ExportHoursButton";
import WeekCalendar from "@/components/WeekCalendar";
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
  CheckIcon,
} from "@/components/Icons";
import { formatDateDMY } from "@/lib/dateFormat";
import type { AttendanceStatus } from "@/lib/schedule";
import type { HourBreakdown } from "@/lib/hours";

type Attendance = {
  id: string;
  date: string;
  dayOfWeek: string;
  hours: number;
  source: string;
  cancelled: boolean;
};

const DEFAULT_BREAKDOWN: HourBreakdown = {
  classHours: 0,
  priorHours: 0,
  coursesHours: 0,
  internshipHours: 0,
  total: 0,
};

export default function AlumnoPage() {
  const { data: session } = useSession();
  const [status, setStatus] = useState<AttendanceStatus | null>(null);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [breakdown, setBreakdown] = useState<HourBreakdown>(DEFAULT_BREAKDOWN);
  const [hourConcepts, setHourConcepts] = useState<HourConceptItem[]>([]);
  const [internships, setInternships] = useState<InternshipItem[]>([]);
  const [previousTeacherHours, setPreviousTeacherHours] = useState(0);
  const [previousTeacherHoursLocked, setPreviousTeacherHoursLocked] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "pasantias" | "clases" | "cursos">("dashboard");
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [statusRes, attRes] = await Promise.all([
      fetch("/api/attendance/status").then((r) => r.json()),
      fetch("/api/attendance").then((r) => r.json()),
    ]);
    setStatus(statusRes.status);
    setAlreadyRegistered(statusRes.alreadyRegistered);
    setAttendances(attRes.attendances ?? []);
    setPreviousTeacherHours(attRes.previousTeacherHours ?? 0);
    setPreviousTeacherHoursLocked(attRes.previousTeacherHoursLocked ?? false);
    setBreakdown(
      attRes.breakdown ?? {
        classHours: 0,
        priorHours: 0,
        coursesHours: 0,
        internshipHours: 0,
        total: attRes.totalHours ?? 0,
      }
    );
    setHourConcepts(attRes.hourConcepts ?? []);
    setInternships(attRes.internships ?? []);
    setLoading(false);
    return (attRes.totalHours ?? 0) as number;
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Si le corrigen una asistencia, el alumno ve sus horas al día sin recargar.
  useAutoRefresh(load);

  async function handleRegister(code: string) {
    setRegistering(true);
    setMessage(null);
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    setRegistering(false);
    if (!res.ok) {
      setMessage(data.error ?? "No se pudo registrar la asistencia.");
      return;
    }
    setMessage("Asistencia registrada correctamente.");
    await load();
  }

  if (!session) return null;

  const creditedCount = attendances.filter((a) => !a.cancelled).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar nombre={session.user.nombre} apellido={session.user.apellido} roleLabel="Alumno" />

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        {/* Navegación Modular Principal por Pestañas */}
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
            onClick={() => setActiveTab("clases")}
            className={`flex-1 py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTab === "clases"
                ? "bg-primary text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <CalendarIcon className="w-4 h-4 shrink-0" />
            <span>Clases</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                activeTab === "clases" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
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
            {/* Asistencia de hoy */}
            <section className="card">
              <h2 className="mb-4 text-lg font-bold text-primary">Asistencia de hoy</h2>
              {loading || !status ? (
                <p className="text-slate-500">Cargando...</p>
              ) : (
                <AttendanceCard
                  status={status}
                  alreadyRegistered={alreadyRegistered}
                  onRegister={handleRegister}
                  registering={registering}
                />
              )}
              {message && <p className="mt-3 text-sm font-medium text-primary">{message}</p>}
            </section>

            {/* Gráfico visual proporcional de horas y métricas */}
            <HoursDashboardCharts breakdown={breakdown} creditedCount={creditedCount} />

            {/* Horas del profesor anterior (Carga única bloqueable) */}
            <PreviousTeacherHoursCard
              studentId={session.user.id}
              previousHours={previousTeacherHours}
              isLocked={previousTeacherHoursLocked}
              canEditStaff={false}
              isStudent={true}
              onChanged={load}
            />

            {/* Exportación CSV */}
            <section className="card flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-primary text-sm">Comprobante de Horas</h3>
                <p className="text-xs text-slate-500">
                  Descargá un archivo CSV con el detalle completo de tus horas acreditadas.
                </p>
              </div>
              <ExportHoursButton label="Exportar mis horas (CSV)" />
            </section>
          </div>
        )}

        {/* PESTAÑA 2: PASANTÍAS */}
        {activeTab === "pasantias" && (
          <InternshipsManager
            studentId={session.user.id}
            internships={internships}
            canEdit={true}
            currentUserId={session.user.id}
            currentUserRole={session.user.role}
            onChanged={load}
          />
        )}

        {/* PESTAÑA 3: CLASES PRESENCIALES */}
        {activeTab === "clases" && (
          <div className="space-y-6">
            <section className="card">
              <h2 className="mb-4 text-lg font-bold text-primary">Mi semana en Prácticas</h2>
              <WeekCalendar />
            </section>

            <section className="card">
              <h2 className="mb-4 text-lg font-bold text-primary">Historial de asistencias regulares</h2>
              {attendances.length === 0 ? (
                <p className="text-sm text-slate-500">Todavía no registraste ninguna asistencia.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table-base">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Día</th>
                        <th>Horas</th>
                        <th>Origen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendances.map((a) => (
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* PESTAÑA 4: CURSOS Y TALLERES */}
        {activeTab === "cursos" && (
          <HourConceptsManager
            studentId={session.user.id}
            concepts={hourConcepts}
            canEdit={true}
            currentUserId={session.user.id}
            currentUserRole={session.user.role}
            onChanged={load}
          />
        )}
      </main>
    </div>
  );
}

function AttendanceCard({
  status,
  alreadyRegistered,
  onRegister,
  registering,
}: {
  status: AttendanceStatus;
  alreadyRegistered: boolean;
  onRegister: (code: string) => void;
  registering: boolean;
}) {
  const [code, setCode] = useState("");

  if (status.state === "NO_CLASS_TODAY") {
    return <p className="text-slate-600">Hoy no hay clase de Prácticas Profesionalizantes.</p>;
  }

  if (status.state === "CANCELLED") {
    return (
      <p className="text-amber-700">
        La clase de hoy ({status.dayOfWeek}, {status.start} a {status.end}) fue anulada
        {status.reason ? `: ${status.reason}` : ""}. No corresponde registrar asistencia.
      </p>
    );
  }

  if (status.state === "NOT_STARTED") {
    return (
      <p className="text-slate-600">
        Hoy ({status.dayOfWeek}) la clase es de <strong>{status.start}</strong> a{" "}
        <strong>{status.end}</strong>. Vas a poder registrar tu asistencia cuando comience.
      </p>
    );
  }

  if (status.state === "CLOSED") {
    return (
      <p className="text-slate-600">
        La clase de hoy ({status.start} a {status.end}) ya finalizó y no llegaste a registrar tu
        asistencia. Consultá con tu profesor/a si necesitás una corrección.
      </p>
    );
  }

  if (alreadyRegistered) {
    return (
      <p className="font-medium text-green-700 inline-flex items-center gap-1.5">
        <CheckIcon className="w-4 h-4 text-green-700 shrink-0" />
        <span>Ya registraste tu asistencia de hoy ({status.dayOfWeek}, +{status.hours}hs).</span>
      </p>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRegister(code);
  };

  return (
    <div>
      <p className="mb-3 text-slate-600">
        La clase de hoy ({status.dayOfWeek}, {status.start} a {status.end}) está en curso. Ingresá el
        código de 4 dígitos provisto por el profesor para registrar tu asistencia (+{status.hours}hs).
      </p>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          maxLength={4}
          pattern="\d{4}"
          placeholder="Ej: 1234"
          className="input !w-32 text-center text-lg tracking-widest font-mono"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          required
        />
        <button className="btn-primary" type="submit" disabled={registering || code.length !== 4}>
          {registering ? "Registrando..." : "Registrar asistencia"}
        </button>
      </form>
    </div>
  );
}
