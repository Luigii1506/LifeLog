"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { logQuickFlow } from "@/app/actions";
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
 */
export function QuickFlowRunner({
  flowId,
  label,
  icon,
  done,
  steps,
}: {
  flowId: string;
  label: string;
  icon: string;
  done: string;
  steps: FlowStep[];
}) {
  const [indice, setIndice] = useState(0);
  const [respuestas, setRespuestas] = useState<Record<string, string | number>>({});
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  function guardar(finales: Record<string, string | number>) {
    startTransition(async () => {
      const r = await logQuickFlow(flowId, finales);
      if (!r.ok) setError(r.error);
      else setListo(true);
    });
  }

  function avanzar(respuesta: FlowAnswer) {
    setError(null);
    const paso = steps[indice];

    const siguientes = { ...respuestas };
    if (respuesta.kind === "choice") siguientes[paso.id] = respuesta.value;
    else if (respuesta.kind === "custom") siguientes[paso.id] = respuesta.value;
    else if (respuesta.kind === "quantity") siguientes[paso.id] = respuesta.value;
    // "skip" no escribe nada: el campo queda ausente, que es distinto de vacío.

    setRespuestas(siguientes);

    if (indice + 1 < steps.length) setIndice(indice + 1);
    else guardar(siguientes);
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
        onBack={indice > 0 ? () => setIndice(indice - 1) : undefined}
      />
      {error && (
        <p
          role="status"
          className="mt-3 rounded-lg bg-accent px-4 py-3 text-center font-medium text-white"
        >
          {error}
        </p>
      )}
      <p className="mt-6 text-center text-xs text-muted">{label}</p>
    </div>
  );
}
