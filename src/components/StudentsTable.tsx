"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { XMarkIcon } from "@/components/Icons";

export type StudentRow = {
  id: string;
  dni: string;
  nombre: string;
  apellido: string;
  role: string;
  active: boolean;
  totalHours: number;
  totalAttendances: number;
};

export default function StudentsTable({
  students,
  detailBasePath,
}: {
  students: StudentRow[];
  detailBasePath: string;
}) {
  const [search, setSearch] = useState("");
  const alumnos = students.filter((s) => s.role === "ALUMNO");

  const q = search.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const filtered = alumnos.filter((s) => {
    if (!q) return true;
    const full = `${s.apellido} ${s.nombre} ${s.dni}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return full.includes(q);
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <input
            type="text"
            className="input !py-1.5 !pl-3 !pr-8 text-sm"
            placeholder="Buscar por nombre, apellido o DNI..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              aria-label="Limpiar búsqueda"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500">
          Mostrando <strong className="text-slate-700">{filtered.length}</strong> de{" "}
          <strong className="text-slate-700">{alumnos.length}</strong> alumnos
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Alumno</th>
              <th>DNI</th>
              <th>Estado</th>
              <th>Asistencias</th>
              <th>Horas totales</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id}>
                <td className="font-medium">{s.apellido}, {s.nombre}</td>
                <td>{s.dni}</td>
                <td>
                  <span className={`badge ${s.active ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"}`}>
                    {s.active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td>{s.totalAttendances}</td>
                <td className="font-semibold text-accent-dark">{s.totalHours}hs</td>
                <td>
                  <Link href={`${detailBasePath}/${s.id}`} className="text-sm font-semibold text-primary hover:underline">
                    Ver detalle
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-slate-500 py-6">
                  {alumnos.length === 0
                    ? "No hay alumnos cargados todavía."
                    : `No se encontraron alumnos con "${search}".`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
