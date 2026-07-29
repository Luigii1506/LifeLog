import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase, HAY_BASE_DE_PRUEBAS } from "./setup-db";

let cleanup: () => void;
let db: Awaited<ReturnType<typeof loadDb>>["db"];
let gym: typeof import("@/lib/gym/session");
let queries: typeof import("@/lib/gym/queries");

async function loadDb(url: string) {
  process.env.DATABASE_URL = url;
  const { db } = await import("@/lib/db");
  return { db };
}

let pressMilitarId: string;
let elevacionesId: string;

beforeAll(async () => {
  if (!HAY_BASE_DE_PRUEBAS) return;
  const test = createTestDatabase();
  cleanup = test.cleanup;
  ({ db } = await loadDb(test.url));
  gym = await import("@/lib/gym/session");
  queries = await import("@/lib/gym/queries");
});

afterAll(async () => {
  if (!HAY_BASE_DE_PRUEBAS) return;
  await db.$disconnect();
  cleanup?.();
});

beforeEach(async () => {
  if (!HAY_BASE_DE_PRUEBAS) return;
  await db.exerciseSet.deleteMany();
  await db.workoutSession.deleteMany();
  await db.exercise.deleteMany();

  const { newId } = await import("@/lib/ids");
  pressMilitarId = newId();
  elevacionesId = newId();
  await db.exercise.createMany({
    data: [
      { id: pressMilitarId, name: "Press militar", muscleGroup: "hombro", equipment: "barra" },
      { id: elevacionesId, name: "Elevaciones laterales", muscleGroup: "hombro", equipment: "mancuerna" },
    ],
  });
});

async function sesionCompleta(sets: Array<[number, number]>, exerciseId = pressMilitarId) {
  const s = await gym.startSession();
  for (const [weightKg, reps] of sets) {
    await gym.logSet({ sessionId: s.id, exerciseId, weightKg, reps });
  }
  return gym.closeSession(s.id);
}

// ── Ciclo de vida ───────────────────────────────────────────────────────

describe.skipIf(!HAY_BASE_DE_PRUEBAS)("ciclo de vida de la sesión", () => {
  it("solo puede haber una sesión abierta a la vez", async () => {
    await gym.startSession();
    await expect(gym.startSession()).rejects.toThrow(/sesión abierta/);
  });

  it("las series se numeran por ejercicio, no por sesión", async () => {
    const s = await gym.startSession();
    await gym.logSet({ sessionId: s.id, exerciseId: pressMilitarId, weightKg: 40, reps: 10 });
    await gym.logSet({ sessionId: s.id, exerciseId: elevacionesId, weightKg: 12, reps: 15 });
    await gym.logSet({ sessionId: s.id, exerciseId: pressMilitarId, weightKg: 40, reps: 9 });

    const detalle = await queries.getSession(s.id);
    const press = detalle!.sets.filter((x) => x.exerciseId === pressMilitarId);
    const elev = detalle!.sets.filter((x) => x.exerciseId === elevacionesId);
    expect(press.map((x) => x.setIndex)).toEqual([1, 2]);
    expect(elev.map((x) => x.setIndex)).toEqual([1]);
  });

  it("una sesión cerrada es inmutable", async () => {
    const s = await gym.startSession();
    await gym.logSet({ sessionId: s.id, exerciseId: pressMilitarId, weightKg: 40, reps: 10 });
    await gym.closeSession(s.id);

    await expect(
      gym.logSet({ sessionId: s.id, exerciseId: pressMilitarId, weightKg: 40, reps: 8 }),
    ).rejects.toThrow(/cerrada/);
  });

  it("no se descarta una sesión con series registradas", async () => {
    const s = await gym.startSession();
    await gym.logSet({ sessionId: s.id, exerciseId: pressMilitarId, weightKg: 40, reps: 10 });
    await expect(gym.discardSession(s.id)).rejects.toThrow(/Ciérrala/);
  });
});

// ── I-11: el evento resumen es obligatorio ──────────────────────────────

describe.skipIf(!HAY_BASE_DE_PRUEBAS)("I-11 — todo dominio profundo emite su evento resumen", () => {
  it("cerrar emite workout.session y lo enlaza a la sesión", async () => {
    const resultado = await sesionCompleta([[40, 10], [40, 9], [40, 8]]);

    const evento = await db.event.findUnique({ where: { id: resultado.eventId } });
    expect(evento).not.toBeNull();
    expect(evento!.kind).toBe("workout.session");
    expect(evento!.domain).toBe("training");

    const sesion = await db.workoutSession.findUnique({ where: { id: resultado.sessionId } });
    expect(sesion!.eventId).toBe(resultado.eventId);
    expect(sesion!.status).toBe("closed");
  });

  it("no queda ninguna sesión cerrada sin evento", async () => {
    await sesionCompleta([[40, 10]]);
    const huerfanas = await db.workoutSession.count({
      where: { status: "closed", eventId: null },
    });
    expect(huerfanas).toBe(0);
  });

  it("el evento resume, no duplica: lleva agregados y session_id", async () => {
    const resultado = await sesionCompleta([[40, 10], [40, 9]]);
    const evento = await db.event.findUnique({ where: { id: resultado.eventId } });
    const payload = JSON.parse(evento!.payloadJson);

    expect(payload.sessionId).toBe(resultado.sessionId);
    expect(payload.volumeKg).toBe(40 * 10 + 40 * 9);
    expect(payload.setCount).toBe(2);
    // El detalle NO viaja en el payload: vive en exercise_sets.
    expect(payload.sets).toBeUndefined();
  });
});

// ── Agregados ───────────────────────────────────────────────────────────

describe.skipIf(!HAY_BASE_DE_PRUEBAS)("agregados al cerrar", () => {
  it("el volumen suma reps × peso", async () => {
    const r = await sesionCompleta([[40, 10], [40, 9], [35, 12]]);
    expect(r.volumeKg).toBe(40 * 10 + 40 * 9 + 35 * 12);
  });

  it("el calentamiento no cuenta para el volumen ni para el conteo", async () => {
    const s = await gym.startSession();
    await gym.logSet({ sessionId: s.id, exerciseId: pressMilitarId, weightKg: 20, reps: 15, setType: "warmup" });
    await gym.logSet({ sessionId: s.id, exerciseId: pressMilitarId, weightKg: 40, reps: 10 });
    const r = await gym.closeSession(s.id);

    expect(r.volumeKg).toBe(400);
    expect(r.setCount).toBe(1);
  });
});

// ── LA consulta que justifica ADR-109 ───────────────────────────────────

describe.skipIf(!HAY_BASE_DE_PRUEBAS)("ADR-109 — la sesión anterior mientras registras", () => {
  it("devuelve las series de la última sesión cerrada", async () => {
    await sesionCompleta([[40, 10], [40, 9], [40, 8]]);

    const anterior = await queries.lastSetsFor(pressMilitarId);
    expect(anterior).not.toBeNull();
    expect(anterior!.sets.map((s) => [s.weightKg, s.reps])).toEqual([
      [40, 10],
      [40, 9],
      [40, 8],
    ]);
  });

  it("devuelve la ÚLTIMA, no la primera", async () => {
    await sesionCompleta([[40, 10]]);
    await sesionCompleta([[45, 8]]);

    const anterior = await queries.lastSetsFor(pressMilitarId);
    expect(anterior!.sets.map((s) => s.weightKg)).toEqual([45]);
  });

  it("excluye la sesión en curso: si no, te mostraría lo que acabas de hacer", async () => {
    await sesionCompleta([[40, 10]]);
    const actual = await gym.startSession();
    await gym.logSet({ sessionId: actual.id, exerciseId: pressMilitarId, weightKg: 50, reps: 5 });

    const anterior = await queries.lastSetsFor(pressMilitarId, {
      excludeSessionId: actual.id,
    });
    expect(anterior!.sets.map((s) => s.weightKg)).toEqual([40]);
  });

  it("no mezcla ejercicios", async () => {
    await sesionCompleta([[40, 10]], pressMilitarId);
    await sesionCompleta([[12, 15]], elevacionesId);

    expect((await queries.lastSetsFor(pressMilitarId))!.sets[0].weightKg).toBe(40);
    expect((await queries.lastSetsFor(elevacionesId))!.sets[0].weightKg).toBe(12);
  });

  it("devuelve null la primera vez que se hace un ejercicio", async () => {
    expect(await queries.lastSetsFor(pressMilitarId)).toBeNull();
  });

  it("ignora las sesiones abiertas: solo lo confirmado es referencia", async () => {
    const s = await gym.startSession();
    await gym.logSet({ sessionId: s.id, exerciseId: pressMilitarId, weightKg: 40, reps: 10 });
    expect(await queries.lastSetsFor(pressMilitarId)).toBeNull();
  });
});

// ── Récords ─────────────────────────────────────────────────────────────

describe.skipIf(!HAY_BASE_DE_PRUEBAS)("récords personales", () => {
  it("la primera sesión de un ejercicio es récord", async () => {
    const r = await sesionCompleta([[40, 10]]);
    expect(r.prs).toEqual(["Press militar 40×10"]);
  });

  it("mejorar una repetición con el mismo peso es récord", async () => {
    await sesionCompleta([[40, 10]]);
    const r = await sesionCompleta([[40, 11]]);
    expect(r.prs).toEqual(["Press militar 40×11"]);
  });

  it("repetir exactamente lo mismo no es récord", async () => {
    await sesionCompleta([[40, 10]]);
    const r = await sesionCompleta([[40, 10]]);
    expect(r.prs).toEqual([]);
  });

  it("hacer menos no es récord", async () => {
    await sesionCompleta([[40, 10]]);
    const r = await sesionCompleta([[40, 8]]);
    expect(r.prs).toEqual([]);
  });

  it("el 1RM estimado ordena peso contra repeticiones", () => {
    // 40×10 ≈ 53.3 · 45×8 ≈ 57 → más peso con menos reps sí es progreso
    expect(queries.estimatedOneRepMax(45, 8)).toBeGreaterThan(
      queries.estimatedOneRepMax(40, 10),
    );
    // una repetición única es su propio 1RM
    expect(queries.estimatedOneRepMax(60, 1)).toBe(60);
  });
});

// ── Zona horaria ────────────────────────────────────────────────────────

describe.skipIf(!HAY_BASE_DE_PRUEBAS)("zona horaria de la sesión", () => {
  it("guarda la del usuario, no la del servidor", async () => {
    // El fallo real que esto previene: el parámetro existía en `startSession`
    // pero ninguna acción lo pasaba, así que toda sesión se guardaba como UTC
    // y en Tijuana caía siete horas desplazada — a veces en el día anterior.
    const s = await gym.startSession({ timeZone: "America/Tijuana" });
    expect(s.timezone).toBe("America/Tijuana");
    await gym.discardSession(s.id);
  });

  it("sin zona explícita cae a UTC, que es honesto pero no debe ocurrir", async () => {
    const s = await gym.startSession({});
    expect(s.timezone).toBe("UTC");
    await gym.discardSession(s.id);
  });
});

// ── Corregir lo registrado ──────────────────────────────────────────────

describe.skipIf(!HAY_BASE_DE_PRUEBAS)("editar y borrar series", () => {
  it("editar una serie cambia sus valores sin crear otra", async () => {
    const s = await gym.startSession({ timeZone: "America/Tijuana" });
    const serie = await gym.logSet({
      sessionId: s.id, exerciseId: pressMilitarId, weightKg: 60, reps: 10, rir: 2,
    });

    await gym.updateSet(serie.id, { weightKg: 65, reps: 8, rir: 1 });

    const detalle = await queries.getOpenSession();
    expect(detalle!.sets).toHaveLength(1);
    expect(detalle!.sets[0].weightKg).toBe(65);
    expect(detalle!.sets[0].reps).toBe(8);
    expect(detalle!.sets[0].rir).toBe(1);
    await gym.closeSession(s.id);
  });

  it("borrar una serie del medio renumera las que quedan", async () => {
    // Sin renumerar quedaba «1, 3»: una serie que se llama 3 siendo la segunda
    // hace dudar de si se borró la que era o se perdió otra.
    const s = await gym.startSession({ timeZone: "America/Tijuana" });
    const a = await gym.logSet({ sessionId: s.id, exerciseId: pressMilitarId, reps: 10 });
    const b = await gym.logSet({ sessionId: s.id, exerciseId: pressMilitarId, reps: 9 });
    const c = await gym.logSet({ sessionId: s.id, exerciseId: pressMilitarId, reps: 8 });
    expect([a.setIndex, b.setIndex, c.setIndex]).toEqual([1, 2, 3]);

    await gym.deleteSet(b.id);

    const detalle = await queries.getOpenSession();
    expect(detalle!.sets.map((x) => x.setIndex).sort()).toEqual([1, 2]);
    expect(detalle!.sets.map((x) => x.reps).sort((p, q) => q! - p!)).toEqual([10, 8]);
    await gym.closeSession(s.id);
  });

  it("no se puede editar una serie de una sesión cerrada", async () => {
    const s = await gym.startSession({ timeZone: "America/Tijuana" });
    const serie = await gym.logSet({
      sessionId: s.id, exerciseId: pressMilitarId, weightKg: 60, reps: 10,
    });
    await gym.closeSession(s.id);

    await expect(gym.updateSet(serie.id, { weightKg: 99, reps: 1, rir: null }))
      .rejects.toThrow(/cerrada/);
  });
});
