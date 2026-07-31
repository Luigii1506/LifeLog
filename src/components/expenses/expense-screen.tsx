"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logExpense, undoExpense } from "@/app/gasto/actions";
import { useVoiceTarget } from "@/components/voice/registry";
import { matchOption } from "@/lib/match-option";
import { CATEGORIAS, categoriaPorId, formatoDinero } from "@/lib/expenses/categories";
import { leerNumero, normalizarPalabras } from "@/lib/spanish-numbers";
import { Keypad } from "./keypad";

/**
 * Registro de gasto, en una sola pantalla.
 *
 * Eran tres: importe, categoría y lugar. Para algo que se hace varias veces al
 * día eso es mucho, y la tercera estaba vacía —no hay sitios hasta que hay
 * historial— así que solo servía para saltarla.
 *
 * Ahora todo cabe a la vez: tecleas la cifra, tocas la categoría y guardas. El
 * lugar aparece SOLO cuando ya has gastado en algún sitio conocido; hasta
 * entonces no ocupa espacio ni pide nada.
 */

export type GastoVista = {
  id: string;
  amount: number;
  category: string;
  merchant: string | null;
  at: string;
};

export function ExpenseScreen({
  total,
  gastos,
  lugares,
}: {
  total: number;
  gastos: GastoVista[];
  lugares: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cifra, setCifra] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);
  const [lugar, setLugar] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const monto = Number(cifra);
  const listo = Number.isFinite(monto) && monto > 0 && categoria !== null;

  function guardar() {
    if (!listo || pending) return;
    setError(null);
    startTransition(async () => {
      const zona = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const r = await logExpense(monto, categoria!, lugar, zona);
      if (!r.ok) return setError(r.error);
      setCifra("");
      setCategoria(null);
      setLugar(null);
      router.refresh();
    });
  }

  /**
   * «doscientos en comida», «ciento cincuenta», «súper».
   *
   * Rellena, no guarda. Con las manos ocupadas saliendo de una tienda, decir la
   * cifra y la categoría de un tirón es lo más rápido — pero un gasto mal
   * entendido descuadra el día, así que confirmas tú.
   */
  useVoiceTarget("Di cuánto y en qué", (texto) => {
    let algo = false;

    const leido = leerNumero(normalizarPalabras(texto));
    if (leido) {
      setCifra(String(leido.valor));
      algo = true;
    }

    const cat = matchOption(
      texto,
      CATEGORIAS.map((c) => ({ value: c.id, label: c.label })),
    );
    if (cat) {
      setCategoria(cat.value);
      algo = true;
    }

    return algo;
  });

  return (
    <div className="space-y-4">
      {/* La cifra, grande y siempre visible. Es el único dato que se teclea. */}
      <div className="rounded-2xl border border-line bg-surface px-5 py-6 text-center">
        <div
          className={`font-mono text-5xl leading-none tabular-nums ${
            cifra ? "" : "text-muted/40"
          }`}
        >
          {cifra ? formatoDinero(monto) : "$0"}
        </div>
        {total > 0 && (
          <div className="mt-3 text-xs text-muted">
            Hoy llevas {formatoDinero(total)}
          </div>
        )}
      </div>

      <Keypad value={cifra} onChange={setCifra} disabled={pending} />

      <div className="grid grid-cols-4 gap-1.5">
        {CATEGORIAS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategoria(categoria === c.id ? null : c.id)}
            aria-pressed={categoria === c.id}
            className={`flex flex-col items-center gap-0.5 rounded-xl border px-1 py-2.5 transition active:scale-[0.96] ${
              categoria === c.id
                ? "border-accent bg-accent/10 font-medium"
                : "border-line bg-surface text-muted"
            }`}
          >
            <span className="text-xl leading-none">{c.icon}</span>
            <span className="text-[10px] leading-tight">{c.label}</span>
          </button>
        ))}
      </div>

      {/* Solo si hay historial. Sin él, esto era una pantalla entera con una
          opción inútil que había que saltar. */}
      {lugares.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {lugares.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLugar(lugar === l ? null : l)}
              aria-pressed={lugar === l}
              className={`rounded-full border px-3 py-1.5 text-xs transition active:scale-95 ${
                lugar === l
                  ? "border-accent bg-accent/10 font-medium"
                  : "border-line text-muted"
              }`}
            >
              📍 {l}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={guardar}
        disabled={!listo || pending}
        className="w-full rounded-xl bg-accent py-4 text-lg font-medium text-white transition active:scale-[0.98] disabled:opacity-40"
      >
        {pending
          ? "Guardando…"
          : listo
            ? `Guardar ${formatoDinero(monto)} · ${categoriaPorId(categoria)?.label}`
            : cifra
              ? "Elige en qué"
              : "Teclea cuánto"}
      </button>

      {error && (
        <p role="status" className="text-center text-sm text-accent">
          {error}
        </p>
      )}

      {gastos.length > 0 && (
        <section className="space-y-2 pt-2">
          <h2 className="text-xs font-medium tracking-[0.12em] text-muted uppercase">
            Hoy · {formatoDinero(total)}
          </h2>
          <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {gastos
              .slice()
              .reverse()
              .map((g) => {
                const c = categoriaPorId(g.category);
                return (
                  <li key={g.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="font-mono text-sm tabular-nums text-muted">
                      {new Date(g.at).toLocaleTimeString("es-MX", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}
                    </span>
                    <span className="shrink-0" aria-hidden>
                      {c?.icon ?? "📦"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {g.merchant ?? c?.label ?? "Gasto"}
                    </span>
                    <span className="font-mono text-sm tabular-nums">
                      {formatoDinero(g.amount)}
                    </span>
                    <button
                      onClick={() =>
                        startTransition(async () => {
                          const r = await undoExpense(g.id);
                          if (!r.ok) setError(r.error);
                          else router.refresh();
                        })
                      }
                      disabled={pending}
                      aria-label={`Deshacer ${formatoDinero(g.amount)}`}
                      className="text-muted transition hover:text-accent disabled:opacity-50"
                    >
                      ×
                    </button>
                  </li>
                );
              })}
          </ol>
        </section>
      )}
    </div>
  );
}
