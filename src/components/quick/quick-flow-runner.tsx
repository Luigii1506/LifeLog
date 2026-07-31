"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { logQuickFlow } from "@/app/actions";
import { clearDraft, readDraft, writeDraft } from "@/lib/quick/draft";
import { AlreadyLogged } from "./already-logged";
import {
  GuidedFlow,
  type FlowAnswer,
  type FlowStep,
} from "@/components/guided/guided-flow";

/**
 * Ejecuta un flujo lineal de pasos y emite un evento al terminar.
 *
 * Los dominios ligeros no ramifican: preguntan dos o tres cosas y guardan. El
 * `build` del payload vive en el servidor, así que aquí solo se recogen las
 * respuestas y se envían.
 *
 * Cada paso deja un borrador en el navegador. Salir a media pregunta y volver
 * te devuelve donde estabas, igual que el gimnasio te devuelve al mismo grupo
 * muscular. La diferencia es dónde vive el progreso: una serie es un hecho y
 * va a la base; media respuesta no es nada y se queda en local (ver
 * `lib/quick/draft.ts`).
 */
export function QuickFlowRunner({
  flowId,
  icon,
  label,
  done,
  steps,
  existing,
}: {
  flowId: string;
  icon: string;
  label: string;
  done: string;
  steps: FlowStep[];
  /** Lo ya registrado hoy. Si existe, se enseña en vez de preguntar. */
  existing?: { eventId: string; summary: string; loggedAt: string } | null;
}) {
  const [indice, setIndice] = useState(0);
  const [respuestas, setRespuestas] = useState<Record<string, string | number>>({});
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  /** Se retoma un borrador: se avisa una vez y se calla. */
  const [retomado, setRetomado] = useState(false);
  /**
   * Se está corrigiendo lo de hoy.
   *
   * Guardar entonces ANULA el registro anterior en vez de apilar otro (I-02).
   * Para quien usa la app es una edición; el log conserva ambos por si la
   * corrección se comiera el dato.
   */
  const [corrigiendo, setCorrigiendo] = useState(false);

  // El borrador se lee tras montar, nunca durante el render: el servidor no
  // puede ver localStorage y la diferencia rompería la hidratación.
  useEffect(() => {
    const draft = readDraft(flowId);
    if (!draft) return;
    const paso = Math.min(draft.step, steps.length - 1);
    if (paso <= 0 && Object.keys(draft.answers).length === 0) return;
    setIndice(paso);
    setRespuestas(draft.answers);
    setRetomado(true);
    // steps y flowId no cambian mientras el componente vive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function guardar(finales: Record<string, string | number>) {
    startTransition(async () => {
      // La zona la sabe el NAVEGADOR. El servidor corre en UTC y usar la
      // suya desplazaba cada evento siete horas.
      const zona = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const r = await logQuickFlow(
        flowId,
        finales,
        zona,
        corrigiendo ? (existing?.eventId ?? null) : null,
      );
      if (!r.ok) setError(r.error);
      else {
        // El borrador muere con el evento: si sobreviviera, la tarjeta diría
        // «a medias» sobre algo que ya está registrado.
        clearDraft(flowId);
        setListo(true);
      }
    });
  }

  function avanzar(respuesta: FlowAnswer) {
    setError(null);
    const paso = steps[indice];

    const siguientes = { ...respuestas };
    if (respuesta.kind === "choice") siguientes[paso.id] = respuesta.value;
    else if (respuesta.kind === "custom") siguientes[paso.id] = respuesta.value;
    else if (respuesta.kind === "quantity") siguientes[paso.id] = respuesta.value;
    else if (respuesta.kind === "time") siguientes[paso.id] = respuesta.value;
    // "skip" no escribe nada: el campo queda ausente, que es distinto de vacío.

    setRespuestas(siguientes);
    setRetomado(false);

    if (indice + 1 < steps.length) {
      setIndice(indice + 1);
      writeDraft(flowId, indice + 1, siguientes);
    } else {
      guardar(siguientes);
    }
  }

  // Ya registrado hoy y sin intención de cambiarlo: se enseña, no se pregunta.
  if (existing && !corrigiendo && !listo) {
    return (
      <AlreadyLogged
        icon={icon}
        label={label}
        summary={existing.summary}
        loggedAt={existing.loggedAt}
        eventId={existing.eventId}
        onEdit={() => {
          clearDraft(flowId);
          setIndice(0);
          setRespuestas({});
          setCorrigiendo(true);
        }}
      />
    );
  }

  if (listo) {
    return (
      <div className="space-y-4 rounded-xl border border-line bg-surface p-8 text-center">
        <div className="text-5xl">{icon}</div>
        <h2 className="text-lg font-medium">{done}</h2>
        <Link href="/" className="block pt-2 text-sm text-muted hover:text-foreground">
          ← Volver a Hoy
        </Link>
      </div>
    );
  }

  return (
    <div>
      <GuidedFlow
        step={steps[indice]}
        stepNumber={indice + 1}
        estimatedSteps={steps.length}
        trail={steps.slice(0, indice).flatMap((paso) => {
          const valor = respuestas[paso.id];
          if (valor === undefined) return [];
          const opcion =
            paso.type === "choice"
              ? paso.options.find((o) => o.value === String(valor))
              : null;
          return [opcion?.label ?? String(valor)];
        })}
        busy={pending}
        onAnswer={avanzar}
        onBack={
          indice > 0
            ? () => {
                setRetomado(false);
                setIndice(indice - 1);
                writeDraft(flowId, indice - 1, respuestas);
              }
            : undefined
        }
      />
      {retomado && (
        <p className="mt-3 text-center text-sm text-muted" role="status">
          Retomado donde lo dejaste
        </p>
      )}
      {error && (
        <p
          role="status"
          className="mt-3 rounded-lg bg-accent px-4 py-3 text-center font-medium text-white"
        >
          {error}
        </p>
      )}
    </div>
  );
}
