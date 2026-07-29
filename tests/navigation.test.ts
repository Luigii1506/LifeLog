import { describe, expect, it } from "vitest";
import { parentOf, titleOf, ORDENES_NAVEGACION } from "@/lib/navigation";
import { matchOption } from "@/lib/match-option";

describe("parentOf — el padre lógico, no el historial", () => {
  it("el home no tiene padre", () => {
    expect(parentOf("/")).toBeNull();
  });

  it("las secciones vuelven al home", () => {
    expect(parentOf("/gym")).toBe("/");
    expect(parentOf("/food")).toBe("/");
  });

  it("comida es una sola ruta, como el gimnasio", () => {
    // Antes el flujo guiado vivía en `/food/guiado/<tipo>` y volvía a `/food`.
    // Al unificar comida con gimnasio esa ruta desapareció: `/food` es a la vez
    // la entrada y el flujo, y de ahí se sale a Hoy.
    expect(parentOf("/food")).toBe("/");
  });

  it("un registro rápido vuelve al home", () => {
    expect(parentOf("/registrar/mood")).toBe("/");
    expect(parentOf("/registrar/expense")).toBe("/");
  });

  it("una ruta desconocida cae al home en vez de dejarte encerrado", () => {
    expect(parentOf("/lo-que-sea")).toBe("/");
  });
});

describe("titleOf", () => {
  it("el home no lleva título: ya se ve dónde estás", () => {
    expect(titleOf("/")).toBeNull();
  });

  it("las secciones sí", () => {
    expect(titleOf("/gym")).toBe("Gimnasio");
    expect(titleOf("/food/guiado/cena")).toBe("Comida");
    expect(titleOf("/registrar/weight")).toBe("Registrar");
  });
});

describe("órdenes de navegación por voz", () => {
  const decir = (t: string) => matchOption(t, ORDENES_NAVEGACION)?.value;

  it("llevan al inicio", () => {
    expect(decir("inicio")).toBe("/");
    expect(decir("hoy")).toBe("/");
    expect(decir("llévame al menú principal")).toBe("/");
  });

  it("vuelven atrás", () => {
    expect(decir("atrás")).toBe("__atras");
    expect(decir("regresa")).toBe("__atras");
    expect(decir("cancelar")).toBe("__atras");
  });

  it("no confunden una orden con otra", () => {
    expect(decir("qué tal el clima")).toBeUndefined();
  });
});

// ── Profundidad del gimnasio ────────────────────────────────────────────

describe("atrás dentro del gimnasio", () => {
  const sp = (q: string) => new URLSearchParams(q);

  it("desde una serie vuelve a los ejercicios, no a Hoy", () => {
    // El caso que motivó esto: registrando series, «atrás» decía «Gimnasio» y
    // saltaba a Hoy. Lo obvio al acabar un ejercicio es volver a la lista del
    // mismo grupo, igual que el grupo se queda pegado al elegir.
    expect(parentOf("/gym", sp("ejercicio=01ABC"))).toBe("/gym");
  });

  it("desde la lista de un grupo vuelve al selector de grupo", () => {
    expect(parentOf("/gym", sp("grupo=pecho"))).toBe("/gym?grupo=");
  });

  it("desde el selector de grupo sale a Hoy", () => {
    // `?grupo=` vacío es distinto de ausente: es la forma de PEDIR el selector.
    expect(parentOf("/gym", sp("grupo="))).toBe("/");
  });

  it("sin parámetros sale a Hoy", () => {
    expect(parentOf("/gym", sp(""))).toBe("/");
    expect(parentOf("/gym")).toBe("/");
  });

  it("el ejercicio manda sobre el grupo", () => {
    // Estando en una serie, da igual qué grupo diga la URL: la pantalla de la
    // que vienes es la lista de ejercicios.
    expect(parentOf("/gym", sp("grupo=pecho&ejercicio=01ABC"))).toBe("/gym");
  });
});
