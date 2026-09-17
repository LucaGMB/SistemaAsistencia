"use client";

import { useEffect, useState } from "react";

type LogRow = {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
  actor: { nombre: string; apellido: string; dni: string; role: string } | null;
  target: { nombre: string; apellido: string; dni: string; role: string } | null;
};

const ACTION_LABELS: Record<string, string> = {
  LOGIN: "Inicio de sesión",
  LOGIN_FAILED: "Intento de login fallido",
  LOGIN_BLOCKED: "Login bloqueado por intentos fallidos",
  ATTENDANCE_SELF_CREATE: "Asistencia autoregistrada",
  ATTENDANCE_ADMIN_CREATE: "Asistencia creada por admin",
  ATTENDANCE_ADMIN_UPDATE: "Asistencia modificada por admin",
  ATTENDANCE_ADMIN_DELETE: "Asistencia eliminada por admin",
  CLASS_CANCELLED: "Clase anulada",
  CLASS_REACTIVATED: "Clase reactivada",
  HOURS_EXPORTED: "Exportación de horas (CSV)",
  USER_CREATED: "Usuario creado",
  USER_UPDATED: "Usuario actualizado",
  USER_DELETED: "Usuario eliminado (CLI)",
  PASSWORD_CHANGED_BY_USER: "Cambio de contraseña propia",
};

export default function LogsTable() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/logs")
      .then((r) => r.json())
      .then((data) => setLogs(data.logs ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-500">Cargando...</p>;

  return (
    <div className="overflow-x-auto">
      <table className="table-base">
        <thead>
          <tr>
            <th>Fecha/hora</th>
            <th>Acción</th>
            <th>Realizado por</th>
            <th>Sobre</th>
            <th>Detalle</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td className="whitespace-nowrap">{new Date(log.createdAt).toLocaleString("es-AR")}</td>
              <td>{ACTION_LABELS[log.action] ?? log.action}</td>
              <td>{log.actor ? `${log.actor.apellido}, ${log.actor.nombre} (${log.actor.dni})` : "—"}</td>
              <td>{log.target ? `${log.target.apellido}, ${log.target.nombre} (${log.target.dni})` : "—"}</td>
              <td className="text-slate-500">{log.details ?? ""}</td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-slate-500">Sin actividad registrada.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
