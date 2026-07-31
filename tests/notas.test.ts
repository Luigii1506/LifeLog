import { describe, expect, it } from "vitest";
import { agruparPorDia, contarPorEtiqueta, type Nota } from "@/lib/notes/queries";
import { ETIQUETAS, ETIQUETA_POR_DEFECTO, etiquetaPorId } from "@/lib/notes/tags";

/**
 * Notas: capturar y volver a encontrarlas.
 *
 * Apuntar rápido es la parte fácil. Lo que decide si un sistema de captura
 * sirve es poder encontrar lo apuntado, y de eso van el filtro y la agrupación.
 */

const nota = (id: string, tag: string, iso: string): Nota => ({
  id,
  text: `nota ${id}`,
  tag,
  at: new Date(iso),
  timezone: "America/Tijuana",
});

describe("etiquetas", () => {
  it("son pocas y fijas", () => {
    // Una lista libre acaba en quince variantes de lo mismo —«idea», «ideas»,
    // «Idea»— y entonces filtrar deja de servir, que es para lo que existen.
    expect(ETIQUETAS.length).toBeLessThanOrEqual(4);
    const ids = ETIQUETAS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("hay una por defecto y está en el catálogo", () => {
    // Capturar no puede depender de acertar la categoría.
    expect(etiquetaPorId(ETIQUETA_POR_DEFECTO)).toBeDefined();
  });

  it("una etiqueta inventada no resuelve", () => {
    expect(etiquetaPorId("inventada")).toBeUndefined();
    expect(etiquetaPorId(null)).toBeUndefined();
  });
});

describe("agrupar por día", () => {
  it("junta las del mismo día y ordena de la más reciente a la más vieja", () => {
    // Sin cabeceras, treinta notas seguidas son un muro.
    const grupos = agruparPorDia([
      nota("a", "idea", "2026-07-30T18:00:00Z"),
      nota("b", "idea", "2026-07-30T20:00:00Z"),
      nota("c", "nota", "2026-07-29T18:00:00Z"),
    ]);
    expect(grupos.map((g) => g.dateKey)).toEqual(["2026-07-30", "2026-07-29"]);
    expect(grupos[0].notas).toHaveLength(2);
  });

  it("agrupa por el día LOCAL de cada nota, no por el UTC", () => {
    // 06:00 UTC son las 23:00 del día anterior en Tijuana. Agrupar por UTC
    // metería una nota de anoche en el día de hoy.
    const grupos = agruparPorDia([nota("a", "idea", "2026-07-31T06:00:00Z")]);
    expect(grupos[0].dateKey).toBe("2026-07-30");
  });
});

describe("contar para los filtros", () => {
  it("cuenta por etiqueta", () => {
    const cuenta = contarPorEtiqueta([
      nota("a", "idea", "2026-07-30T18:00:00Z"),
      nota("b", "idea", "2026-07-30T19:00:00Z"),
      nota("c", "pendiente", "2026-07-30T20:00:00Z"),
    ]);
    expect(cuenta).toEqual({ idea: 2, pendiente: 1 });
  });

  it("una etiqueta sin notas no aparece", () => {
    // El filtro solo enseña lo que tiene algo: uno que devuelve cero es ruido.
    expect(contarPorEtiqueta([])).toEqual({});
  });
});
