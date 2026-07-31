import { db } from "@/lib/db";
import { dayBounds, revokedAmong } from "@/lib/events/query";
import { CATEGORIAS, categoriaPorId } from "./categories";

/**
 * Gastos del día.
 *
 * Se calcula desde los eventos, sin tabla propia: un gasto es un importe, una
 * categoría y una hora (ADR-109, dominio ligero).
 */

export type Gasto = {
  id: string;
  amount: number;
  category: string;
  merchant: string | null;
  at: Date;
};

export type GastosDelDia = { total: number; gastos: Gasto[] };

export async function expensesForDay(
  now: Date,
  timeZone?: string,
): Promise<GastosDelDia> {
  const { start, end } = dayBounds(now, timeZone);

  const eventos = await db.event.findMany({
    where: { kind: "expense.logged", startedAt: { gte: start, lt: end } },
    orderBy: { startedAt: "asc" },
    select: { id: true, startedAt: true, payloadJson: true },
  });

  const ocultos = await revokedAmong(eventos.map((e) => e.id));

  const gastos: Gasto[] = [];
  for (const e of eventos) {
    if (ocultos.has(e.id)) continue;
    try {
      const p = JSON.parse(e.payloadJson) as {
        amount?: number;
        category?: string;
        merchant?: string;
      };
      if (typeof p.amount !== "number") continue;
      gastos.push({
        id: e.id,
        amount: p.amount,
        // Se normaliza al leer: los gastos viejos guardaban «súper» con acento
        // y se quedarían fuera de toda suma por categoría.
        category: categoriaPorId(p.category)?.id ?? "otro",
        merchant: p.merchant ?? null,
        at: e.startedAt,
      });
    } catch {
      /* una fila ilegible no debe vaciar la pantalla */
    }
  }

  return { total: gastos.reduce((s, g) => s + g.amount, 0), gastos };
}

/**
 * Los sitios donde sueles gastar, por frecuencia.
 *
 * Empieza VACÍO y eso está bien: sin historial no se enseña nada, en vez de una
 * pantalla con una opción inútil que hay que saltar. A las dos semanas es una
 * fila de chips que se tocan.
 */
export async function recentMerchants(limit = 6): Promise<string[]> {
  const eventos = await db.event.findMany({
    where: { kind: "expense.logged" },
    orderBy: { startedAt: "desc" },
    take: 200,
    select: { payloadJson: true },
  });

  const cuenta = new Map<string, number>();
  for (const e of eventos) {
    try {
      const p = JSON.parse(e.payloadJson) as { merchant?: string };
      const m = p.merchant?.trim();
      if (m) cuenta.set(m, (cuenta.get(m) ?? 0) + 1);
    } catch {
      /* ignorado */
    }
  }
  return [...cuenta.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([m]) => m);
}

/** Cuánto llevas por categoría hoy. Ordenado por gasto, no por catálogo. */
export function porCategoria(gastos: Gasto[]): { categoria: string; total: number }[] {
  const suma = new Map<string, number>();
  for (const g of gastos) suma.set(g.category, (suma.get(g.category) ?? 0) + g.amount);
  return CATEGORIAS.filter((c) => suma.has(c.id))
    .map((c) => ({ categoria: c.id, total: suma.get(c.id)! }))
    .sort((a, b) => b.total - a.total);
}
