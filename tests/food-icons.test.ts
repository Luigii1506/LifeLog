import { describe, expect, it } from "vitest";
import { iconFor } from "@/lib/food/suggestions";

describe("iconFor — los bugs de subcadena", () => {
  it("«queso panela» es queso, no sándwich: /pan/ casaba dentro de «panela»", () => {
    expect(iconFor("Queso panela")).toBe("🧀");
  });

  it("«fresas» es fruta, no carne: /res/ casaba dentro de «fresas»", () => {
    expect(iconFor("Fresas")).toBe("🍎");
  });

  it("acierta lo evidente", () => {
    expect(iconFor("Huevo entero")).toBe("🍳");
    expect(iconFor("Clara de huevo")).toBe("🍳");
    expect(iconFor("Pechuga de pollo")).toBe("🍗");
    expect(iconFor("Tortilla de maíz")).toBe("🫓");
    expect(iconFor("Pan integral")).toBe("🥪");
    expect(iconFor("Carne de res magra")).toBe("🥩");
    expect(iconFor("Atún en agua")).toBe("🐟");
  });

  it("funciona con y sin acento", () => {
    expect(iconFor("Café negro")).toBe("☕");
    expect(iconFor("Cafe americano")).toBe("☕");
    expect(iconFor("Proteína en polvo")).toBe("🥤");
    expect(iconFor("Proteina isolate")).toBe("🥤");
  });

  it("sin coincidencia devuelve null en vez de un icono equivocado", () => {
    expect(iconFor("Suplemento X-42")).toBeNull();
  });
});
