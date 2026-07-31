"use client";

import { useState } from "react";
import { formatoDosis, type Dosing } from "@/lib/supplements/catalog";

/**
 * Detalle de un suplemento: lo que llevas hoy y cómo añadir más.
 *
 * Existe porque al entrar solo se veía el selector puesto a cero: registrabas,
 * volvías a entrar, y la pantalla decía lo mismo que la primera vez. Saber
 * cuánto llevas es justo lo que hace falta para decidir si tomar más.
 *
 * Y para las pastillas importa más que para la proteína: tocar dos veces sin
 * darte cuenta te haría creer que tomaste dos dosis. Por eso, si ya lo tomaste
 * hoy, tocar la tarjeta abre esto en vez de registrar otra a ciegas.
 */

export type Toma = { id: string; dose: number | null; at: string };

export function SupplementDetail({
  icon,
  name,
  dosing,
  summary,
  takenToday,
  entries,
  busy,
  onAdd,
  onUndo,
  onCancel,
}: {
  icon: string;
  name: string;
  dosing: Dosing;
  /** «2.5 scoops», «5 g», «tomado». */
  summary: string;
  takenToday: boolean;
  entries: Toma[];
  busy: boolean;
  onAdd: (dose: number | null) => void;
  onUndo: (id: string) => void;
  onCancel: () => void;
}) {
  const pasos = dosing.kind === "steps" ? dosing : null;
  const [valor, setValor] = useState(pasos?.default ?? 1);

  const ajustar = (delta: number) => {
    if (!pasos) return;
    setValor((v) =>
      Math.min(pasos.max, Math.max(pasos.step, Number((v + delta).toFixed(2)))),
    );
  };

  return (
    <div className="space-y-4">
      {/* Mismo verde que la rejilla cuando ya hay algo: la pantalla confirma lo
          que la tarjeta decía en vez de empezar de cero. */}
      <div
        className={`rounded-2xl border px-5 py-6 text-center ${
          takenToday ? "border-done bg-done-surface" : "border-line bg-surface"
        }`}
      >
        <div className="text-4xl">{icon}</div>
        <p className="mt-3 text-[11px] font-medium tracking-[0.14em] text-muted uppercase">
          {name}
        </p>
        <p className="mt-2 font-mono text-[2rem] leading-none tabular-nums">
          {takenToday ? summary : "—"}
        </p>
        <p className="mt-2 text-xs text-muted">
          {takenToday ? "hoy" : "sin tomar hoy"}
        </p>
      </div>

      {entries.length > 0 && (
        <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {entries
            .slice()
            .sort((a, b) => b.at.localeCompare(a.at))
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
                  {e.dose !== null ? formatoDosis(e.dose, dosing) : "Tomado"}
                </span>
                <button
                  onClick={() => onUndo(e.id)}
                  disabled={busy}
                  aria-label="Deshacer esta toma"
                  className="px-1 text-muted transition hover:text-accent disabled:opacity-50"
                >
                  ×
                </button>
              </li>
            ))}
        </ol>
      )}

      {pasos ? (
        <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
          <p className="text-center text-sm text-muted">
            {takenToday ? "Añadir otra toma" : "¿Cuánto?"}
          </p>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => ajustar(-pasos.step)}
              disabled={busy || valor <= pasos.step}
              aria-label={`Quitar ${pasos.step} ${pasos.unit}`}
              className="flex size-16 shrink-0 items-center justify-center rounded-full border border-line text-3xl transition active:scale-90 disabled:opacity-30"
            >
              −
            </button>
            <div className="min-w-0 flex-1 text-center">
              <div className="font-mono text-4xl leading-none tabular-nums">{valor}</div>
              <div className="mt-1 text-xs text-muted">
                {valor === 1 ? pasos.unitLabel[0] : pasos.unitLabel[1]}
              </div>
            </div>
            <button
              type="button"
              onClick={() => ajustar(pasos.step)}
              disabled={busy || valor >= pasos.max}
              aria-label={`Añadir ${pasos.step} ${pasos.unit}`}
              className="flex size-16 shrink-0 items-center justify-center rounded-full border border-line text-3xl transition active:scale-90 disabled:opacity-30"
            >
              +
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="flex-1 rounded-xl border border-line py-3.5 text-sm text-muted transition active:scale-[0.98] disabled:opacity-50"
        >
          Volver
        </button>
        <button
          type="button"
          onClick={() => onAdd(pasos ? valor : null)}
          disabled={busy}
          className="flex-[2] rounded-xl bg-accent py-3.5 font-medium text-white transition active:scale-[0.98] disabled:opacity-50"
        >
          {pasos
            ? `Registrar ${formatoDosis(valor, dosing)}`
            : takenToday
              ? "Tomar otra vez"
              : "Registrar"}
        </button>
      </div>
    </div>
  );
}
