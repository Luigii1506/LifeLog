import { db } from "@/lib/db";
import { dayBounds, revokedAmong } from "@/lib/events/query";
import type { EventKind } from "@/lib/events/kinds";
import type { QuickFlowId } from "./catalog";
import { EXCELENTE_ML, META_ML } from "@/lib/water/units";
import { describir } from "./describe";

/**
 * Qué se ha registrado ya hoy.
 *
 * Existe para responder de un vistazo la única pregunta que uno se hace al
 * abrir la app por la tarde: «¿ya me pesé?». Sin esto hay que bajar a la línea
 * de tiempo y leerla, que es exactamente la fricción que el sistema promete
 * quitar — y que en la práctica lleva a registrar dos veces o a no registrar.
 */

/**
 * Flujos cuya tarjeta enseña el DATO en vez de la hora de guardado.
 *
 * «Desperté» no está: ahí la hora es el dato. En sueño o peso, en cambio, la
 * hora de guardado no dice nada — y en el sueño llegaba a confundirse con la
 * hora de acostarse.
 */
const CON_RESUMEN = new Set(["sleep", "weight", "mood"]);

/** Qué evento demuestra que un flujo ya se completó hoy. */
const EVIDENCIA: Record<QuickFlowId, EventKind[]> = {
  wake: ["wake.up"],
  sleep: ["sleep.logged"],
  mood: ["mood.logged"],
  weight: ["weight.logged"],
  medication: ["medication.taken"],
  expense: ["expense.logged"],
  focus: ["focus.block"],
  activity: ["activity.started", "activity.ended"],
  note: ["note.quick"],
};

export type FlowStatus = {
  /** Veces registrado hoy. 0 significa pendiente. */
  count: number;
  /** Hora local del último registro, HH:MM. */
  lastAt: string | null;
  /**
   * Lo registrado, en una línea: «7h 12m», «78.4 kg», «8/10».
   *
   * Es lo que enseña la tarjeta cuando el dato dice más que la hora. En el
   * sueño la hora de guardado no informa de nada —lo que importa es cuánto
   * dormiste— y enseñarla hacía pensar que era la hora de acostarse.
   */
  summary: string | null;
};

export type TodayStatus = {
  flows: Record<string, FlowStatus>;
  gym: { count: number; open: boolean };
  food: { count: number; open: boolean };
  water: { totalMl: number; goalMl: number; excellentMl: number };
};

function horaLocal(fecha: Date, timeZone: string): string {
  return fecha.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  });
}

/**
 * Estado de todas las tarjetas de Hoy en una sola pasada.
 *
 * Una consulta para los nueve flujos, no nueve. Con el arranque en frío de
 * Neon rondando los cuatro segundos, nueve viajes de ida y vuelta se notan.
 */
export async function todayStatus(
  now: Date,
  timeZone?: string,
): Promise<TodayStatus> {
  const { start, end } = dayBounds(now, timeZone);

  const [todos, sesionAbierta, comidaAbierta] = await Promise.all([
    db.event.findMany({
      where: { startedAt: { gte: start, lt: end } },
      select: { id: true, kind: true, startedAt: true, timezone: true, payloadJson: true },
      orderBy: { startedAt: "asc" },
    }),
    db.workoutSession.findFirst({ where: { status: "open" }, select: { id: true } }),
    db.meal.findFirst({ where: { status: "open" }, select: { id: true } }),
  ]);

  // Un evento anulado no cuenta como registrado (I-02): si corregiste algo,
  // la tarjeta debe reflejar la corrección, no el error.
  const anulados = await revokedAmong(todos.map((e) => e.id));
  const eventos = todos.filter((e) => !anulados.has(e.id));

  const porKind = new Map<
    string,
    { count: number; last: Date; zona: string; payload: Record<string, unknown> }
  >();
  for (const e of eventos) {
    const previo = porKind.get(e.kind);
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(e.payloadJson) as Record<string, unknown>;
    } catch {
      /* un payload ilegible no debe vaciar la tarjeta */
    }
    porKind.set(e.kind, {
      count: (previo?.count ?? 0) + 1,
      last: e.startedAt,
      zona: e.timezone,
      payload,
    });
  }

  const flows: Record<string, FlowStatus> = {};
  for (const [flowId, kinds] of Object.entries(EVIDENCIA)) {
    let count = 0;
    let last: { fecha: Date; zona: string } | null = null;
    for (const kind of kinds) {
      const dato = porKind.get(kind);
      if (!dato) continue;
      count += dato.count;
      if (!last || dato.last > last.fecha) last = { fecha: dato.last, zona: dato.zona };
    }
    // El dato manda sobre la hora, pero solo donde dice más: en «Desperté» la
    // hora ES el dato, así que ahí no se sustituye.
    const ultimoKind = kinds
      .map((k) => porKind.get(k))
      .filter((d): d is NonNullable<typeof d> => Boolean(d))
      .sort((a, b) => b.last.getTime() - a.last.getTime())[0];

    const descripcion =
      ultimoKind && count === 1 && CON_RESUMEN.has(flowId)
        ? describir(kinds[0], ultimoKind.payload, ultimoKind.last, ultimoKind.zona)
        : null;

    flows[flowId] = {
      count,
      // La hora se pinta en la zona del propio evento: un registro hecho de
      // viaje debe seguir mostrando la hora a la que ocurrió allí.
      lastAt: last ? horaLocal(last.fecha, last.zona) : null,
      summary: descripcion?.summary ?? null,
    };
  }

  // El agua se suma aparte: la tarjeta no dice «3 veces» sino «1,5 de 2 L».
  // Cuántas veces bebiste no le importa a nadie; cuánto llevas, sí.
  let totalMl = 0;
  for (const e of eventos) {
    if (e.kind !== "water.logged") continue;
    try {
      const p = JSON.parse(e.payloadJson) as { ml?: number };
      if (typeof p.ml === "number") totalMl += p.ml;
    } catch {
      /* una fila ilegible no debe vaciar la pantalla */
    }
  }

  return {
    flows,
    gym: { count: porKind.get("workout.session")?.count ?? 0, open: Boolean(sesionAbierta) },
    food: { count: porKind.get("meal.logged")?.count ?? 0, open: Boolean(comidaAbierta) },
    water: { totalMl, goalMl: META_ML, excellentMl: EXCELENTE_ML },
  };
}
