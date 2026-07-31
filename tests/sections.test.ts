import { describe, expect, it } from "vitest";
import { SECCIONES, neighbour, sectionIndex } from "@/lib/sections";

/**
 * Cadena de secciones para el gesto de deslizar.
 *
 * Una sola lista sirve a la barra inferior y al gesto. Si cada una tuviera la
 * suya, deslizar te llevaría a un sitio distinto del que marca la pestaña, y un
 * gesto que no es predecible no se usa.
 */

describe("dónde estoy", () => {
  it("reconoce cada sección", () => {
    expect(sectionIndex("/")).toBe(0);
    expect(sectionIndex("/agua")).toBe(1);
    expect(sectionIndex("/gym")).toBe(2);
    expect(sectionIndex("/food")).toBe(3);
  });

  it("una subruta sigue siendo su sección", () => {
    // El gimnasio guarda su profundidad en los parámetros, pero comida y agua
    // podrían crecer en rutas hijas y no deben salirse de la cadena.
    expect(sectionIndex("/gym/algo")).toBe(2);
    expect(sectionIndex("/agua/historial")).toBe(1);
  });

  it("una pantalla que no es sección queda fuera de la cadena", () => {
    // Registrar el peso no está en la barra: deslizar ahí no debe saltar a
    // ningún sitio, porque no hay pestaña que diga dónde estás.
    expect(sectionIndex("/registrar/weight")).toBe(-1);
    expect(neighbour("/registrar/weight", 1)).toBeNull();
  });
});

describe("la cadena", () => {
  it("avanza en el orden de la barra", () => {
    expect(neighbour("/", 1)).toBe("/agua");
    expect(neighbour("/agua", 1)).toBe("/gym");
    expect(neighbour("/gym", 1)).toBe("/food");
  });

  it("retrocede igual", () => {
    expect(neighbour("/food", -1)).toBe("/gym");
    expect(neighbour("/gym", -1)).toBe("/agua");
    expect(neighbour("/agua", -1)).toBe("/");
  });

  it("no da la vuelta en los extremos", () => {
    // Con una lista circular nunca sabes si avanzas o has vuelto al principio,
    // y el gesto pierde el sentido de posición que le da la barra.
    expect(neighbour("/", -1)).toBeNull();
    expect(neighbour("/food", 1)).toBeNull();
  });

  it("el orden es el del día: agua primero", () => {
    // Se bebe agua todo el rato, se entrena una vez, se come varias.
    expect(SECCIONES.map((s) => s.href)).toEqual(["/", "/agua", "/gym", "/food"]);
  });
});
