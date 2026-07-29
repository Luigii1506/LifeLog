"use client";

import { useState, useTransition } from "react";
import { logEvent } from "@/app/actions";
import { parseFormNumber } from "@/lib/parse-number";

type Sheet =
  | null
  | "sleep"
  | "weight"
  | "expense"
  | "mood"
  | "focus"
  | "note"
  | "activity";

const ONE_TAP = [
  { kind: "wake.up", label: "Desperté", payload: {} },
  {
    kind: "medication.taken",
    label: "Medicamento",
    payload: { name: "Medicamento" },
  },
] as const;

const SHEETS: { id: Exclude<Sheet, null>; label: string }[] = [
  { id: "sleep", label: "Sueño" },
  { id: "weight", label: "Peso" },
  { id: "expense", label: "Gasto" },
  { id: "focus", label: "Trabajo" },
  { id: "mood", label: "Ánimo" },
  { id: "activity", label: "Actividad" },
  { id: "note", label: "Nota" },
];

export function QuickActions({
  openActivities = [],
}: {
  openActivities?: { activity: string; startedAt: string }[];
}) {
  const [sheet, setSheet] = useState<Sheet>(null);
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<{ text: string; ok: boolean } | null>(null);
  // Guarda contra doble registro: tras un toque, ese botón queda bloqueado
  // un momento. Sin esto, un botón que parece no responder se toca 5 veces.
  const [reciente, setReciente] = useState<string | null>(null);

  function send(kind: string, payload: unknown, confirmation: string) {
    if (reciente === kind) return;
    setReciente(kind);
    setTimeout(() => setReciente(null), 2500);

    startTransition(async () => {
      const result = await logEvent(kind, payload);
      if (result.ok) {
        setFlash({ text: `${confirmation} registrado`, ok: true });
        setSheet(null);
        setTimeout(() => setFlash(null), 2500);
      } else {
        setFlash({ text: result.error, ok: false });
        setReciente(null); // si falló, hay que poder reintentar ya
      }
    });
  }

  return (
    <section className="space-y-3">
      {openActivities.map((abierta) => {
        const minutos = Math.round(
          (Date.now() - new Date(abierta.startedAt).getTime()) / 60000,
        );
        return (
          <button
            key={abierta.activity}
            disabled={pending}
            onClick={() =>
              send(
                "activity.ended",
                { activity: abierta.activity, minutes: minutos },
                abierta.activity,
              )
            }
            className="flex w-full items-center justify-between rounded-xl border border-accent bg-surface px-4 py-4 transition active:scale-[0.99] disabled:opacity-50"
          >
            <span className="font-medium">Terminar {abierta.activity}</span>
            <span className="font-mono text-sm tabular-nums text-muted">
              {minutos} min
            </span>
          </button>
        );
      })}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ONE_TAP.map((action) => (
          <button
            key={action.kind}
            disabled={pending || reciente === action.kind}
            onClick={() => send(action.kind, action.payload, action.label)}
            className="rounded-xl bg-accent px-4 py-4 text-base font-medium text-white transition active:scale-[0.97] disabled:opacity-40"
          >
            {reciente === action.kind ? "✓" : action.label}
          </button>
        ))}
        {SHEETS.map((item) => (
          <button
            key={item.id}
            disabled={pending}
            onClick={() => setSheet(sheet === item.id ? null : item.id)}
            className={`rounded-xl border px-4 py-4 text-base transition active:scale-[0.97] disabled:opacity-50 ${
              sheet === item.id
                ? "border-accent bg-surface"
                : "border-line bg-surface"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {flash && (
        <p
          role="status"
          aria-live="polite"
          className={`rounded-lg px-4 py-3 text-center font-medium ${
            flash.ok
              ? "bg-accent/15 text-accent"
              : "bg-accent text-white"
          }`}
        >
          {flash.text}
        </p>
      )}

      {sheet && (
        <div className="rounded-xl border border-line bg-surface p-4">
          <SheetForm sheet={sheet} pending={pending} onSend={send} />
        </div>
      )}
    </section>
  );
}

type SheetFormProps = {
  sheet: Exclude<Sheet, null>;
  pending: boolean;
  onSend: (kind: string, payload: unknown, confirmation: string) => void;
};

function SheetForm({ sheet, pending, onSend }: SheetFormProps) {
  return (
    <form
      key={sheet}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const num = (k: string) => parseFormNumber(data.get(k));
        const str = (k: string) => {
          const v = data.get(k);
          return v === null || v === "" ? undefined : String(v);
        };

        switch (sheet) {
          case "sleep":
            return onSend(
              "sleep.logged",
              { hours: num("hours"), quality: num("quality") },
              "Sueño registrado",
            );
          case "weight":
            return onSend(
              "weight.logged",
              { kg: num("kg") },
              "Peso registrado",
            );
          case "expense":
            return onSend(
              "expense.logged",
              {
                amount: num("amount"),
                currency: "MXN",
                category: str("category"),
                merchant: str("merchant"),
              },
              "Gasto registrado",
            );
          case "mood":
            return onSend(
              "mood.logged",
              { score: num("score"), note: str("note") },
              "Ánimo registrado",
            );
          case "focus":
            return onSend(
              "focus.block",
              { minutes: num("minutes"), task: str("task") },
              "Bloque registrado",
            );
          case "activity":
            return onSend(
              "activity.started",
              { activity: str("activity") },
              "Actividad iniciada",
            );
          case "note":
            return onSend(
              "note.quick",
              { text: str("text") },
              "Nota registrada",
            );
        }
      }}
      className="space-y-3"
    >
      {sheet === "sleep" && (
        <div className="grid grid-cols-2 gap-3">
          <Field name="hours" label="Horas" type="number" step="0.1" autoFocus required />
          <Field name="quality" label="Calidad 1-10" type="number" min="1" max="10" />
        </div>
      )}
      {sheet === "weight" && (
        <Field name="kg" label="Kilogramos" type="number" step="0.1" autoFocus required />
      )}
      {sheet === "expense" && (
        <div className="grid grid-cols-2 gap-3">
          <Field name="amount" label="Monto MXN" type="number" step="0.01" autoFocus required />
          <Field name="category" label="Categoría" />
          <Field name="merchant" label="Dónde" className="col-span-2" />
        </div>
      )}
      {sheet === "mood" && (
        <div className="grid grid-cols-2 gap-3">
          <Field name="score" label="1-10" type="number" min="1" max="10" autoFocus required />
          <Field name="note" label="Nota" />
        </div>
      )}
      {sheet === "focus" && (
        <div className="grid grid-cols-2 gap-3">
          <Field name="minutes" label="Minutos" type="number" autoFocus required />
          <Field name="task" label="En qué" />
        </div>
      )}
      {sheet === "activity" && (
        <Field name="activity" label="Qué empiezas" autoFocus required />
      )}
      {sheet === "note" && <Field name="text" label="Nota" autoFocus required />}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-foreground px-4 py-3 font-medium text-background disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Registrar"}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  label: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs tracking-wide text-muted uppercase">
        {label}
      </span>
      <input
        name={name}
        inputMode={props.type === "number" ? "decimal" : undefined}
        className="w-full rounded-lg border border-line bg-background px-3 py-3 outline-none focus:border-accent"
        {...props}
      />
    </label>
  );
}
