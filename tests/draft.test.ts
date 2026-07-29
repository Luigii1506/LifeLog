import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Borradores de flujo: salir a medias y volver donde estabas.
 *
 * Se prueba con un localStorage de mentira porque el módulo no debe saber
 * nada del navegador más allá de esa interfaz — y porque el caso que importa,
 * el borrador que caduca al cambiar de día, es imposible de provocar a mano.
 */

class FakeStorage implements Storage {
  private datos = new Map<string, string>();
  get length() {
    return this.datos.size;
  }
  clear() {
    this.datos.clear();
  }
  getItem(k: string) {
    return this.datos.get(k) ?? null;
  }
  key(i: number) {
    return [...this.datos.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.datos.delete(k);
  }
  setItem(k: string, v: string) {
    this.datos.set(k, v);
  }
}

const almacen = new FakeStorage();
vi.stubGlobal("window", { localStorage: almacen });

const { allDrafts, clearDraft, hoyLocal, readDraft, writeDraft } = await import(
  "@/lib/quick/draft"
);

beforeEach(() => almacen.clear());

describe("borrador de flujo", () => {
  it("devuelve el paso y las respuestas donde se dejó", () => {
    writeDraft("expense", 1, { amount: 250 });

    const draft = readDraft("expense");
    expect(draft?.step).toBe(1);
    expect(draft?.answers).toEqual({ amount: 250 });
  });

  it("no guarda nada por el mero hecho de abrir el flujo", () => {
    // Paso 0 sin respuestas no es progreso. Guardarlo pondría la tarjeta «en
    // curso» solo por haberla tocado, y entonces el estado no significaría nada.
    writeDraft("weight", 0, {});
    expect(readDraft("weight")).toBeNull();
  });

  it("un borrador de otro día no se retoma", () => {
    // Retomar el jueves el «¿cómo dormiste?» del martes no tiene sentido, y
    // ofrecerlo hace dudar de todo lo demás que muestre la app.
    almacen.setItem(
      "lifelog:draft:sleep",
      JSON.stringify({ step: 1, answers: { hours: 7 }, date: "2020-01-01" }),
    );

    expect(readDraft("sleep")).toBeNull();
    // Y se limpia solo, para no acumular basura de meses.
    expect(almacen.getItem("lifelog:draft:sleep")).toBeNull();
  });

  it("el de hoy sí se retoma", () => {
    almacen.setItem(
      "lifelog:draft:sleep",
      JSON.stringify({ step: 1, answers: { hours: 7 }, date: hoyLocal() }),
    );
    expect(readDraft("sleep")?.step).toBe(1);
  });

  it("terminar el flujo borra el borrador", () => {
    writeDraft("mood", 1, { score: 8 });
    clearDraft("mood");
    expect(readDraft("mood")).toBeNull();
  });

  it("basura en localStorage no rompe nada", () => {
    // Puede quedar de una versión anterior del formato. Sin borrador, el flujo
    // empieza de cero: perder el progreso es aceptable, no poder registrar no.
    almacen.setItem("lifelog:draft:note", "{ esto no es json");
    expect(readDraft("note")).toBeNull();
  });

  it("allDrafts solo devuelve los vivos y solo los del flujo", () => {
    writeDraft("expense", 2, { amount: 100 });
    writeDraft("focus", 1, { minutes: 45 });
    almacen.setItem("otra-cosa", "no es un borrador");
    almacen.setItem(
      "lifelog:draft:mood",
      JSON.stringify({ step: 1, answers: {}, date: "2020-01-01" }),
    );

    const vivos = allDrafts();
    expect(Object.keys(vivos).sort()).toEqual(["expense", "focus"]);
    expect(vivos.expense.step).toBe(2);
  });
});
