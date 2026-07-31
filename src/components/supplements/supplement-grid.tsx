"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logSupplement, undoSupplement } from "@/app/suplementos/actions";
import { useVoiceTarget } from "@/components/voice/registry";
import { matchOption } from "@/lib/match-option";
import { formatoDosis, type Dosing } from "@/lib/supplements/catalog";
import { SupplementDetail } from "./supplement-detail";

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
  /** Tarjeta abierta en detalle. */
  const [abierta, setAbierta] = useState<string | null>(null);
  /** Lo último registrado, para acusar recibo del toque. */
  const [acuse, setAcuse] = useState<string | null>(null);

  function registrar(t: Tarjeta, dose: number | null) {
    setError(null);
    setAbierta(null);
    setAcuse(t.id);
    window.setTimeout(() => setAcuse(null), 1200);
    startTransition(async () => {
      const zona = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const r = await logSupplement(t.id, dose, zona);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  /**
   * El primer toque del día registra lo de siempre; el segundo abre el detalle.
   *
   * Vale para lo que no varía: una pastilla, el aceite, y la creatina —un scoop
   * de 5 g todos los días—. Preguntar la cantidad para responder lo mismo
   * siempre es un paso que no aporta nada.
   *
   * La proteína queda fuera: va de uno a dos scoops y medio según el día, y
   * ahorrarse ahí la pregunta sería falsear el dato.
   *
   * Y a partir de la segunda toma se abre SIEMPRE: tocar dos veces sin darte
   * cuenta te haría creer que tomaste dos dosis, y con las pastillas del
   * psiquiatra eso no es un detalle.
   */
  function tocar(t: Tarjeta) {
    if (t.count > 0) return setAbierta(t.id);

    if (t.dosing.kind === "single") return registrar(t, null);
    if (t.dosing.oneTap) return registrar(t, t.dosing.default);

    setAbierta(t.id);
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

  const detalle = items.find((t) => t.id === abierta) ?? null;

  const todas = items.flatMap((t) =>
    t.entries.map((e) => ({ ...e, nombre: t.name, dosing: t.dosing })),
  );

  function deshacer(id: string) {
    setError(null);
    startTransition(async () => {
      const r = await undoSupplement(id);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {detalle ? (
        <SupplementDetail
          icon={detalle.icon}
          name={detalle.name}
          dosing={detalle.dosing}
          summary={detalle.summary}
          takenToday={detalle.count > 0}
          entries={detalle.entries}
          busy={pending}
          onAdd={(dose) => registrar(detalle, dose)}
          onUndo={deshacer}
          onCancel={() => setAbierta(null)}
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

      {todas.length > 0 && !detalle && (
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
                    onClick={() => deshacer(e.id)}
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
