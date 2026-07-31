"use client";

import { useState } from "react";
import { TimePicker } from "./time-picker";
import { ScalePicker } from "./scale-picker";
import { parseSpokenTime } from "@/lib/parse-spoken-time";
import { duracionHasta, formatoHoras } from "@/lib/sleep-duration";
import { useVoiceTarget } from "@/components/voice/registry";
import { matchOption } from "@/lib/match-option";
import { leerNumero, normalizarPalabras } from "@/lib/spanish-numbers";

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
 *
 * La voz vive en el MOTOR, no en cada pantalla: cada tipo de paso declara cómo
 * interpretar lo que oye y el botón flotante lo usa. Así toda lista de opciones
 * hereda el dictado sin que nadie se acuerde de añadirlo, y el micrófono sigue
 * estando siempre en el mismo punto de la pantalla.
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
      /** Cómo convertir el valor elegido al construir el payload. */
      coerce?: "number" | "string";
      /** Rejilla de una columna, para escalas largas. */
      columns?: 1 | 2 | 3 | 5;
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
      /** Avanza sin responder. */
      skipLabel?: string;
    }
  | {
      type: "time";
      id: string;
      question: string;
      hint?: string;
      /** "HH:MM" inicial. Por defecto, ahora redondeado. */
      defaultValue?: string;
      confirmLabel?: string;
      /**
       * Instante ISO hasta el que medir. Con él, la pantalla enseña la
       * duración EN VIVO mientras giras la rueda.
       *
       * Es lo que convierte «¿cuántas horas dormiste?» —una cuenta que hace el
       * usuario, mal y de memoria— en «¿a qué hora te dormiste?», que se sabe.
       */
      until?: string;
      /** Qué es ese instante: «despertaste a las 07:30». */
      untilLabel?: string;
    }
  | {
      /**
       * Un número con decimal, elegido con ruedas. Para lo que se lee en un
       * aparato —la báscula— donde teclear es más lento que ajustar.
       */
      type: "scale";
      id: string;
      question: string;
      hint?: string;
      /** Valor inicial. Lo último registrado, si lo hay. */
      defaultValue?: number;
      unit?: string;
      confirmLabel?: string;
    }
  | {
      type: "text";
      id: string;
      question: string;
      hint?: string;
      placeholder?: string;
      multiline?: boolean;
      skipLabel?: string;
    };

export type FlowAnswer =
  | { stepId: string; kind: "choice"; value: string; label: string }
  | { stepId: string; kind: "custom"; value: string }
  | { stepId: string; kind: "quantity"; value: number }
  | { stepId: string; kind: "time"; value: string }
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
          ) : step.type === "quantity" ? (
            <QuantityStep step={step} busy={busy} onAnswer={onAnswer} />
          ) : step.type === "time" ? (
            <TimeStep step={step} busy={busy} onAnswer={onAnswer} />
          ) : step.type === "scale" ? (
            <ScaleStep step={step} busy={busy} onAnswer={onAnswer} />
          ) : (
            <TextStep step={step} busy={busy} onAnswer={onAnswer} />
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

  // Un solo registro para los dos modos del paso: elegir de la lista y
  // escribir algo que no está en ella. No puede haber dos `useVoiceTarget`
  // condicionales —los hooks no se llaman a veces— así que decide dentro.
  useVoiceTarget(custom !== null ? "Dilo y lo escribo" : "Di una opción", (texto) => {
    if (custom !== null) {
      setCustom(texto);
      return true;
    }
    // `matchOption` tolera acentos, plurales y aproximaciones: quien habla no
    // pronuncia la etiqueta exacta que muestra el botón.
    const elegida = matchOption(texto, step.options);
    if (!elegida) return false;
    onAnswer({
      stepId: step.id,
      kind: "choice",
      value: elegida.value,
      label: elegida.label,
    });
    return true;
  });

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
      {/* El tamaño depende de cuántas quepan por fila. En cinco columnas cada
          celda mide unos 58 px en un móvil: con la etiqueta a 16 px, «Excelente»
          no entra y la rejilla se ve apretada. */}
      <div
        className={`grid ${
          step.columns === 5 ? "gap-1.5" : "gap-2"
        } ${
          step.columns === 1
            ? "grid-cols-1"
            : step.columns === 3
              ? "grid-cols-3"
              : step.columns === 5
                ? "grid-cols-5"
                : "grid-cols-2"
        }`}
      >
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
            className={`flex flex-col rounded-xl border border-line bg-surface transition active:scale-[0.97] disabled:opacity-50 ${
              step.columns === 5
                ? "items-center gap-1 px-1 py-3 text-center"
                : step.columns === 3
                  ? "items-center gap-1.5 p-3 text-center"
                  : "min-h-24 items-start justify-between p-4 text-left"
            }`}
          >
            {opcion.icon && (
              <span
                className={`leading-none ${
                  step.columns === 5 ? "text-3xl" : "text-2xl"
                }`}
              >
                {opcion.icon}
              </span>
            )}
            <span className={step.columns && step.columns >= 3 ? "" : "mt-2"}>
              <span
                className={`block leading-tight font-medium ${
                  step.columns === 5 ? "text-[10px]" : ""
                }`}
              >
                {opcion.label}
              </span>
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

  // «setenta kilos», «diez», «dos y media». El número puede venir antes o
  // después de la unidad, y en letra o en cifra.
  useVoiceTarget("Di la cantidad", (texto) => {
    const leido = leerNumero(normalizarPalabras(texto));
    if (!leido) return false;
    onAnswer({ stepId: step.id, kind: "quantity", value: leido.valor });
    return true;
  });

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

function TextStep({
  step,
  busy,
  onAnswer,
}: {
  step: Extract<FlowStep, { type: "text" }>;
  busy?: boolean;
  onAnswer: (a: FlowAnswer) => void;
}) {
  const [valor, setValor] = useState("");
  const Campo = step.multiline ? "textarea" : "input";

  // Dictado literal: aquí no hay nada que interpretar, lo dicho es el valor.
  // Es el caso que más tiempo ahorra — escribir una nota en el móvil es lento.
  useVoiceTarget("Dilo y lo escribo", (texto) => {
    setValor(texto);
    return true;
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const limpio = valor.trim();
        if (limpio) onAnswer({ stepId: step.id, kind: "custom", value: limpio });
      }}
      className="space-y-3"
    >
      <Campo
        autoFocus
        value={valor}
        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
          setValor(e.target.value)
        }
        placeholder={step.placeholder}
        rows={step.multiline ? 4 : undefined}
        className="w-full resize-none rounded-xl border border-line bg-background px-4 py-4 text-lg outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={busy || !valor.trim()}
        className="w-full rounded-xl bg-foreground py-4 font-medium text-background disabled:opacity-40"
      >
        Continuar
      </button>
      {step.skipLabel && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onAnswer({ stepId: step.id, kind: "skip" })}
          className="w-full py-2 text-sm text-muted"
        >
          {step.skipLabel}
        </button>
      )}
    </form>
  );
}

/**
 * Paso de escala: rueda, valor en grande y un botón que lo confirma.
 *
 * Misma forma que el de la hora a propósito. Son el mismo gesto —ajustar algo
 * que ya casi está bien— y darles pantallas distintas obligaría a aprender dos.
 */
function ScaleStep({
  step,
  busy,
  onAnswer,
}: {
  step: Extract<FlowStep, { type: "scale" }>;
  busy?: boolean;
  onAnswer: (a: FlowAnswer) => void;
}) {
  const [valor, setValor] = useState(step.defaultValue ?? 70);

  // «setenta y ocho cuatro», «78.4». Con la báscula delante y mojado, decirlo
  // gana a girar dos ruedas.
  useVoiceTarget(`Di el ${step.unit ?? "número"}`, (texto) => {
    const leido = leerNumero(normalizarPalabras(texto));
    if (!leido) return false;
    setValor(leido.valor);
    return true;
  });

  return (
    <div className="space-y-5">
      <ScalePicker value={valor} onChange={setValor} unit={step.unit} />
      <button
        disabled={busy}
        onClick={() => onAnswer({ stepId: step.id, kind: "quantity", value: valor })}
        className="w-full rounded-xl bg-accent py-5 text-lg font-medium text-white transition active:scale-[0.98] disabled:opacity-50"
      >
        {step.confirmLabel ?? "Confirmar"} {valor.toLocaleString("es-MX")}{" "}
        {step.unit ?? ""}
      </button>
    </div>
  );
}

function TimeStep({
  step,
  busy,
  onAnswer,
}: {
  step: Extract<FlowStep, { type: "time" }>;
  busy?: boolean;
  onAnswer: (a: FlowAnswer) => void;
}) {
  const [hora, setHora] = useState(() => {
    const [h, m] = (step.defaultValue ?? "").split(":");
    const ahora = new Date();
    return {
      hour: Number.isFinite(Number(h)) && h !== "" ? Number(h) : ahora.getHours(),
      minute: Number.isFinite(Number(m)) && m !== "" ? Number(m) : ahora.getMinutes(),
    };
  });

  const texto = `${String(hora.hour).padStart(2, "0")}:${String(hora.minute).padStart(2, "0")}`;

  // Duración hasta el instante de referencia, recalculada al girar la rueda.
  const duracion = step.until ? duracionHasta(hora, step.until) : null;

  // «cinco y media», «siete y cuarto», «las ocho». Mover la rueda con el dedo
  // hasta una hora concreta cuesta varios segundos; decirla, uno.
  useVoiceTarget("Di la hora", (dicho) => {
    const leida = parseSpokenTime(dicho);
    if (!leida) return false;
    setHora(leida);
    return true;
  });

  return (
    <div className="space-y-5">
      <TimePicker value={hora} onChange={setHora} />

      {duracion !== null && (
        <div className="rounded-2xl border border-line bg-surface px-4 py-3 text-center">
          {duracion.plausible ? (
            <>
              <p className="font-mono text-2xl tabular-nums">
                {formatoHoras(duracion.minutos)}
              </p>
              {step.untilLabel && (
                <p className="mt-0.5 text-xs text-muted">{step.untilLabel}</p>
              )}
            </>
          ) : (
            // Fuera de rango no se calla ni inventa: dieciocho horas de sueño
            // casi siempre es una rueda mal girada, y guardarlo ensucia la
            // media para siempre.
            <p className="text-sm text-accent">
              Eso daría {formatoHoras(duracion.minutos)}. ¿Seguro?
            </p>
          )}
        </div>
      )}
      <button
        disabled={busy}
        onClick={() => onAnswer({ stepId: step.id, kind: "time", value: texto })}
        className="w-full rounded-xl bg-accent py-5 text-lg font-medium text-white transition active:scale-[0.98] disabled:opacity-50"
      >
        {step.confirmLabel ?? "Confirmar"} {texto}
      </button>
    </div>
  );
}
