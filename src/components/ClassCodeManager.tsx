"use client";

import { useEffect, useState, useCallback } from "react";

export default function ClassCodeManager() {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCode = useCallback(async () => {
    try {
      const res = await fetch("/api/classes/code");
      const data = await res.json();
      if (res.ok) {
        setCode(data.code);
      }
    } catch {
      // Ignorar errores en lectura pasiva
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCode();
  }, [fetchCode]);

  async function generateCode() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/classes/code", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo generar el código.");
      } else {
        setCode(data.code);
      }
    } catch {
      setError("Error de conexión al generar el código.");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return <p className="text-slate-500 text-sm">Cargando código de clase...</p>;
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 my-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-primary">Código de asistencia del día</h3>
          <p className="text-xs text-slate-600">
            Comparte este código de 4 dígitos con los alumnos en el aula para que puedan marcar presente.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {code ? (
            <div className="bg-white border-2 border-primary rounded-lg px-4 py-1.5 text-center">
              <span className="text-2xl font-extrabold tracking-widest text-primary font-mono">
                {code}
              </span>
            </div>
          ) : (
            <span className="text-sm font-medium text-slate-500 italic">No generado</span>
          )}
          <button
            onClick={generateCode}
            disabled={generating}
            className="btn-primary text-sm !py-2"
          >
            {generating
              ? "Generando..."
              : code
              ? "Regenerar código"
              : "Generar código"}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
