"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import TopBar from "@/components/TopBar";
import StudentsTable, { StudentRow } from "@/components/StudentsTable";
import NewUserForm from "@/components/NewUserForm";
import LogsTable from "@/components/LogsTable";
import CancelledClasses from "@/components/CancelledClasses";
import ClassRoster from "@/components/ClassRoster";
import ExportHoursButton from "@/components/ExportHoursButton";
import ClassCodeManager from "@/components/ClassCodeManager";

type Tab = "alumnos" | "porClase" | "clases" | "nuevo" | "logs";

export default function AdminPage() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<Tab>("alumnos");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    const data = await fetch("/api/admin/users").then((r) => r.json());
    setStudents(data.users ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  if (!session) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar nombre={session.user.nombre} apellido={session.user.apellido} roleLabel="Administrador" />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap gap-2">
          {([
            ["alumnos", "Alumnos"],
            ["porClase", "Por clase"],
            ["clases", "Anular clases"],
            ["nuevo", "Nuevo usuario"],
            ["logs", "Logs del sistema"],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                tab === key ? "bg-primary text-white" : "border border-primary/30 bg-white text-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "alumnos" && (
          <>
            <section className="card">
              <h2 className="text-lg font-bold text-primary mb-2">Código de Aula</h2>
              <ClassCodeManager />
            </section>
            <section className="card">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-primary">Alumnos</h2>
                <ExportHoursButton label="Exportar horas de todos (CSV)" scope="all" />
              </div>
              {loading ? (
                <p className="text-slate-500">Cargando...</p>
              ) : (
                <StudentsTable students={students} detailBasePath="/admin/alumnos" />
              )}
            </section>
          </>
        )}

        {tab === "porClase" && (
          <section className="card">
            <h2 className="mb-4 text-lg font-bold text-primary">Asistencia por clase</h2>
            <ClassRoster canEdit />
          </section>
        )}

        {tab === "clases" && (
          <section className="card">
            <h2 className="mb-4 text-lg font-bold text-primary">Anular clases</h2>
            <CancelledClasses onChange={loadStudents} />
          </section>
        )}

        {tab === "nuevo" && (
          <section className="card">
            <h2 className="mb-4 text-lg font-bold text-primary">Crear usuario</h2>
            <NewUserForm onCreated={loadStudents} />
          </section>
        )}

        {tab === "logs" && (
          <section className="card">
            <h2 className="mb-4 text-lg font-bold text-primary">Logs del sistema</h2>
            <LogsTable />
          </section>
        )}
      </main>
    </div>
  );
}
