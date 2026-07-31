import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, HAY_BASE_DE_PRUEBAS } from "./setup-db";

/**
 * Corregir y retirar un registro del día.
 *
 * Para quien usa la app son una edición y un borrado. Por debajo no se toca
 * nada: la tabla es append-only y un trigger rechaza UPDATE y DELETE (I-02).
 * Corregir emite un evento que anula al anterior; retirar hace lo mismo pero
 * marcado, porque anular esconde al ANULADO, no al anulador.
 *
 * Sin esa marca, quitar un registro dejaba visible el evento que lo quitaba —y
 * la cadena de revocaciones no puede arreglarlo: siempre sobra el último.
 */

let cleanup: () => void;
let db: typeof import("@/lib/db").db;
let emit: typeof import("@/lib/events/emit");
let query: typeof import("@/lib/events/query");
let entry: typeof import("@/lib/quick/today-entry");
let status: typeof import("@/lib/quick/status");

const TJ = "America/Tijuana";

beforeAll(async () => {
  if (!HAY_BASE_DE_PRUEBAS) return;
  const test = createTestDatabase();
  cleanup = test.cleanup;
  process.env.DATABASE_URL = test.url;
  ({ db } = await import("@/lib/db"));
  emit = await import("@/lib/events/emit");
  query = await import("@/lib/events/query");
  entry = await import("@/lib/quick/today-entry");
  status = await import("@/lib/quick/status");
});

afterAll(async () => {
  if (!HAY_BASE_DE_PRUEBAS) return;
  await db.$disconnect();
  cleanup?.();
});

const pesar = (kg: number, source = "app:guiado") =>
  emit.emit({ kind: "weight.logged", payload: { kg }, timezone: TJ, source });

async function vigente() {
  return entry.todayEntry("weight", new Date(), TJ);
}
async function cuenta() {
  return (await status.todayStatus(new Date(), TJ)).flows.weight.count;
}
async function enLinea() {
  const t = await query.timelineForDay(new Date(), TJ);
  return t.filter((e) => e.kind === "weight.logged").length;
}

describe.skipIf(!HAY_BASE_DE_PRUEBAS)("corregir un registro", () => {
  it("reemplaza el valor sin apilar otro", async () => {
    const antes = await cuenta();
    await pesar(79);
    expect((await vigente())!.summary).toBe("79 kg");

    const actual = (await vigente())!;
    await emit.revoke(actual.eventId, {
      kind: "weight.logged",
      payload: { kg: 78.2 },
      timezone: TJ,
      source: "app:guiado:correccion",
    });

    expect((await vigente())!.summary).toBe("78.2 kg");
    // Uno, no dos: para el usuario ha sido una edición.
    expect(await cuenta()).toBe(antes + 1);
    expect(await enLinea()).toBe(antes + 1);
  });

  it("el original sigue en el log, invisible", async () => {
    // Es lo que permite recuperar un dato si la corrección se lo comió.
    const filas = await db.event.count({ where: { kind: "weight.logged" } });
    expect(filas).toBeGreaterThan(await cuenta());
  });
});

describe.skipIf(!HAY_BASE_DE_PRUEBAS)("retirar un registro", () => {
  it("desaparece de todas las vistas a la vez", async () => {
    // Tarjeta, pantalla del flujo y línea de tiempo tienen que coincidir: si
    // una dice que sigue ahí, el usuario deja de fiarse de las tres.
    const antes = await cuenta();
    await pesar(81);
    expect(await cuenta()).toBe(antes + 1);

    const actual = (await vigente())!;
    await emit.revoke(actual.eventId, {
      kind: "weight.logged",
      payload: { kg: 81 },
      timezone: TJ,
      source: `app:guiado${query.SUFIJO_RETIRADO}`,
    });

    expect(await vigente()).toBeNull();
    expect(await cuenta()).toBe(antes);
    expect(await enLinea()).toBe(antes);
  });

  it("sin la marca, el evento que retira queda visible", async () => {
    // El fallo que motivó la marca. Anular esconde al ANULADO; el anulador
    // ocupa su sitio. La cadena de revocaciones no lo arregla: si C anula a B
    // que anula a A, queda C.
    const antes = await cuenta();
    await pesar(90);
    const actual = (await vigente())!;
    await emit.revoke(actual.eventId, {
      kind: "weight.logged",
      payload: { kg: 90 },
      timezone: TJ,
      source: "app:guiado:sin-marca",
    });

    expect(await cuenta()).toBe(antes + 1);
    expect((await vigente())!.summary).toBe("90 kg");

    // Se limpia con la marca buena.
    const colgando = (await vigente())!;
    await emit.revoke(colgando.eventId, {
      kind: "weight.logged",
      payload: { kg: 90 },
      timezone: TJ,
      source: `app:guiado${query.SUFIJO_RETIRADO}`,
    });
    expect(await cuenta()).toBe(antes);
  });
});
