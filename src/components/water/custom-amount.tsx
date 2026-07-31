"use client";

import { useState } from "react";

/**
 * Cantidad libre.
 *
 * Faltaba, y se nota en cuanto bebes de algo que no son 250, 500, 750 o 1000:
 * una botella de 600, media taza, lo que quede en el vaso. Sin esto había que
 * mentir con el preset más cercano, y un total en el que has mentido deja de
 * servir para nada.
 *
 * Con pasos de 50 ml y no con teclado: el teclado numérico del móvil tapa media
 * pantalla y pide precisión que nadie tiene sobre un vaso a medias. Se puede
 * teclear igualmente, para el caso de la botella que dice 600 en la etiqueta.
 */

const PASO = 50;
const MINIMO = 50;
const MAXIMO = 3000;

export function CustomAmount({
  onConfirm,
  onCancel,
  busy,
}: {
  onConfirm: (ml: number) => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const [ml, setMl] = useState(300);

  const ajustar = (delta: number) =>
    setMl((v) => Math.min(MAXIMO, Math.max(MINIMO, v + delta)));

  return (
    <div className="space-y-3 rounded-2xl border border-accent bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => ajustar(-PASO)}
          disabled={busy || ml <= MINIMO}
          aria-label={`Quitar ${PASO} mililitros`}
          className="flex size-14 shrink-0 items-center justify-center rounded-full border border-line text-2xl transition active:scale-90 disabled:opacity-30"
        >
          −
        </button>

        <label className="min-w-0 flex-1 text-center">
          <input
            type="number"
            inputMode="numeric"
            value={ml}
            min={MINIMO}
            max={MAXIMO}
            step={PASO}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) setMl(n);
            }}
            className="w-full bg-transparent text-center font-mono text-3xl tabular-nums outline-none"
          />
          <span className="block text-xs text-muted">mililitros</span>
        </label>

        <button
          type="button"
          onClick={() => ajustar(PASO)}
          disabled={busy || ml >= MAXIMO}
          aria-label={`Añadir ${PASO} mililitros`}
          className="flex size-14 shrink-0 items-center justify-center rounded-full border border-line text-2xl transition active:scale-90 disabled:opacity-30"
        >
          +
        </button>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="flex-1 rounded-xl border border-line py-3 text-sm text-muted transition active:scale-[0.98] disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => onConfirm(Math.round(ml))}
          disabled={busy || ml < MINIMO || ml > MAXIMO}
          className="flex-[2] rounded-xl bg-accent py-3 font-medium text-white transition active:scale-[0.98] disabled:opacity-50"
        >
          Registrar {ml} ml
        </button>
      </div>
    </div>
  );
}
