import { db } from "@/lib/db";
import { dayBounds, revokedAmong } from "@/lib/events/query";
import type { EventKind } from "@/lib/events/kinds";
import type { QuickFlowId } from "./catalog";

/**
 * Qué se ha registrado ya hoy.
 *
 * Existe para responder de un vistazo la única pregunta que uno se hace al
 * abrir la app por la tarde: «¿ya me pesé?». Sin esto hay que bajar a la línea
 * de tiempo y leerla, que es exactamente la fricción que el sistema promete
 * quitar — y que en la práctica lleva a registrar dos veces o a no registrar.
 */

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
};

export type TodayStatus = {
  flows: Record<string, FlowStatus>;
  gym: { count: number; open: boolean };
  food: { count: number; open: boolean };
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
      select: { id: true, kind: true, startedAt: true, timezone: true },
      orderBy: { startedAt: "asc" },
    }),
    db.workoutSession.findFirst({ where: { status: "open" }, select: { id: true } }),
    db.meal.findFirst({ where: { status: "open" }, select: { id: true } }),
  ]);

  // Un evento anulado no cuenta como registrado (I-02): si corregiste algo,
  // la tarjeta debe reflejar la corrección, no el error.
  const anulados = await revokedAmong(todos.map((e) => e.id));
  const eventos = todos.filter((e) => !anulados.has(e.id));

  const porKind = new Map<string, { count: number; last: Date; zona: string }>();
  for (const e of eventos) {
    const previo = porKind.get(e.kind);
    porKind.set(e.kind, {
      count: (previo?.count ?? 0) + 1,
      last: e.startedAt,
      zona: e.timezone,
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
    flows[flowId] = {
      count,
      // La hora se pinta en la zona del propio evento: un registro hecho de
      // viaje debe seguir mostrando la hora a la que ocurrió allí.
      lastAt: last ? horaLocal(last.fecha, last.zona) : null,
    };
  }

  return {
    flows,
    gym: { count: porKind.get("workout.session")?.count ?? 0, open: Boolean(sesionAbierta) },
    food: { count: porKind.get("meal.logged")?.count ?? 0, open: Boolean(comidaAbierta) },
  };
}
