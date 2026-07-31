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
  detail,
  note,
  loggedAt,
  eventId,
  onEdit,
}: {
  icon: string;
  label: string;
  /** El dato, corto: «07:30», «78 kg», «7h 30m». */
  summary: string;
  /** Matiz, en pequeño: «desde las 23:00». */
  detail?: string;
  /** Lo que escribiste tú. */
  note?: string;
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
      {/* El dato manda: grande y solo. El resto son notas al pie, en el orden
          en que se preguntan — qué es, cuánto, el matiz, y cuándo se guardó.
          Antes iba todo en la línea grande y en un móvil se partía en dos. */}
      <div className="rounded-2xl border border-done bg-done-surface px-5 py-7 text-center">
        <div className="text-4xl">{icon}</div>

        <p className="mt-3 text-[11px] font-medium tracking-[0.14em] text-muted uppercase">
          {label}
        </p>

        <p className="mt-2 font-mono text-[2.25rem] leading-none tabular-nums">
          {summary}
        </p>

        {detail && <p className="mt-2 text-sm text-muted">{detail}</p>}

        {note && (
          // A la IZQUIERDA y con comilla: es prosa, y la prosa centrada se lee
          // mal en cuanto pasa de una línea. La barra lateral la separa de los
          // datos sin encerrarla en otra caja dentro de la caja.
          <blockquote className="mt-5 border-l-2 border-done/40 pl-3 text-left text-sm leading-relaxed break-words whitespace-pre-line">
            {note}
          </blockquote>
        )}

        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted">
          <span
            aria-hidden
            className="inline-flex size-4 items-center justify-center rounded-full bg-done text-[9px] font-bold text-white"
          >
            ✓
          </span>
          Guardado a las {loggedAt}
        </p>
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
