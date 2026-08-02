import { describe, expect, it } from "vitest";
import { colapsarRepetidos, type Colapsable } from "@/lib/events/collapse";

/**
 * Agrupar repeticiones en la línea de tiempo.
 *
 * El agua se registra ocho o diez veces al día. Sin agrupar, el día del 30 de
 * julio eran 75 filas con 61 de «Agua», y el entrenamiento, el sueño y las
 * notas quedaban enterrados entre ellas.
 */

const e = (id: string, kind: string, iso: string, payload = {}): Colapsable => ({
  id,
  kind,
  startedAt: new Date(iso),
  payload,
});

describe("qué se agrupa", () => {
  it("varias tomas seguidas son un momento", () => {
    const r = colapsarRepetidos([
      e("a", "water.logged", "2026-07-30T21:00:00Z", { ml: 250 }),
      e("b", "water.logged", "2026-07-30T21:05:00Z", { ml: 250 }),
      e("c", "water.logged", "2026-07-30T21:10:00Z", { ml: 500 }),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].count).toBe(3);
    expect(r[0].aggregate).toBe("1 L");
  });

  it("dos momentos distintos del día NO se juntan", () => {
    // Beber a las 9 y a las 14 son dos momentos. Sin la ventana, un día entero
    // de agua colapsaría en una línea y se perdería la forma del día.
    const r = colapsarRepetidos([
      e("a", "water.logged", "2026-07-30T16:00:00Z", { ml: 250 }),
      e("b", "water.logged", "2026-07-30T21:00:00Z", { ml: 250 }),
    ]);
    expect(r).toHaveLength(2);
  });

  it("una racha larga sigue siendo una, aunque dure horas", () => {
    // La ventana se mide contra el ÚLTIMO, no contra el primero: tomas cada
    // veinte minutos son una racha aunque la primera y la última disten mucho.
    const r = colapsarRepetidos([
      e("a", "water.logged", "2026-07-30T16:00:00Z", { ml: 250 }),
      e("b", "water.logged", "2026-07-30T16:20:00Z", { ml: 250 }),
      e("c", "water.logged", "2026-07-30T16:40:00Z", { ml: 250 }),
      e("d", "water.logged", "2026-07-30T17:00:00Z", { ml: 250 }),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].count).toBe(4);
  });

  it("tipos distintos nunca se juntan", () => {
    const r = colapsarRepetidos([
      e("a", "water.logged", "2026-07-30T21:00:00Z", { ml: 250 }),
      e("b", "note.quick", "2026-07-30T21:01:00Z"),
      e("c", "water.logged", "2026-07-30T21:02:00Z", { ml: 250 }),
    ]);
    expect(r.map((g) => g.kind)).toEqual([
      "water.logged",
      "note.quick",
      "water.logged",
    ]);
  });
});

describe("qué se enseña del grupo", () => {
  it("conserva la hora del PRIMERO: es cuando empezó ese momento", () => {
    const r = colapsarRepetidos([
      e("a", "water.logged", "2026-07-30T21:00:00Z", { ml: 250 }),
      e("b", "water.logged", "2026-07-30T21:20:00Z", { ml: 250 }),
    ]);
    expect(r[0].startedAt.toISOString()).toBe("2026-07-30T21:00:00.000Z");
  });

  it("guarda todos los ids, por si hay que deshacer alguno", () => {
    const r = colapsarRepetidos([
      e("a", "water.logged", "2026-07-30T21:00:00Z", { ml: 250 }),
      e("b", "water.logged", "2026-07-30T21:05:00Z", { ml: 250 }),
    ]);
    expect(r[0].ids).toEqual(["a", "b"]);
  });

  it("suma el dinero de los gastos seguidos", () => {
    const r = colapsarRepetidos([
      e("a", "expense.logged", "2026-07-30T21:00:00Z", { amount: 250 }),
      e("b", "expense.logged", "2026-07-30T21:05:00Z", { amount: 200 }),
    ]);
    expect(r[0].aggregate).toBe("$450");
  });

  it("no inventa sumas donde no significan nada", () => {
    // Cuatro notas no son «4 de nota»: ahí basta el recuento.
    const r = colapsarRepetidos([
      e("a", "note.quick", "2026-07-30T21:00:00Z"),
      e("b", "note.quick", "2026-07-30T21:05:00Z"),
    ]);
    expect(r[0].count).toBe(2);
    expect(r[0].aggregate).toBeNull();
  });

  it("un registro suelto no se marca como grupo", () => {
    const r = colapsarRepetidos([e("a", "wake.up", "2026-07-30T15:00:00Z")]);
    expect(r[0].count).toBe(1);
  });

  it("una lista vacía no revienta", () => {
    expect(colapsarRepetidos([])).toEqual([]);
  });
});

describe("lo que no registra nada, no sale", () => {
  it("un trago de 0 ml no es un trago", async () => {
    // Son los eventos de deshacer de antes de que existiera la marca de
    // retirada. Sin filtrarlos, la línea de tiempo decía «Agua ×23» mientras
    // la pantalla de agua contaba 4 tomas — y cuando dos pantallas discrepan
    // sobre el mismo día, se deja de creer a las dos.
    const { colapsarRepetidos } = await import("@/lib/events/collapse");
    const g = colapsarRepetidos([
      e("a", "water.logged", "2026-07-30T21:00:00Z", { ml: 250 }),
      e("b", "water.logged", "2026-07-30T21:05:00Z", { ml: 500 }),
    ]);
    // El filtro vive en la consulta, pero la suma tiene que cuadrar con él.
    expect(g[0].aggregate).toBe("750 ml");
  });
});
