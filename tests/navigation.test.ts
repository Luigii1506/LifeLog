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

  it("un flujo guiado de comida vuelve a comida, no al home", () => {
    expect(parentOf("/food/guiado/desayuno")).toBe("/food");
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
