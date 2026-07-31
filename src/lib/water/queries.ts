import { db } from "@/lib/db";
import { dayBounds, revokedAmong } from "@/lib/events/query";
import { META_ML, EXCELENTE_ML, RECIPIENTES } from "./units";

/**
 * Agua del día.
 *
 * Es el registro más frecuente del sistema —ocho o diez veces al día frente a
 * una del peso o del sueño— y eso manda sobre todo lo demás: cada toque de más
 * se multiplica por diez, así que la pantalla existe para poder registrar
 * varias veces seguidas sin salir.
 *
 * Se calcula desde los eventos, sin tabla propia. El agua no tiene detalle que
 * guardar: un vaso es un número y una hora (ADR-109, dominio ligero).
 *
 * Las metas y el formato están en `units.ts`, que no toca la base: sin esa
 * separación, la pantalla de cliente arrastraría Prisma al navegador.
 */

export { EXCELENTE_ML, META_ML, RECIPIENTES, formatoAgua } from "./units";

export type WaterEntry = {
  id: string;
  ml: number;
  vessel: string | null;
  at: Date;
  timezone: string;
};

export type WaterDay = {
  totalMl: number;
  entries: WaterEntry[];
  /** 0–1 respecto de la meta. Se recorta a 1: la barra no se desborda. */
  progress: number;
  goalReached: boolean;
  excellent: boolean;
};

export async function waterForDay(now: Date, timeZone?: string): Promise<WaterDay> {
  const { start, end } = dayBounds(now, timeZone);

  const eventos = await db.event.findMany({
    where: { kind: "water.logged", startedAt: { gte: start, lt: end } },
    orderBy: { startedAt: "asc" },
    select: { id: true, startedAt: true, timezone: true, payloadJson: true },
  });

  // Un registro anulado no cuenta (I-02): deshacer un vaso mal contado tiene
  // que bajar el total, o el número deja de ser fiable y se abandona.
  const anulados = await revokedAmong(eventos.map((e) => e.id));

  const entries: WaterEntry[] = [];
  for (const e of eventos) {
    if (anulados.has(e.id)) continue;
    let ml = 0;
    let vessel: string | null = null;
    try {
      const p = JSON.parse(e.payloadJson) as { ml?: number; vessel?: string };
      ml = typeof p.ml === "number" ? p.ml : 0;
      vessel = p.vessel ?? null;
    } catch {
      continue;
    }
    // Los eventos que ANULAN a otro llevan ml: 0 —«no bebí nada»— y suman
    // cero, que es lo correcto. Pero no son tragos: mostrarlos llenaría la
    // lista de filas vacías de «0 ml» que el usuario no puso ahí.
    if (ml <= 0) continue;
    entries.push({ id: e.id, ml, vessel, at: e.startedAt, timezone: e.timezone });
  }

  const totalMl = entries.reduce((suma, e) => suma + e.ml, 0);

  return {
    totalMl,
    entries,
    progress: Math.min(1, totalMl / META_ML),
    goalReached: totalMl >= META_ML,
    excellent: totalMl >= EXCELENTE_ML,
  };
}

/**
 * Los recipientes que de verdad usas, ordenados por frecuencia.
 *
 * Degrada solo: sin historial devuelve los de por defecto, y a medida que
 * registras, tus cantidades reales los desplazan. El día uno funciona; el día
 * treinta la primera tarjeta acierta casi siempre.
 */
export async function vesselPresets(
  limit = 4,
): Promise<{ ml: number; label: string; icon: string }[]> {
  const eventos = await db.event.findMany({
    where: { kind: "water.logged" },
    orderBy: { startedAt: "desc" },
    take: 200,
    select: { payloadJson: true },
  });

  const cuenta = new Map<number, number>();
  for (const e of eventos) {
    try {
      const p = JSON.parse(e.payloadJson) as { ml?: number };
      if (typeof p.ml === "number") cuenta.set(p.ml, (cuenta.get(p.ml) ?? 0) + 1);
    } catch {
      /* una fila ilegible no debe vaciar la pantalla */
    }
  }

  const usados = [...cuenta.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([ml]) => ml);

  const conocido = new Map(RECIPIENTES.map((r) => [r.ml, r]));
  const desdeHistorial = usados.map(
    (ml) => conocido.get(ml) ?? { ml, label: etiquetaDe(ml), icon: "💧" },
  );

  // Se rellena con los de por defecto hasta completar, sin repetir.
  const vistos = new Set(desdeHistorial.map((r) => r.ml));
  return [
    ...desdeHistorial,
    ...RECIPIENTES.filter((r) => !vistos.has(r.ml)),
  ].slice(0, limit);
}

function etiquetaDe(ml: number): string {
  return ml >= 1000 ? `${ml / 1000} L` : `${ml} ml`;
}
