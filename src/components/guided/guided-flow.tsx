"use client";

import { useState } from "react";

/**
 * GuidedFlow — captura guiada, una pregunta por pantalla.
 *
 * Es solo presentación: no conoce ningún dominio y no habla con la base. El
 * dominio declara sus pasos y recibe las respuestas al final. Eso mantiene el
 * modelo de datos intacto (ADR-109) y hace que el flujo sea reemplazable sin
 * tocar nada de lo que hay debajo.
 *
 * Todos los datos que necesitan los pasos llegan calculados desde el servidor:
 * entre pregunta y pregunta no hay red, y por tanto no hay espera. La latencia
 * es lo que mata este patrón.
 */

export type FlowOption = {
  value: string;
  label: string;
  icon?: string | null;
  /** Texto pequeño bajo la etiqueta: cantidad habitual, veces registrado… */
  meta?: string | null;
};

export type FlowStep =
  | {
      type: "choice";
      id: string;
      question: string;
      hint?: string;
      options: FlowOption[];
      /** Permite escribir algo que no está entre las opciones. */
      customLabel?: string;
      /** Avanza sin elegir nada. */
      skipLabel?: string;
    }
  | {
      type: "quantity";
      id: string;
      question: string;
      hint?: string;
      presets: number[];
      unit: string;
      /** Se preselecciona; el caso normal es confirmar, no elegir. */
      suggested?: number | null;
    };

export type FlowAnswer =
  | { stepId: string; kind: "choice"; value: string; label: string }
  | { stepId: string; kind: "custom"; value: string }
  | { stepId: string; kind: "quantity"; value: number }
  | { stepId: string; kind: "skip" };

export function GuidedFlow({
  step,
  stepNumber,
  estimatedSteps,
  trail,
  busy,
  onAnswer,
  onBack,
  onFinish,
  finishLabel,
}: {
  step: FlowStep;
  stepNumber: number;
  estimatedSteps: number;
  /** Lo elegido hasta ahora. Da contexto sin ocupar la pantalla. */
  trail: string[];
  busy?: boolean;
  onAnswer: (answer: FlowAnswer) => void;
  onBack?: () => void;
  onFinish?: () => void;
  finishLabel?: string;
}) {
  return (
    <div className="flex min-h-[70vh] flex-col">
      <Progress current={stepNumber} total={Math.max(estimatedSteps, stepNumber)} />

      {trail.length > 0 && (
        <p className="mt-4 text-sm text-muted">{trail.join(" · ")}</p>
      )}

      <div className="mt-6 flex-1">
        <h2 className="text-xl font-semibold tracking-tight">{step.question}</h2>
        {step.hint && <p className="mt-1 text-sm text-muted">{step.hint}</p>}

        <div className="mt-6">
          {step.type === "choice" ? (
            <ChoiceStep step={step} busy={busy} onAnswer={onAnswer} />
          ) : (
            <QuantityStep step={step} busy={busy} onAnswer={onAnswer} />
          )}
        </div>
      </div>

      <div className="mt-6 flex gap-2">
        {onBack && (
          <button
            onClick={onBack}
            disabled={busy}
            className="rounded-xl border border-line px-5 py-4 text-muted transition active:scale-[0.98] disabled:opacity-50"
          >
            ←
          </button>
        )}
        {onFinish && (
          <button
            onClick={onFinish}
            disabled={busy}
            className="flex-1 rounded-xl bg-accent px-4 py-4 font-medium text-white transition active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? "Guardando…" : (finishLabel ?? "Terminar")}
          </button>
        )}
      </div>
    </div>
  );
}

function Progress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-1 flex-1 gap-1">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`h-full flex-1 rounded-full transition-colors ${
              i < current ? "bg-accent" : "bg-line"
            }`}
          />
        ))}
      </div>
      <span className="font-mono text-xs tabular-nums text-muted">
        {current} / {total}
      </span>
    </div>
  );
}

function ChoiceStep({
  step,
  busy,
  onAnswer,
}: {
  step: Extract<FlowStep, { type: "choice" }>;
  busy?: boolean;
  onAnswer: (a: FlowAnswer) => void;
}) {
  const [custom, setCustom] = useState<string | null>(null);

  if (custom !== null) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const valor = custom.trim();
          if (valor) onAnswer({ stepId: step.id, kind: "custom", value: valor });
        }}
        className="space-y-3"
      >
        <input
          autoFocus
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Escribe qué fue"
          className="w-full rounded-xl border border-line bg-background px-4 py-4 text-lg outline-none focus:border-accent"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy || !custom.trim()}
            className="flex-1 rounded-xl bg-foreground py-4 font-medium text-background disabled:opacity-40"
          >
            Continuar
          </button>
          <button
            type="button"
            onClick={() => setCustom(null)}
            className="rounded-xl border border-line px-5 text-muted"
          >
            Atrás
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {step.options.map((opcion) => (
          <button
            key={opcion.value}
            disabled={busy}
            onClick={() =>
              onAnswer({
                stepId: step.id,
                kind: "choice",
                value: opcion.value,
                label: opcion.label,
              })
            }
            className="flex min-h-24 flex-col items-start justify-between rounded-xl border border-line bg-surface p-4 text-left transition active:scale-[0.97] disabled:opacity-50"
          >
            {opcion.icon && <span className="text-2xl leading-none">{opcion.icon}</span>}
            <span className="mt-2">
              <span className="block font-medium">{opcion.label}</span>
              {opcion.meta && (
                <span className="mt-0.5 block text-xs text-muted">{opcion.meta}</span>
              )}
            </span>
          </button>
        ))}
      </div>

      {step.customLabel && (
        <button
          disabled={busy}
          onClick={() => setCustom("")}
          className="w-full rounded-xl border border-dashed border-line py-4 text-muted transition active:scale-[0.99] disabled:opacity-50"
        >
          ＋ {step.customLabel}
        </button>
      )}

      {step.skipLabel && (
        <button
          disabled={busy}
          onClick={() => onAnswer({ stepId: step.id, kind: "skip" })}
          className="w-full py-3 text-sm text-muted"
        >
          {step.skipLabel}
        </button>
      )}
    </div>
  );
}

function QuantityStep({
  step,
  busy,
  onAnswer,
}: {
  step: Extract<FlowStep, { type: "quantity" }>;
  busy?: boolean;
  onAnswer: (a: FlowAnswer) => void;
}) {
  const [otro, setOtro] = useState(false);
  const unidad = step.unit === "unit" ? "" : ` ${step.unit}`;

  if (otro) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const raw = new FormData(e.currentTarget).get("amount");
          const n = Number(String(raw ?? "").replace(",", "."));
          if (Number.isFinite(n)) onAnswer({ stepId: step.id, kind: "quantity", value: n });
        }}
        className="space-y-3"
      >
        <input
          autoFocus
          name="amount"
          type="number"
          step="any"
          inputMode="decimal"
          defaultValue={step.suggested ?? undefined}
          className="w-full rounded-xl border border-line bg-background px-4 py-4 text-center text-2xl tabular-nums outline-none focus:border-accent"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-xl bg-foreground py-4 font-medium text-background disabled:opacity-50"
          >
            Continuar
          </button>
          <button
            type="button"
            onClick={() => setOtro(false)}
            className="rounded-xl border border-line px-5 text-muted"
          >
            Atrás
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2">
        {step.presets.map((valor) => (
          <button
            key={valor}
            disabled={busy}
            onClick={() => onAnswer({ stepId: step.id, kind: "quantity", value: valor })}
            className={`rounded-xl border py-6 text-lg font-medium tabular-nums transition active:scale-[0.95] disabled:opacity-50 ${
              valor === step.suggested
                ? "border-accent bg-surface"
                : "border-line bg-surface"
            }`}
          >
            {valor}
            <span className="block text-xs font-normal text-muted">{unidad.trim()}</span>
          </button>
        ))}
      </div>
      <button
        disabled={busy}
        onClick={() => setOtro(true)}
        className="w-full rounded-xl border border-dashed border-line py-4 text-muted transition active:scale-[0.99] disabled:opacity-50"
      >
        Otra cantidad
      </button>
    </div>
  );
}
