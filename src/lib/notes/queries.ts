import { db } from "@/lib/db";
import { dateKeyIn } from "@/lib/timezone";
import { revokedAmong } from "@/lib/events/query";
import { ETIQUETA_POR_DEFECTO } from "./tags";

/**
 * Notas capturadas, para volver a encontrarlas.
 *
 * Lo que decide si un sistema de captura sirve no es apuntar rápido —eso es
 * fácil— sino poder encontrar lo apuntado. Por eso esto no se limita al día:
 * una idea de hace tres días sigue siendo una idea pendiente de procesar.
 */

export type Nota = {
  id: string;
  text: string;
  tag: string;
  at: Date;
  timezone: string;
};

export type NotasPorDia = { dateKey: string; notas: Nota[] };

/** Cuántos días atrás se miran. Más allá, la lista deja de ser una bandeja. */
const DIAS = 30;

export async function recentNotes(
  now: Date,
  timeZone = "America/Tijuana",
): Promise<Nota[]> {
  const desde = new Date(now.getTime() - DIAS * 24 * 60 * 60 * 1000);

  const eventos = await db.event.findMany({
    where: { kind: "note.quick", startedAt: { gte: desde } },
    orderBy: { startedAt: "desc" },
    select: { id: true, startedAt: true, timezone: true, payloadJson: true },
  });

  const ocultos = await revokedAmong(eventos.map((e) => e.id));

  const notas: Nota[] = [];
  for (const e of eventos) {
    if (ocultos.has(e.id)) continue;
    try {
      const p = JSON.parse(e.payloadJson) as { text?: string; tag?: string };
      const text = (p.text ?? "").trim();
      if (!text) continue;
      notas.push({
        id: e.id,
        text,
        // Las notas de antes de que existieran las etiquetas no llevan
        // ninguna: caen en la genérica en vez de desaparecer del filtro.
        tag: p.tag || ETIQUETA_POR_DEFECTO,
        at: e.startedAt,
        timezone: e.timezone || timeZone,
      });
    } catch {
      /* una fila ilegible no debe vaciar la bandeja */
    }
  }
  return notas;
}

/**
 * Agrupadas por día, en la zona de cada nota.
 *
 * Agrupar es lo que convierte una lista larga en algo que se ojea: sin
 * cabeceras, treinta notas seguidas son un muro.
 */
export function agruparPorDia(notas: Nota[]): NotasPorDia[] {
  const porDia = new Map<string, Nota[]>();
  for (const n of notas) {
    const clave = dateKeyIn(n.at, n.timezone);
    const lista = porDia.get(clave) ?? [];
    lista.push(n);
    porDia.set(clave, lista);
  }
  return [...porDia.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([dateKey, notas]) => ({ dateKey, notas }));
}

/** Cuántas hay de cada etiqueta, para los filtros. */
export function contarPorEtiqueta(notas: Nota[]): Record<string, number> {
  const cuenta: Record<string, number> = {};
  for (const n of notas) cuenta[n.tag] = (cuenta[n.tag] ?? 0) + 1;
  return cuenta;
}
