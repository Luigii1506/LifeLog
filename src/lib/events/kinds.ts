import { z } from "zod";

/**
 * Catálogo de tipos de evento de la columna vertebral (ADR-109).
 *
 * Añadir un dominio ligero = añadir una entrada aquí. Cero DDL, cero migración.
 * Si un dominio nuevo necesita más que esto, se clasificó mal: revisar la regla
 * de clasificación en "Modelo de Dominio - Conocimiento y Eventos" §5.2.
 *
 * Identificadores en inglés ASCII (ADR-107).
 */

export const EVENT_DOMAINS = [
  "health",
  "nutrition",
  "training",
  "finance",
  "place",
  "reading",
  "media",
  "people",
  "work",
  "ritual",
  "protocol",
  "life",
] as const;

export type EventDomain = (typeof EVENT_DOMAINS)[number];

type KindDefinition = {
  domain: EventDomain;
  /** Versión del payload. Subirla NO invalida los eventos antiguos. */
  version: number;
  /** Etiqueta para la línea de tiempo. */
  label: string;
  /** Si true, el evento lo emite un dominio profundo al cerrar sesión (I-11). */
  fromDeepDomain?: boolean;
  schema: z.ZodType;
};

// ── Salud ───────────────────────────────────────────────────────────

const sleepLogged = z.object({
  hours: z.number().min(0).max(24),
  quality: z.number().int().min(1).max(10).optional(),
  bedtime: z.string().optional(),
  waketime: z.string().optional(),
  awakenings: z.number().int().min(0).optional(),
  note: z.string().optional(),
});

const wakeUp = z.object({
  energy: z.number().int().min(1).max(10).optional(),
  note: z.string().optional(),
});

const weightLogged = z.object({
  kg: z.number().positive(),
  bodyFatPct: z.number().min(0).max(100).optional(),
  note: z.string().optional(),
});

const medicationTaken = z.object({
  name: z.string().min(1),
  dose: z.number().positive().optional(),
  unit: z.string().optional(),
  note: z.string().optional(),
});

const waterLogged = z.object({
  /// Mililitros. Entero: nadie bebe 249,7 ml, y el decimal invita a precisión
  /// falsa en un dato que se estima a ojo.
  ///
  /// Se admite 0 porque deshacer un registro es emitir uno que lo anula (I-02),
  /// y ese anulador significa «no bebí nada»: sumándolo, el total no cambia. Si
  /// exigiera un positivo, deshacer añadiría agua que no bebiste.
  ml: z.number().int().min(0).max(3000),
  /// 'vaso' · 'botella' · 'termo'. Para reconstruir de dónde salió la cifra.
  vessel: z.string().optional(),
});

const moodLogged = z.object({
  score: z.number().int().min(1).max(10),
  label: z.string().optional(),
  note: z.string().optional(),
});

// ── Dominios profundos: eventos resumen (I-11) ──────────────────────

const workoutSession = z.object({
  /// ULID de WorkoutSession. El detalle vive en exercise_sets, no aquí.
  sessionId: z.string(),
  routine: z.string().optional(),
  durationMin: z.number().int().min(0),
  volumeKg: z.number().min(0),
  setCount: z.number().int().min(0),
  prs: z.array(z.string()).default([]),
  rpe: z.number().int().min(1).max(10).optional(),
});

const mealLogged = z.object({
  /// ULID de Meal. El detalle vive en meal_items, no aquí.
  mealId: z.string(),
  mealType: z.string(),
  recipe: z.string().optional(),
  itemCount: z.number().int().min(0),
  kcal: z.number().min(0).optional(),
  proteinG: z.number().min(0).optional(),
  carbsG: z.number().min(0).optional(),
  fatG: z.number().min(0).optional(),
});

// ── Dominios ligeros ────────────────────────────────────────────────

const expenseLogged = z.object({
  amount: z.number(),
  currency: z.string().default("MXN"),
  category: z.string().optional(),
  merchant: z.string().optional(),
  note: z.string().optional(),
});

const placeVisit = z.object({
  durationMin: z.number().int().min(0).optional(),
  spend: z.number().min(0).optional(),
  with: z.array(z.string()).default([]),
  purpose: z.string().optional(),
  note: z.string().optional(),
});

const focusBlock = z.object({
  minutes: z.number().int().min(0),
  task: z.string().optional(),
  project: z.string().optional(),
  interruptions: z.number().int().min(0).optional(),
});

const activityStarted = z.object({
  activity: z.string().min(1),
  note: z.string().optional(),
});

const activityEnded = z.object({
  activity: z.string().min(1),
  minutes: z.number().int().min(0).optional(),
  note: z.string().optional(),
});

const ritualExecuted = z.object({
  name: z.string().min(1),
  completed: z.boolean(),
  score: z.number().int().min(1).max(10).optional(),
  note: z.string().optional(),
});

const quickNote = z.object({
  text: z.string().min(1),
  /// 'idea' · 'pendiente' · 'revisar' · 'nota'. Opcional: una nota sin
  /// etiquetar sigue siendo una nota, y obligar a clasificar en el momento de
  /// capturar es lo que hace que se deje de capturar.
  tag: z.string().optional(),
});

export const EVENT_KINDS = {
  "sleep.logged": {
    domain: "health",
    version: 1,
    label: "Sueño",
    schema: sleepLogged,
  },
  "wake.up": { domain: "health", version: 1, label: "Desperté", schema: wakeUp },
  "water.logged": {
    domain: "health",
    version: 1,
    label: "Agua",
    schema: waterLogged,
  },
  "weight.logged": {
    domain: "health",
    version: 1,
    label: "Peso",
    schema: weightLogged,
  },
  "medication.taken": {
    domain: "health",
    version: 1,
    label: "Medicamento",
    schema: medicationTaken,
  },
  "mood.logged": {
    domain: "health",
    version: 1,
    label: "Ánimo",
    schema: moodLogged,
  },
  "workout.session": {
    domain: "training",
    version: 1,
    label: "Entrenamiento",
    fromDeepDomain: true,
    schema: workoutSession,
  },
  "meal.logged": {
    domain: "nutrition",
    version: 1,
    label: "Comida",
    fromDeepDomain: true,
    schema: mealLogged,
  },
  "expense.logged": {
    domain: "finance",
    version: 1,
    label: "Gasto",
    schema: expenseLogged,
  },
  "place.visit": {
    domain: "place",
    version: 1,
    label: "Lugar",
    schema: placeVisit,
  },
  "focus.block": {
    domain: "work",
    version: 1,
    label: "Trabajo profundo",
    schema: focusBlock,
  },
  "activity.started": {
    domain: "life",
    version: 1,
    label: "Inicio",
    schema: activityStarted,
  },
  "activity.ended": {
    domain: "life",
    version: 1,
    label: "Fin",
    schema: activityEnded,
  },
  "ritual.executed": {
    domain: "ritual",
    version: 1,
    label: "Ritual",
    schema: ritualExecuted,
  },
  "note.quick": {
    domain: "life",
    version: 1,
    label: "Nota",
    schema: quickNote,
  },
} as const satisfies Record<string, KindDefinition>;

export type EventKind = keyof typeof EVENT_KINDS;

export function isEventKind(value: string): value is EventKind {
  return value in EVENT_KINDS;
}

export function kindDefinition(kind: EventKind) {
  return EVENT_KINDS[kind] as KindDefinition;
}
