"use client";

import { useState, useTransition } from "react";
import { logEvent } from "@/app/actions";

/**
 * Cierra una actividad abierta.
 *
 * Vive fuera del flujo guiado a propósito: cerrar algo que ya está corriendo
 * es una confirmación, no una pregunta. Meterlo en un flujo de pantallas
 * añadiría toques a lo que debe ser uno.
 */
export function EndActivity({
  activity,
  startedAt,
}: {
  activity: string;
  startedAt: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const minutos = Math.max(
    0,
    Math.round((Date.now() - new Date(startedAt).getTime()) / 60000),
  );

  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await logEvent("activity.ended", { activity, minutes: minutos });
          if (!r.ok) setError(r.error);
        })
      }
      className="flex w-full items-center justify-between rounded-xl border border-accent bg-surface px-4 py-4 transition active:scale-[0.99] disabled:opacity-50"
    >
      <span className="font-medium">
        {error ?? `Terminar ${activity}`}
      </span>
      <span className="font-mono text-sm tabular-nums text-muted">{minutos} min</span>
    </button>
  );
}
