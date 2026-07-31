import { describe, expect, it } from "vitest";
import { CATEGORIAS, categoriaPorId, formatoDinero } from "@/lib/expenses/categories";
import { porCategoria, type Gasto } from "@/lib/expenses/queries";

/**
 * Gastos.
 *
 * Eran tres pantallas —importe, categoría, lugar— para algo que se hace varias
 * veces al día, y la tercera estaba vacía hasta tener historial. Ahora es una
 * sola con teclado propio.
 */

const gasto = (id: string, amount: number, category: string): Gasto => ({
  id,
  amount,
  category,
  merchant: null,
  at: new Date("2026-07-31T18:00:00Z"),
});

describe("categorías", () => {
  it("son ocho: dos filas de cuatro sin encoger nada", () => {
    expect(CATEGORIAS).toHaveLength(8);
  });

  it("los ids son únicos", () => {
    // Se guardan en el evento y se suman por ellos: dos iguales mezclarían
    // gastos de cosas distintas.
    const ids = CATEGORIAS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("una categoría inventada no resuelve", () => {
    expect(categoriaPorId("criptomonedas")).toBeUndefined();
    expect(categoriaPorId(null)).toBeUndefined();
  });
});

describe("cómo se lee el dinero", () => {
  it("sin decimales cuando son cero, que es casi siempre", () => {
    expect(formatoDinero(250)).toBe("$250");
    expect(formatoDinero(1250)).toBe("$1,250");
  });

  it("con DOS decimales cuando los hay", () => {
    // «$62.5» no es un importe: en dinero los centavos van completos.
    expect(formatoDinero(62.5)).toBe("$62.50");
    expect(formatoDinero(12.34)).toBe("$12.34");
  });
});

describe("suma por categoría", () => {
  it("agrupa y ordena por lo más gastado", () => {
    const r = porCategoria([
      gasto("a", 100, "comida"),
      gasto("b", 50, "super"),
      gasto("c", 200, "comida"),
    ]);
    expect(r[0]).toEqual({ categoria: "comida", total: 300 });
    expect(r[1]).toEqual({ categoria: "super", total: 50 });
  });

  it("una categoría sin gastos no aparece", () => {
    // Enseñar ocho filas con siete en cero es ruido.
    expect(porCategoria([gasto("a", 100, "comida")])).toHaveLength(1);
  });

  it("sin gastos, nada", () => {
    expect(porCategoria([])).toEqual([]);
  });
});

describe("compatibilidad con los gastos ya guardados", () => {
  it("«súper» con acento sigue resolviendo", () => {
    // El flujo anterior guardaba la etiqueta en minúsculas, con acento. Sin
    // tolerarlo, esos gastos quedarían sin categoría por un cambio nuestro.
    expect(categoriaPorId("súper")?.id).toBe("super");
    expect(categoriaPorId("Súper")?.id).toBe("super");
  });

  it("las que no cambiaron siguen igual", () => {
    expect(categoriaPorId("comida")?.id).toBe("comida");
    expect(categoriaPorId("transporte")?.id).toBe("transporte");
  });
});
