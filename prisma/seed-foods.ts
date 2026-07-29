import { db } from "../src/lib/db";
import { newId } from "../src/lib/ids";

/**
 * Catálogo inicial de alimentos.
 *
 * Existe por el arranque en frío: el flujo guiado ordena las tarjetas por
 * frecuencia, y el día uno no hay frecuencia. Sin catálogo, la primera
 * pantalla estaría vacía y habría que escribirlo todo — justo la fricción
 * que el flujo intenta quitar.
 *
 * A medida que se registran comidas, el ranking por uso desplaza a estos.
 * No son una preferencia: son un punto de partida.
 *
 * Macros por 100 g/ml, salvo los de unidad `unit`, que son por pieza.
 */
const CATALOGO = [
  // Proteína
  ["Pechuga de pollo", "g", 165, 31, 0, 3.6],
  ["Huevo entero", "unit", 72, 6.3, 0.4, 4.8],
  ["Clara de huevo", "unit", 17, 3.6, 0.2, 0.1],
  ["Atún en agua", "g", 116, 26, 0, 1],
  ["Carne de res magra", "g", 187, 26, 0, 9],
  ["Pescado blanco", "g", 96, 21, 0, 1.2],
  ["Jamón de pavo", "g", 104, 17, 2.5, 3],
  ["Queso panela", "g", 215, 18, 3, 14],
  ["Yogur griego natural", "g", 59, 10, 3.6, 0.4],
  ["Proteína en polvo", "g", 380, 80, 7, 4],

  // Carbohidratos
  ["Tortilla de maíz", "unit", 52, 1.4, 10.7, 0.7],
  ["Arroz cocido", "g", 130, 2.7, 28, 0.3],
  ["Frijoles", "g", 127, 8.7, 22.8, 0.5],
  ["Avena", "g", 389, 16.9, 66, 6.9],
  ["Papa cocida", "g", 87, 2, 20, 0.1],
  ["Pan integral", "unit", 82, 4, 14, 1.1],
  ["Pasta cocida", "g", 158, 5.8, 31, 0.9],

  // Grasas
  ["Aguacate", "g", 160, 2, 8.5, 14.7],
  ["Aceite de oliva", "ml", 884, 0, 0, 100],
  ["Crema de cacahuate", "g", 588, 25, 20, 50],
  ["Almendras", "g", 579, 21, 22, 50],

  // Verdura y fruta
  ["Verduras mixtas", "g", 45, 2.5, 8, 0.3],
  ["Lechuga", "g", 15, 1.4, 2.9, 0.2],
  ["Jitomate", "g", 18, 0.9, 3.9, 0.2],
  ["Plátano", "unit", 105, 1.3, 27, 0.4],
  ["Manzana", "unit", 95, 0.5, 25, 0.3],
  ["Fresas", "g", 32, 0.7, 7.7, 0.3],

  // Bebidas
  ["Leche entera", "ml", 61, 3.2, 4.8, 3.3],
  ["Café negro", "ml", 2, 0.1, 0, 0],
] as const;

async function main() {
  let creados = 0;
  let existentes = 0;

  for (const [name, unit, kcal, proteinG, carbsG, fatG] of CATALOGO) {
    const existe = await db.food.findUnique({ where: { name } });
    if (existe) {
      existentes += 1;
      continue;
    }
    await db.food.create({
      data: { id: newId(), name, unit, kcal, proteinG, carbsG, fatG, source: "seed" },
    });
    creados += 1;
  }

  console.log(`alimentos: ${creados} creados, ${existentes} ya presentes`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
