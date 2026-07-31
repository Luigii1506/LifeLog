import { db } from "@/lib/db";
import { dayBounds, revokedAmong } from "@/lib/events/query";
import { SUPLEMENTOS, formatoDosis, type Supplement } from "./catalog";

/**
 * Lo tomado hoy, por suplemento.
 *
 * Se calcula desde los eventos, sin tabla propia: un suplemento es un nombre,
 * una cantidad y una hora (ADR-109, dominio ligero).
 *
 * El emparejamiento va por NOMBRE porque es lo que guarda el evento. Si algún
 * día se renombra un suplemento del catálogo, lo tomado antes queda huérfano —
 * por eso `name` no se cambia a la ligera.
 */

export type SupplementEntry = {
  id: string;
  dose: number | null;
  at: Date;
  timezone: string;
};

export type SupplementToday = {
  supplement: Supplement;
  /** Suma del día. Nulo en los de un toque, que no llevan cantidad. */
  total: number | null;
  /** Cuántas veces lo tomaste hoy. */
  count: number;
  /** «2 scoops», «5 g», o «✓» en los de un toque. */
  summary: string;
  entries: SupplementEntry[];
};

export async function supplementsForDay(
  now: Date,
  timeZone?: string,
): Promise<SupplementToday[]> {
  const { start, end } = dayBounds(now, timeZone);

  const eventos = await db.event.findMany({
    where: { kind: "medication.taken", startedAt: { gte: start, lt: end } },
    orderBy: { startedAt: "asc" },
    select: { id: true, startedAt: true, timezone: true, payloadJson: true },
  });

  // Un registro retirado no cuenta: si te equivocaste de tarjeta, el total
  // tiene que bajar o la cuenta deja de servir.
  const ocultos = await revokedAmong(eventos.map((e) => e.id));

  const porNombre = new Map<string, SupplementEntry[]>();
  for (const e of eventos) {
    if (ocultos.has(e.id)) continue;
    let name = "";
    let dose: number | null = null;
    try {
      const p = JSON.parse(e.payloadJson) as { name?: string; dose?: number };
      name = p.name ?? "";
      dose = typeof p.dose === "number" ? p.dose : null;
    } catch {
      continue;
    }
    if (!name) continue;
    const lista = porNombre.get(name) ?? [];
    lista.push({ id: e.id, dose, at: e.startedAt, timezone: e.timezone });
    porNombre.set(name, lista);
  }

  return SUPLEMENTOS.map((s) => {
    const entries = porNombre.get(s.name) ?? [];
    const total =
      s.dosing.kind === "steps"
        ? entries.reduce((suma, e) => suma + (e.dose ?? 0), 0)
        : null;

    return {
      supplement: s,
      total,
      count: entries.length,
      summary:
        entries.length === 0
          ? "pendiente"
          : total !== null
            ? formatoDosis(total, s.dosing)
            : entries.length > 1
              ? `${entries.length} veces`
              : "tomado",
      entries,
    };
  });
}
