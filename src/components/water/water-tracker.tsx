"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logWater, undoWater } from "@/app/agua/actions";
import { useVoiceTarget } from "@/components/voice/registry";
import { matchOption } from "@/lib/match-option";
import { formatoAgua } from "@/lib/water/units";

/**
 * Registro de agua.
 *
 * Es el registro más frecuente del sistema: ocho o diez veces al día frente a
 * una del peso. Eso manda sobre todo el diseño — un flujo de tres toques serían
 * treinta toques diarios.
 *
 * Por eso NO es un flujo guiado: es una sola pantalla donde tocas y te quedas.
 * Registrar no navega a ningún sitio; el anillo se actualiza y ya puedes tocar
 * otra vez. Es el mismo principio que el grupo muscular pegajoso del gimnasio,
 * llevado al extremo.
 */

export type Entry = { id: string; ml: number; at: string; vessel: string | null };

export function WaterTracker({
  totalMl,
  goalMl,
  excellentMl,
  presets,
  entries,
}: {
  totalMl: number;
  goalMl: number;
  excellentMl: number;
  presets: { ml: number; label: string; icon: string }[];
  entries: Entry[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  /** Lo recién tocado, para que el anillo responda antes que la red. */
  const [optimista, setOptimista] = useState(0);

  const total = totalMl + optimista;
  const cumplida = total >= goalMl;
  const excelente = total >= excellentMl;

  function registrar(ml: number, vessel: string | null) {
    setError(null);
    // El anillo se mueve YA. Con diez registros al día, esperar a la red en
    // cada uno convierte la pantalla en algo que se siente lento.
    setOptimista((prev) => prev + ml);
    startTransition(async () => {
      const zona = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const r = await logWater(ml, vessel, zona);
      if (!r.ok) {
        setOptimista((prev) => prev - ml);
        setError(r.error);
      } else {
        setOptimista(0);
        router.refresh();
      }
    });
  }

  function deshacer(id: string, ml: number) {
    setError(null);
    setOptimista((prev) => prev - ml);
    startTransition(async () => {
      const r = await undoWater(id);
      if (!r.ok) {
        setOptimista((prev) => prev + ml);
        setError(r.error);
      } else {
        setOptimista(0);
        router.refresh();
      }
    });
  }

  // «un vaso», «medio litro», «botella». Con las manos mojadas en la cocina,
  // hablar gana a apuntar.
  useVoiceTarget("Di cuánto · «un vaso»", (texto) => {
    const elegido = matchOption(texto, [
      ...presets.map((p) => ({
        value: String(p.ml),
        label: `${p.label} ${p.ml >= 1000 ? `${p.ml / 1000} litro litros` : `${p.ml} mililitros`}`,
      })),
      { value: "500", label: "medio litro media botella" },
      { value: "1000", label: "un litro litro entero" },
      { value: "250", label: "vaso vasito trago" },
    ]);
    if (!elegido) return false;
    const ml = Number(elegido.value);
    registrar(ml, presets.find((p) => p.ml === ml)?.label.toLowerCase() ?? null);
    return true;
  });

  return (
    <div className="space-y-6">
      <Anillo
        total={total}
        goalMl={goalMl}
        excellentMl={excellentMl}
        cumplida={cumplida}
        excelente={excelente}
      />

      <div className="grid grid-cols-2 gap-2.5">
        {presets.map((p) => (
          <button
            key={p.ml}
            disabled={pending}
            onClick={() => registrar(p.ml, p.label.toLowerCase())}
            className="flex flex-col items-center gap-1 rounded-2xl border border-line bg-surface py-5 transition active:scale-[0.96] disabled:opacity-50"
          >
            <span className="text-3xl">{p.icon}</span>
            <span className="text-sm font-medium">{p.label}</span>
            <span className="font-mono text-[11px] tabular-nums text-muted">
              {p.ml >= 1000 ? `${p.ml / 1000} L` : `${p.ml} ml`}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <p role="status" className="rounded-lg bg-accent px-4 py-3 text-center font-medium text-white">
          {error}
        </p>
      )}

      {entries.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-medium tracking-[0.12em] text-muted uppercase">
            Hoy · {entries.length}
          </h2>
          <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {entries
              .slice()
              .reverse()
              .map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="font-mono text-sm tabular-nums text-muted">
                    {new Date(e.at).toLocaleTimeString("es-MX", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </span>
                  <span className="flex-1 text-sm">
                    {e.vessel ? e.vessel.charAt(0).toUpperCase() + e.vessel.slice(1) : "Agua"}
                  </span>
                  <span className="font-mono text-sm tabular-nums">
                    {e.ml >= 1000 ? `${e.ml / 1000} L` : `${e.ml} ml`}
                  </span>
                  {/* Deshacer, no borrar: el registro se anula con otro evento
                      (I-02). Con diez toques al día, el toque de más es
                      cuestión de tiempo. */}
                  <button
                    onClick={() => deshacer(e.id, e.ml)}
                    disabled={pending}
                    aria-label={`Deshacer ${e.ml} ml`}
                    className="text-muted transition hover:text-accent disabled:opacity-50"
                  >
                    ×
                  </button>
                </li>
              ))}
          </ol>
        </section>
      )}
    </div>
  );
}

/**
 * Anillo de progreso.
 *
 * Dos umbrales, no uno: la meta (2 L) y lo excelente (3 L). El tramo entre
 * ambos se dibuja como un segundo arco más tenue — así se ve que hay algo
 * después de cumplir, en vez de una barra llena que ya no dice nada.
 */
function Anillo({
  total,
  goalMl,
  excellentMl,
  cumplida,
  excelente,
}: {
  total: number;
  goalMl: number;
  excellentMl: number;
  cumplida: boolean;
  excelente: boolean;
}) {
  const R = 88;
  const CIRC = 2 * Math.PI * R;

  const hastaMeta = Math.min(total, goalMl) / goalMl;
  const extra = Math.max(0, Math.min(total, excellentMl) - goalMl) / (excellentMl - goalMl);

  return (
    <div className="relative mx-auto flex size-56 items-center justify-center">
      <svg viewBox="0 0 200 200" className="absolute size-full -rotate-90">
        <circle
          cx="100" cy="100" r={R} fill="none"
          className="stroke-line" strokeWidth="12"
        />
        {/* Tramo de bonus, detrás: solo se ve al pasar la meta. */}
        {extra > 0 && (
          <circle
            cx="100" cy="100" r={R} fill="none"
            className="stroke-done/40" strokeWidth="12" strokeLinecap="round"
            strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - extra)}
          />
        )}
        <circle
          cx="100" cy="100" r={R} fill="none"
          strokeWidth="12" strokeLinecap="round"
          className={`transition-all duration-500 ${cumplida ? "stroke-done" : "stroke-accent"}`}
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - hastaMeta)}
        />
      </svg>

      <div className="relative text-center">
        <div className="font-mono text-4xl tabular-nums">{formatoAgua(total)}</div>
        <div className="mt-1 text-xs text-muted">
          de {formatoAgua(goalMl)}
        </div>
        {excelente ? (
          <div className="mt-2 text-sm font-medium text-done">Excelente</div>
        ) : cumplida ? (
          <div className="mt-2 text-sm font-medium text-done">
            Meta cumplida · {formatoAgua(excellentMl - total)} para excelente
          </div>
        ) : (
          <div className="mt-2 text-sm text-muted">
            faltan {formatoAgua(goalMl - total)}
          </div>
        )}
      </div>
    </div>
  );
}
