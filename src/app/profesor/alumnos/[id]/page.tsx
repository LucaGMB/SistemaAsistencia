"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import ExportHoursButton from "@/components/ExportHoursButton";
import RefreshIndicator from "@/components/RefreshIndicator";
import { useAutoRefresh } from "@/lib/useAutoRefresh";

type Attendance = {
  id: string;
  date: string;
  dayOfWeek: string;
  hours: number;
  source: string;
  cancelled: boolean;
};
type StudentInfo = {
  id: string; dni: string; nombre: string; apellido: string; active: boolean;
};

export default function AlumnoDetalleProfesor({ params }: { params: { id: string } }) {
  const { data: session } = useSession();
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentOpenClassDate, setCurrentOpenClassDate] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await fetch(`/api/students/${params.id}`).then((r) => r.json());
    setStudent(data.student ?? null);
    setAttendances(data.attendances ?? []);
    setTotalHours(data.totalHours ?? 0);
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
                  <h2 className="text-lg font-bold text-primary">{student.apellido}, {student.nombre}</h2>
                  <p className="text-sm text-slate-500">DNI {student.dni}</p>
                  <p className="mt-4 text-4xl font-extrabold text-accent">{totalHours}hs</p>
                  <p className="text-sm text-slate-500">
                    {creditedCount} {creditedCount === 1 ? "asistencia acreditada" : "asistencias acreditadas"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <ExportHoursButton label="Exportar horas (CSV)" studentId={student.id} />
                  <RefreshIndicator lastUpdate={lastUpdate} refreshing={refreshing} onRefresh={refreshNow} />
                </div>
              </div>
            </section>

            {message && (
              <p className={`text-sm font-medium ${message.ok ? "text-green-700" : "text-red-600"}`}>{message.text}</p>
            )}

            <section className="card">
              <h3 className="mb-2 font-bold text-primary">Cargar / corregir asistencia de una clase pasada</h3>
              <p className="mb-3 text-sm text-slate-500">
                Solo se pueden cargar fechas de martes, jueves o viernes que ya sucedieron y que no
                estén anuladas. Si dejás "Horas" vacío, se acredita el total del día (3hs).
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="label">Fecha</label>
                  <input type="date" className="input" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
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
              <h3 className="mb-4 text-lg font-bold text-primary">Historial de asistencias</h3>
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
                            {a.date === currentOpenClassDate ? (
                              <button className="btn-danger" onClick={() => deleteAttendance(a.date)}>
                                Eliminar
                              </button>
                            ) : null}
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
