"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logSupplement, undoSupplement } from "@/app/suplementos/actions";
import { useVoiceTarget } from "@/components/voice/registry";
import { matchOption } from "@/lib/match-option";
import { formatoDosis, type Dosing } from "@/lib/supplements/catalog";

/**
 * Suplementos del día.
 *
 * Rejilla como la de Hoy, y con el mismo lenguaje: verde y marca de hecho
 * cuando ya lo tomaste. Que se parezca no es cosmético — es lo que evita tener
 * que aprender una pantalla nueva.
 *
 * Cada tarjeta se registra a su manera, y es la única forma de que esto no sea
 * un formulario: una pastilla se toma o no —un toque basta— mientras que la
 * proteína va en medios scoops y la creatina en scoops de 5 g. Pedir cantidad
 * para la pastilla sería un paso inventado; no pedirla para la proteína
 * falsearía el dato.
 */

export type Tarjeta = {
  id: string;
  name: string;
  icon: string;
  dosing: Dosing;
  count: number;
  total: number | null;
  summary: string;
  entries: { id: string; dose: number | null; at: string }[];
};

export function SupplementGrid({ items }: { items: Tarjeta[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  /** Tarjeta abierta para elegir cantidad. */
  const [dosificando, setDosificando] = useState<Tarjeta | null>(null);
  /** Lo último registrado, para acusar recibo del toque. */
  const [acuse, setAcuse] = useState<string | null>(null);

  function registrar(t: Tarjeta, dose: number | null) {
    setError(null);
    setDosificando(null);
    setAcuse(t.id);
    window.setTimeout(() => setAcuse(null), 1200);
    startTransition(async () => {
      const zona = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const r = await logSupplement(t.id, dose, zona);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  function tocar(t: Tarjeta) {
    // Un toque en las de dosis abre el selector con lo que tomas normalmente
    // ya puesto: casi siempre basta con confirmar.
    if (t.dosing.kind === "steps") setDosificando(t);
    else registrar(t, null);
  }

  useVoiceTarget("Di cuál · «creatina»", (texto) => {
    const elegido = matchOption(
      texto,
      items.map((t) => ({ value: t.id, label: t.name })),
    );
    if (!elegido) return false;
    const t = items.find((x) => x.id === elegido.value)!;
    tocar(t);
    return true;
  });

  const todas = items.flatMap((t) =>
    t.entries.map((e) => ({ ...e, nombre: t.name, dosing: t.dosing })),
  );

  return (
    <div className="space-y-5">
      {dosificando ? (
        <Dosificador
          tarjeta={dosificando}
          busy={pending}
          onCancel={() => setDosificando(null)}
          onConfirm={(dose) => registrar(dosificando, dose)}
        />
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {items.map((t) => {
            const hecho = t.count > 0;
            return (
              <button
                key={t.id}
                disabled={pending}
                onClick={() => tocar(t)}
                aria-label={`${t.name}, ${t.summary}`}
                className={`relative flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-5 text-center transition active:scale-[0.96] disabled:opacity-50 ${
                  hecho ? "border-done bg-done-surface" : "border-line bg-surface"
                }`}
              >
                {hecho && (
                  <span
                    aria-hidden
                    className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-done text-[11px] font-bold text-white"
                  >
                    ✓
                  </span>
                )}
                {acuse === t.id && (
                  <span
                    aria-hidden
                    className="animate-[acuse_1200ms_ease-out] absolute inset-x-0 top-1 text-center text-sm font-medium text-done"
                  >
                    +1
                  </span>
                )}

                <span className="text-3xl">{t.icon}</span>
                <span className="text-sm leading-tight font-medium">{t.name}</span>
                <span
                  className={`font-mono text-[11px] tabular-nums ${
                    hecho ? "text-done" : "text-muted"
                  }`}
                >
                  {t.summary}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <p role="status" className="rounded-lg bg-accent px-4 py-3 text-center font-medium text-white">
          {error}
        </p>
      )}

      {todas.length > 0 && !dosificando && (
        <section className="space-y-2">
          <h2 className="text-xs font-medium tracking-[0.12em] text-muted uppercase">
            Hoy · {todas.length}
          </h2>
          <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {todas
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
                  <span className="flex-1 truncate text-sm">{e.nombre}</span>
                  {e.dose !== null && (
                    <span className="font-mono text-sm tabular-nums">
                      {formatoDosis(e.dose, e.dosing)}
                    </span>
                  )}
                  <button
                    onClick={() =>
                      startTransition(async () => {
                        const r = await undoSupplement(e.id);
                        if (!r.ok) setError(r.error);
                        else router.refresh();
                      })
                    }
                    disabled={pending}
                    aria-label={`Deshacer ${e.nombre}`}
                    className="text-muted transition hover:text-accent disabled:opacity-50"
                  >
                    ×
                  </button>
                </li>
              ))}
          </ol>
        </section>
      )}
    </div>
  );
}

/**
 * Selector de cantidad, con los pasos que declara cada suplemento.
 *
 * Abre con lo que tomas normalmente ya puesto, así que el caso de siempre es
 * confirmar y ya. Los pasos vienen del catálogo —medio scoop en proteína, 5 g
 * en creatina— porque teclear una cantidad con las manos ocupadas es lo que
 * hace que se deje de registrar.
 */
function Dosificador({
  tarjeta,
  busy,
  onCancel,
  onConfirm,
}: {
  tarjeta: Tarjeta;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (dose: number) => void;
}) {
  const d = tarjeta.dosing;
  const pasos = d.kind === "steps" ? d : null;
  const [valor, setValor] = useState(pasos?.default ?? 1);

  if (!pasos) return null;

  const ajustar = (delta: number) =>
    setValor((v) =>
      Math.min(pasos.max, Math.max(pasos.step, Number((v + delta).toFixed(2)))),
    );

  return (
    <div className="space-y-4 rounded-2xl border border-accent bg-surface p-5">
      <div className="text-center">
        <div className="text-4xl">{tarjeta.icon}</div>
        <h2 className="mt-2 font-medium">{tarjeta.name}</h2>
      </div>

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

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="flex-1 rounded-xl border border-line py-3.5 text-sm text-muted transition active:scale-[0.98] disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => onConfirm(valor)}
          disabled={busy}
          className="flex-[2] rounded-xl bg-accent py-3.5 font-medium text-white transition active:scale-[0.98] disabled:opacity-50"
        >
          Registrar {formatoDosis(valor, d)}
        </button>
      </div>
    </div>
  );
}
