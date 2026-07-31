"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteQuickEntry } from "@/app/actions";

/**
 * Lo que ves al entrar en un flujo que ya completaste hoy.
 *
 * Antes te ofrecía registrarlo otra vez como si nada, y la única forma de saber
 * si ya lo habías hecho era volver a Hoy. Ahora enseña el dato y ofrece las dos
 * cosas que de verdad querrías: cambiarlo o quitarlo.
 *
 * Es el mismo lenguaje que la tarjeta de Hoy —verde, marca de hecho— para que
 * la pantalla confirme lo que la rejilla ya decía en vez de contradecirlo.
 */
export function AlreadyLogged({
  icon,
  label,
  summary,
  loggedAt,
  eventId,
  onEdit,
}: {
  icon: string;
  label: string;
  /** El dato: «07:30», «78 kg», «7h 30m». */
  summary: string;
  /** Cuándo se pulsó el botón. */
  loggedAt: string;
  eventId: string;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-done bg-done-surface p-8 text-center">
        <div className="text-5xl">{icon}</div>
        <p className="mt-3 text-sm text-muted">{label}</p>
        <p className="mt-1 font-mono text-4xl leading-none tabular-nums">{summary}</p>
        <p className="mt-3 text-xs text-muted">Registrado a las {loggedAt}</p>
      </div>

      {confirmando ? (
        <div className="space-y-2 rounded-xl border border-accent bg-surface p-4">
          <p className="text-center text-sm">
            ¿Quitar este registro? Deja de contar en el día.
          </p>
          <div className="flex gap-2">
            <button
              disabled={pending}
              onClick={() => setConfirmando(false)}
              className="flex-1 rounded-xl border border-line py-3 text-sm text-muted disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await deleteQuickEntry(eventId);
                  if (!r.ok) setError(r.error);
                  else router.refresh();
                })
              }
              className="flex-[2] rounded-xl bg-accent py-3 font-medium text-white disabled:opacity-50"
            >
              Quitar
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            onClick={onEdit}
            disabled={pending}
            className="w-full rounded-xl bg-foreground py-4 font-medium text-background transition active:scale-[0.98] disabled:opacity-50"
          >
            Cambiar
          </button>
          <button
            onClick={() => setConfirmando(true)}
            disabled={pending}
            className="w-full py-3 text-sm text-muted disabled:opacity-50"
          >
            Quitar
          </button>
        </>
      )}

      {error && (
        <p role="status" className="text-center text-sm text-accent">
          {error}
        </p>
      )}
    </div>
  );
}
