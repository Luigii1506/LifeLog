/**
 * Cálculo de macros.
 *
 * `Food` guarda los macros por 100 de su unidad de referencia, salvo cuando
 * la unidad es `unit`, donde los guarda por pieza. Un huevo se mide en piezas;
 * el pollo, en gramos. Confundir las dos bases es el error clásico de estos
 * sistemas y por eso vive en una función con nombre y tests propios.
 */

export type MacroSource = {
  unit: string;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
};

export type Macros = {
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
};

const EMPTY: Macros = { kcal: null, proteinG: null, carbsG: null, fatG: null };

/** Factor por el que se multiplican los macros de referencia. */
export function scaleFactor(food: MacroSource, amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return food.unit === "unit" ? amount : amount / 100;
}

export function scaleMacros(food: MacroSource, amount: number | null): Macros {
  if (amount === null) return EMPTY;
  const factor = scaleFactor(food, amount);
  const escala = (valor: number | null) =>
    valor === null ? null : Math.round(valor * factor * 10) / 10;

  return {
    kcal: escala(food.kcal),
    proteinG: escala(food.proteinG),
    carbsG: escala(food.carbsG),
    fatG: escala(food.fatG),
  };
}

/**
 * Suma los macros de una lista. Un item sin macros no invalida el total:
 * cuenta como cero y el total sigue siendo útil aunque sea incompleto.
 * Preferir un total aproximado a ningún total es lo que hace que se registre.
 */
export function sumMacros(items: Macros[]): Macros {
  if (items.length === 0) return EMPTY;
  const suma = items.reduce<{
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  }>(
    (acc, m) => ({
      kcal: acc.kcal + (m.kcal ?? 0),
      proteinG: acc.proteinG + (m.proteinG ?? 0),
      carbsG: acc.carbsG + (m.carbsG ?? 0),
      fatG: acc.fatG + (m.fatG ?? 0),
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
  const redondear = (v: number) => Math.round(v * 10) / 10;
  return {
    kcal: redondear(suma.kcal),
    proteinG: redondear(suma.proteinG),
    carbsG: redondear(suma.carbsG),
    fatG: redondear(suma.fatG),
  };
}
