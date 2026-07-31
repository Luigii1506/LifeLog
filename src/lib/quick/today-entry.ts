import { db } from "@/lib/db";
import { dayBounds, revokedAmong } from "@/lib/events/query";
import type { QuickFlowId } from "./catalog";
import { caraDeAnimo, describir, horaEn } from "./describe";

/**
 * Lo ya registrado hoy en un flujo rápido.
 *
 * Entrar a «Desperté» cuando ya despertaste no debería ofrecerte registrarlo
 * otra vez como si nada: debería enseñarte lo que hay y dejarte corregirlo. Sin
 * esto, la única forma de saber si ya lo habías hecho era volver a Hoy.
 *
 * Solo aplica a los flujos de UNA vez al día. El agua no está aquí: se registra
 * diez veces y tiene su propia pantalla con la lista y el deshacer.
 */

/** Qué evento demuestra que el flujo ya se completó. */
const KIND_DE: Record<string, string> = {
  wake: "wake.up",
  sleep: "sleep.logged",
  mood: "mood.logged",
  weight: "weight.logged",
  medication: "medication.taken",
  expense: "expense.logged",
  focus: "focus.block",
  activity: "activity.started",
  note: "note.quick",
};

/**
 * Flujos que se registran UNA vez al día.
 *
 * Los demás se repiten por naturaleza —tomas tres medicamentos, haces dos
 * bloques de trabajo, apuntas varias notas— y ahí «ya lo hiciste» no significa
 * nada: se apila, no se corrige.
 *
 * El ánimo está aquí porque en la práctica se registra una vez y se corrige, no
 * se acumula: si por la tarde estás peor, lo cambias.
 */
const UNA_VEZ = new Set<QuickFlowId>(["wake", "sleep", "weight", "mood"]);

export type TodayEntry = {
  eventId: string;
  /** Icono para la tarjeta. En el ánimo, la cara que elegiste. */
  icon?: string;
  /**
   * El dato, corto: «07:30», «78 kg», «7h 30m».
   *
   * Corto de verdad. Va en grande, y en un móvil una cifra larga rompe la
   * línea y deja la tarjeta torcida. Lo que no cabe va en `detail`.
   */
  summary: string;
  /** Matiz, en pequeño: «desde las 23:00». */
  detail?: string;
  /**
   * Lo que escribiste tú. Va aparte del resto porque es PROSA, no un dato:
   * se lee, no se ojea, y como línea gris pequeña no se lee.
   */
  note?: string;
  /** Cuándo se pulsó el botón, HH:MM en la zona del evento. */
  loggedAt: string;
  payload: Record<string, unknown>;
};

export function esDeUnaVez(flowId: string): boolean {
  return UNA_VEZ.has(flowId as QuickFlowId);
}

export async function todayEntry(
  flowId: string,
  now: Date,
  timeZone?: string,
): Promise<TodayEntry | null> {
  const kind = KIND_DE[flowId];
  if (!kind || !esDeUnaVez(flowId)) return null;

  const { start, end } = dayBounds(now, timeZone);
  const eventos = await db.event.findMany({
    where: { kind, startedAt: { gte: start, lt: end } },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      startedAt: true,
      createdAt: true,
      timezone: true,
      payloadJson: true,
    },
  });
  if (eventos.length === 0) return null;

  // Un evento corregido no cuenta: lo que vale es la corrección (I-02).
  const anulados = await revokedAmong(eventos.map((e) => e.id));
  const vigente = eventos.find((e) => !anulados.has(e.id));
  if (!vigente) return null;

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(vigente.payloadJson) as Record<string, unknown>;
  } catch {
    /* un payload ilegible no debe romper la pantalla */
  }

  const { summary, detail } = describir(
    kind,
    payload,
    vigente.startedAt,
    vigente.timezone,
  );

  // La nota es común a casi todos los tipos y siempre se llama igual, así que
  // se saca aquí en vez de en cada rama de `describir`.
  const nota = typeof payload.note === "string" ? payload.note.trim() : "";

  return {
    eventId: vigente.id,
    icon:
      kind === "mood.logged" && Number.isFinite(Number(payload.score))
        ? (caraDeAnimo(Number(payload.score)) ?? undefined)
        : undefined,
    summary,
    detail,
    note: nota || undefined,
    loggedAt: horaEn(vigente.createdAt, vigente.timezone),
    payload,
  };
}

function hora(fecha: Date, timeZone: string): string {
  return fecha.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  });
}
