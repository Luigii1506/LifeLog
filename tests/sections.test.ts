import { describe, expect, it } from "vitest";
import { EN_BARRA, SECCIONES, neighbour, sectionIndex } from "@/lib/sections";
import { QUICK_FLOWS } from "@/lib/quick/catalog";

/**
 * Cadena de secciones para el gesto de deslizar.
 *
 * El orden visible es la REJILLA DE HOY: Agua, Gimnasio, Comida y después los
 * registros rápidos. Un gesto que salta a un sitio que no puedes prever no se
 * usa, así que la cadena y la rejilla salen de la misma lista.
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

  it("los registros rápidos también están en la cadena", () => {
    expect(sectionIndex("/registrar/wake")).toBe(4);
    // El último eslabón se toma de la propia lista: lo que tiene pantalla
    // propia —notas, suplementos— entra con su ruta, no con `/registrar/…`.
    expect(sectionIndex(SECCIONES.at(-1)!.href)).toBe(SECCIONES.length - 1);
  });

  it("un prefijo no cuenta como coincidencia", () => {
    // `/registrar/wake` es prefijo de nada, pero la comparación descuidada
    // haría casar `/registrar/weight` con él y deslizar saltaría mal.
    expect(SECCIONES[sectionIndex("/registrar/weight")].label).toBe("Peso");
    expect(SECCIONES[sectionIndex("/registrar/wake")].label).toBe("Desperté");
  });

  it("una ruta desconocida queda fuera", () => {
    expect(sectionIndex("/login")).toBe(-1);
    expect(neighbour("/login", 1)).toBeNull();
  });
});

describe("la cadena", () => {
  it("avanza en el orden de la rejilla de Hoy", () => {
    expect(neighbour("/", 1)).toBe("/agua");
    expect(neighbour("/agua", 1)).toBe("/gym");
    expect(neighbour("/gym", 1)).toBe("/food");
    // Y sigue hacia los registros rápidos, sin cortarse en las cuatro
    // principales: la rejilla no se corta ahí.
    expect(neighbour("/food", 1)).toBe("/registrar/wake");
    expect(neighbour("/registrar/wake", 1)).toBe("/registrar/sleep");
  });

  it("retrocede igual", () => {
    expect(neighbour("/registrar/wake", -1)).toBe("/food");
    expect(neighbour("/food", -1)).toBe("/gym");
    expect(neighbour("/gym", -1)).toBe("/agua");
    expect(neighbour("/agua", -1)).toBe("/");
  });

  it("no da la vuelta en los extremos", () => {
    // Con una lista circular nunca sabes si avanzas o has vuelto al principio,
    // y con trece paradas eso se nota enseguida.
    expect(neighbour("/", -1)).toBeNull();
    expect(neighbour(SECCIONES.at(-1)!.href, 1)).toBeNull();
  });

  it("el orden es el del día: agua primero", () => {
    // Se bebe agua todo el rato, se entrena una vez, se come varias.
    expect(SECCIONES.slice(0, 4).map((s) => s.href)).toEqual([
      "/", "/agua", "/gym", "/food",
    ]);
  });

  it("los registros rápidos van en el orden de la rejilla", () => {
    // Salen de `QUICK_FLOWS`, la misma lista que pinta las tarjetas. Si se
    // reordenan ahí, la cadena se reordena sola — con dos listas separadas,
    // deslizar acabaría llevando a un sitio distinto del que enseña Hoy.
    //
    // El `href` de la entrada manda sobre la ruta por defecto: lo que no cabe
    // en un flujo de preguntas —los suplementos son una rejilla con dosis
    // distintas— tiene pantalla propia sin salirse de la cadena.
    expect(SECCIONES.slice(4).map((s) => s.href)).toEqual(
      QUICK_FLOWS.map((f) => f.href ?? `/registrar/${f.id}`),
    );
  });

  it("lo que tiene pantalla propia entra con su ruta", () => {
    // Suplementos y notas no son flujos de preguntas: son rejilla y bandeja.
    // Siguen en la cadena, pero por su propia ruta.
    const rutas = SECCIONES.map((s) => s.href);
    expect(rutas).toContain("/suplementos");
    expect(rutas).toContain("/notas");
    expect(rutas).not.toContain("/registrar/medication");
    expect(rutas).not.toContain("/registrar/note");
  });

  it("la barra lleva solo las cuatro principales", () => {
    // Trece pestañas harían cada una intocable con el pulgar.
    expect(EN_BARRA.map((s) => s.label)).toEqual(["Hoy", "Agua", "Gimnasio", "Comida"]);
  });
});
