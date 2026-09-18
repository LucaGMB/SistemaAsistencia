"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import TopBar from "@/components/TopBar";
import ExportHoursButton from "@/components/ExportHoursButton";
import WeekCalendar from "@/components/WeekCalendar";
import Celebration from "@/components/Celebration";
import HourBreakdownCard from "@/components/HourBreakdownCard";
import HourConceptsManager, { HourConceptItem } from "@/components/HourConceptsManager";
import InternshipsManager, { InternshipItem } from "@/components/InternshipsManager";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { crossedMilestone, hoursToNextMilestone, milestonesReached } from "@/lib/milestones";
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
  const [totalHours, setTotalHours] = useState(0);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState<number | null>(null);

  const load = useCallback(async () => {
    const [statusRes, attRes] = await Promise.all([
      fetch("/api/attendance/status").then((r) => r.json()),
      fetch("/api/attendance").then((r) => r.json()),
    ]);
    setStatus(statusRes.status);
    setAlreadyRegistered(statusRes.alreadyRegistered);
    setAttendances(attRes.attendances ?? []);
    setTotalHours(attRes.totalHours ?? 0);
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
  // No dispara festejos: esos son solo para el momento en que él registra.
  useAutoRefresh(load);

  async function handleRegister(code: string) {
    setRegistering(true);
    setMessage(null);
    const previousHours = totalHours;
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
    setMessage("¡Asistencia registrada correctamente!");
    const newHours = await load();
    // El festejo se dispara solo en el momento de cruzar el hito, no cada
    // vez que se abre la página.
    if (crossedMilestone(previousHours, newHours)) {
      setCelebrating(newHours);
    }
  }

  if (!session) return null;

  const creditedCount = attendances.filter((a) => !a.cancelled).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar nombre={session.user.nombre} apellido={session.user.apellido} roleLabel="Alumno" />

      {celebrating !== null && (
        <Celebration
          hours={celebrating}
          milestone={milestonesReached(celebrating)}
          onDone={() => setCelebrating(null)}
        />
      )}

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
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

        {/* Desglose de Horas */}
        <HourBreakdownCard breakdown={breakdown} creditedCount={creditedCount} />

        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              {/* Solo se habla de festejos: no se muestra la meta total. */}
              <p className="text-sm font-medium text-primary">
                {milestonesReached(totalHours) > 0 && (
                  <span className="mr-2" aria-hidden="true">
                    {"🎉".repeat(Math.min(milestonesReached(totalHours), 8))}
                  </span>
                )}
                {milestonesReached(totalHours) === 0
                  ? `Te faltan ${hoursToNextMilestone(totalHours)}hs para tu primer festejo`
                  : `${milestonesReached(totalHours)} ${
                      milestonesReached(totalHours) === 1 ? "festejo" : "festejos"
                    } · próximo en ${hoursToNextMilestone(totalHours)}hs`}
              </p>
            </div>
            <ExportHoursButton label="Exportar mis horas (CSV)" />
          </div>
        </section>

        {/* Conceptos Individuales (horas previas, cursos) */}
        <HourConceptsManager
          studentId={session.user.id}
          concepts={hourConcepts}
          canEdit={false}
          onChanged={load}
        />

        {/* Pasantías externas */}
        <InternshipsManager
          studentId={session.user.id}
          internships={internships}
          canEdit={false}
          onChanged={load}
        />

        <section className="card">
          <h2 className="mb-4 text-lg font-bold text-primary">Mi semana en Prácticas</h2>
          <WeekCalendar />
        </section>

        <section className="card">
          <h2 className="mb-4 text-lg font-bold text-primary">Historial de asistencias</h2>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
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
      <p className="font-medium text-green-700">
        ✔ Ya registraste tu asistencia de hoy ({status.dayOfWeek}, +{status.hours}hs).
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
