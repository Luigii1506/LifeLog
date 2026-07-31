import { db } from "@/lib/db";
import type { FlowStep } from "@/components/guided/guided-flow";
import { type EventKind } from "@/lib/events/kinds";
import { duracionHasta } from "@/lib/sleep-duration";
import type { QuickFlowId } from "./catalog";

export type { QuickFlowId };

/**
 * Flujos de captura guiada para los dominios ligeros.
 *
 * Cada flujo es una lista lineal de pasos y una función que arma el payload.
 * Los pasos se calculan en el servidor con contexto real —tu último peso, tus
 * medicamentos, tus categorías de gasto— para que las opciones sean tuyas y no
 * de un catálogo genérico.
 *
 * Los dominios profundos (gimnasio, alimentación) NO están aquí: tienen su
 * propio flujo porque necesitan ramificación y estado.
 */


export type QuickFlowSpec = {
  id: QuickFlowId;
  kind: EventKind;
  label: string;
  icon: string;
  /** Frase de confirmación al terminar. */
  done: string;
  steps: FlowStep[];
  /** Convierte las respuestas en el payload del evento. */
  build: (answers: Record<string, string | number>) => Record<string, unknown>;
  /**
   * Id del paso cuyo valor "HH:MM" fija `startedAt`.
   *
   * Sin esto, «Desperté» guardaría la hora en que abriste la app, no la hora
   * a la que despertaste — que es justo el dato que importa.
   */
  startedAtFrom?: string;
};

/** Escala de ánimo con caras. Cinco opciones, no diez: elegir entre 7 y 8 es ruido. */
const CARAS: [string, string, number][] = [
  ["😖", "Mal", 2],
  ["😕", "Regular", 4],
  ["😐", "Normal", 6],
  ["🙂", "Bien", 8],
  ["🤩", "Excelente", 10],
];

const CATEGORIAS_GASTO = [
  ["🍽", "Comida"], ["🛒", "Súper"], ["⛽", "Transporte"], ["🏠", "Casa"],
  ["💊", "Salud"], ["🎬", "Ocio"], ["👕", "Ropa"], ["📦", "Otro"],
] as const;

/** Últimos valores distintos de un campo del payload, para ofrecerlos como opciones. */
async function recentValues(
  kind: EventKind,
  field: string,
  limit = 6,
): Promise<string[]> {
  const eventos = await db.event.findMany({
    where: { kind },
    orderBy: { startedAt: "desc" },
    take: 120,
    select: { payloadJson: true },
  });

  const cuenta = new Map<string, number>();
  for (const { payloadJson } of eventos) {
    try {
      const valor = (JSON.parse(payloadJson) as Record<string, unknown>)[field];
      if (typeof valor === "string" && valor.trim()) {
        cuenta.set(valor, (cuenta.get(valor) ?? 0) + 1);
      }
    } catch {
      // Un payload ilegible no debe tumbar el formulario.
    }
  }

  return [...cuenta.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([valor]) => valor);
}

/**
 * El despertar más reciente, si es de las últimas horas.
 *
 * Es lo que permite deducir cuánto dormiste en vez de preguntarlo. El límite
 * de 20 horas evita usar el despertar de anteayer si un día no lo registraste:
 * más vale preguntar la hora de despertar que calcular con un dato viejo.
 */
async function ultimoDespertar(): Promise<Date | null> {
  const limite = new Date(Date.now() - 20 * 60 * 60 * 1000);
  const evento = await db.event.findFirst({
    where: { kind: "wake.up", startedAt: { gte: limite } },
    orderBy: { startedAt: "desc" },
    select: { id: true, startedAt: true },
  });
  if (!evento) return null;

  // I-02: un despertar anulado por una corrección no cuenta.
  const anulado = await db.event.findFirst({
    where: { revokesId: evento.id },
    select: { id: true },
  });
  return anulado ? null : evento.startedAt;
}

async function lastNumber(kind: EventKind, field: string): Promise<number | null> {
  const evento = await db.event.findFirst({
    where: { kind },
    orderBy: { startedAt: "desc" },
    select: { payloadJson: true },
  });
  if (!evento) return null;
  try {
    const valor = (JSON.parse(evento.payloadJson) as Record<string, unknown>)[field];
    return typeof valor === "number" ? valor : null;
  } catch {
    return null;
  }
}

/** Escala alrededor de un valor conocido: confirmar gana a teclear. */
function alrededorDe(valor: number | null, paso: number, porDefecto: number[]): number[] {
  if (valor === null) return porDefecto;
  const base = Math.round(valor / paso) * paso;
  return [base - paso, base - paso / 2, base, base + paso / 2].map(
    (v) => Math.round(v * 10) / 10,
  );
}

export async function buildQuickFlow(id: QuickFlowId): Promise<QuickFlowSpec | null> {
  switch (id) {
    case "wake":
      return {
        id, kind: "wake.up", label: "Desperté", icon: "🌅", done: "Buenos días",
        startedAtFrom: "at",
        steps: [
          {
            type: "time", id: "at", question: "¿A qué hora despertaste?",
            hint: "Desliza para ajustar", confirmLabel: "Desperté a las",
          },
        ],
        build: () => ({}),
      };

    case "sleep": {
      const despertar = await ultimoDespertar();

      // Con la hora de despertar registrada, las horas se deducen: se pregunta
      // a qué hora te acostaste —que se sabe— en vez de cuántas horas
      // dormiste, que obliga a una resta de memoria y medio dormido.
      if (despertar) {
        const hhmm = `${String(despertar.getHours()).padStart(2, "0")}:${String(
          despertar.getMinutes(),
        ).padStart(2, "0")}`;
        return {
          id, kind: "sleep.logged", label: "Sueño", icon: "😴",
          done: "Sueño registrado",
          steps: [
            {
              type: "time", id: "bedtime", question: "¿A qué hora te dormiste?",
              hint: "Desliza para ajustar",
              confirmLabel: "Me dormí a las",
              defaultValue: "23:00",
              until: despertar.toISOString(),
              untilLabel: `despertaste a las ${hhmm}`,
            },
          ],
          build: (a) => {
            const [h, m] = String(a.bedtime).split(":").map(Number);
            const duracion = duracionHasta({ hour: h, minute: m }, despertar.toISOString());
            return {
              // Se guardan las dos horas y el cálculo. Las horas son el dato
              // que se consulta; las horas de reloj son lo que permite
              // recalcularlo si mañana cambia la definición.
              bedtime: String(a.bedtime),
              waketime: hhmm,
              hours: duracion ? Math.round((duracion.minutos / 60) * 10) / 10 : 0,
            };
          },
        };
      }

      // Sin despertar registrado no hay nada contra lo que medir. Se vuelve a
      // preguntar las horas: peor pregunta, pero mejor que inventar el dato.
      return {
        id, kind: "sleep.logged", label: "Sueño", icon: "😴", done: "Sueño registrado",
        steps: [
          {
            type: "quantity", id: "hours", question: "¿Cuántas horas dormiste?",
            hint: "Registra «Desperté» primero y esto se calcula solo",
            presets: [5, 6, 7, 8], unit: "h", suggested: 7,
          },
        ],
        build: (a) => ({ hours: Number(a.hours) }),
      };
    }

    case "weight": {
      const ultimo = await lastNumber("weight.logged", "kg");
      return {
        id, kind: "weight.logged", label: "Peso", icon: "⚖️", done: "Peso registrado",
        steps: [
          {
            type: "quantity", id: "kg", question: "¿Cuánto pesas?",
            hint: ultimo ? `La última vez: ${ultimo} kg` : undefined,
            presets: alrededorDe(ultimo, 1, [60, 70, 80, 90]),
            unit: "kg", suggested: ultimo,
          },
        ],
        build: (a) => ({ kg: Number(a.kg) }),
      };
    }

    case "medication": {
      const usados = await recentValues("medication.taken", "name");
      return {
        id, kind: "medication.taken", label: "Medicamento", icon: "💊",
        done: "Medicamento registrado",
        steps: [
          {
            type: "choice", id: "name", question: "¿Cuál tomaste?",
            customLabel: "Otro",
            options: (usados.length ? usados : ["Medicamento"]).map((nombre) => ({
              value: nombre, label: nombre, icon: "💊",
            })),
          },
        ],
        build: (a) => ({ name: String(a.name) }),
      };
    }

    case "mood":
      return {
        id, kind: "mood.logged", label: "Ánimo", icon: "😊", done: "Ánimo registrado",
        steps: [
          {
            type: "choice", id: "score", question: "¿Cómo te sientes?",
            columns: 5, coerce: "number",
            options: CARAS.map(([icon, label, valor]) => ({
              value: String(valor), label, icon,
            })),
          },
          {
            type: "text", id: "note", question: "¿Por qué?",
            placeholder: "Opcional", multiline: true, skipLabel: "Sin nota",
          },
        ],
        build: (a) => ({
          score: Number(a.score),
          ...(a.note ? { note: String(a.note) } : {}),
        }),
      };

    case "expense": {
      const lugares = await recentValues("expense.logged", "merchant");
      return {
        id, kind: "expense.logged", label: "Gasto", icon: "💸", done: "Gasto registrado",
        steps: [
          {
            type: "quantity", id: "amount", question: "¿Cuánto gastaste?",
            hint: "Pesos", presets: [50, 100, 200, 500], unit: "MXN",
          },
          {
            type: "choice", id: "category", question: "¿En qué?",
            options: CATEGORIAS_GASTO.map(([icon, label]) => ({
              value: label.toLowerCase(), label, icon,
            })),
          },
          {
            type: "choice", id: "merchant", question: "¿Dónde?",
            customLabel: "Otro lugar", skipLabel: "Sin lugar",
            options: lugares.map((nombre) => ({ value: nombre, label: nombre, icon: "📍" })),
          },
        ],
        build: (a) => ({
          amount: Number(a.amount),
          currency: "MXN",
          category: String(a.category),
          ...(a.merchant ? { merchant: String(a.merchant) } : {}),
        }),
      };
    }

    case "focus": {
      const tareas = await recentValues("focus.block", "task");
      return {
        id, kind: "focus.block", label: "Trabajo", icon: "🎯",
        done: "Bloque registrado",
        steps: [
          {
            type: "quantity", id: "minutes", question: "¿Cuánto tiempo?",
            presets: [25, 50, 90, 120], unit: "min", suggested: 50,
          },
          {
            type: "choice", id: "task", question: "¿En qué?",
            customLabel: "Otra cosa", skipLabel: "Sin detalle",
            options: tareas.map((t) => ({ value: t, label: t, icon: "🎯" })),
          },
        ],
        build: (a) => ({
          minutes: Number(a.minutes),
          ...(a.task ? { task: String(a.task) } : {}),
        }),
      };
    }

    case "activity": {
      const hechas = await recentValues("activity.started", "activity");
      const base = hechas.length
        ? hechas
        : ["Gimnasio", "Trabajo", "Lectura", "Caminata"];
      return {
        id, kind: "activity.started", label: "Actividad", icon: "⏱",
        done: "Actividad iniciada",
        steps: [
          {
            type: "choice", id: "activity", question: "¿Qué empiezas?",
            customLabel: "Otra actividad",
            options: base.map((nombre) => ({ value: nombre, label: nombre, icon: "⏱" })),
          },
        ],
        build: (a) => ({ activity: String(a.activity) }),
      };
    }

    case "note":
      return {
        id, kind: "note.quick", label: "Nota", icon: "📝", done: "Nota registrada",
        steps: [
          {
            type: "text", id: "text", question: "¿Qué quieres anotar?",
            placeholder: "Lo que sea", multiline: true,
          },
        ],
        build: (a) => ({ text: String(a.text) }),
      };

    default:
      return null;
  }
}

