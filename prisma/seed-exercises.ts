// tsx no lee .env por su cuenta; Next sí. Sin esto la siembra no
// encuentra la base aunque esté configurada.
import "dotenv/config";
import { db } from "../src/lib/db";
import { newId } from "../src/lib/ids";

/**
 * Catálogo inicial de ejercicios, en español de México.
 *
 * Por qué esto y no una API: las que existen traen los nombres en inglés o en
 * mal español, dependen de red y de clave, y una persona usa unos cuarenta
 * ejercicios en su vida. Un catálogo local es instantáneo, funciona sin señal
 * y el ranking por uso lo vuelve tuyo en dos semanas.
 *
 * El orden dentro de cada grupo es el prior de arranque en frío: lo más común
 * primero. En cuanto haya historial, la frecuencia real manda.
 */
const CATALOGO: [grupo: string, equipo: string, nombres: string[]][] = [
  ["pecho", "barra", ["Press de banca", "Press inclinado con barra", "Press declinado"]],
  ["pecho", "mancuerna", ["Press inclinado con mancuernas", "Press plano con mancuernas", "Aperturas con mancuernas"]],
  ["pecho", "polea", ["Cruces en polea"]],
  ["pecho", "máquina", ["Pec deck", "Press en máquina"]],
  ["pecho", "peso corporal", ["Fondos en paralelas", "Lagartijas"]],

  ["espalda", "peso corporal", ["Dominadas"]],
  ["espalda", "polea", ["Jalón al pecho", "Jalón tras nuca", "Remo en polea baja", "Pullover en polea", "Face pull"]],
  ["espalda", "barra", ["Remo con barra", "Peso muerto"]],
  ["espalda", "mancuerna", ["Remo con mancuerna"]],
  ["espalda", "máquina", ["Remo en máquina"]],

  ["pierna", "barra", ["Sentadilla", "Sentadilla frontal", "Peso muerto rumano", "Hip thrust"]],
  ["pierna", "máquina", ["Prensa", "Extensión de cuádriceps", "Curl femoral", "Elevación de talones"]],
  ["pierna", "mancuerna", ["Zancadas", "Búlgaras", "Sentadilla goblet"]],

  ["hombro", "barra", ["Press militar", "Remo al mentón"]],
  ["hombro", "mancuerna", ["Press militar con mancuernas", "Press Arnold", "Elevaciones laterales", "Elevaciones frontales", "Pájaros", "Encogimientos"]],

  ["bíceps", "barra", ["Curl con barra", "Curl predicador"]],
  ["bíceps", "mancuerna", ["Curl con mancuernas", "Curl martillo", "Curl concentrado"]],
  ["bíceps", "polea", ["Curl en polea"]],

  ["tríceps", "polea", ["Extensión en polea", "Extensión con cuerda"]],
  ["tríceps", "barra", ["Press francés"]],
  ["tríceps", "mancuerna", ["Extensión tras nuca", "Patada de tríceps"]],
  ["tríceps", "peso corporal", ["Fondos en banca"]],

  ["core", "peso corporal", ["Plancha", "Abdominales", "Elevación de piernas", "Russian twist"]],
  ["core", "máquina", ["Rueda abdominal", "Crunch en polea"]],

  ["cardio", "máquina", ["Caminadora", "Bicicleta", "Elíptica", "Escaladora", "Remo cardio"]],
];

async function main() {
  let creados = 0;
  let existentes = 0;
  let orden = 0;

  for (const [muscleGroup, equipment, nombres] of CATALOGO) {
    for (const name of nombres) {
      orden += 1;
      const existe = await db.exercise.findUnique({ where: { name } });
      if (existe) {
        existentes += 1;
        continue;
      }
      await db.exercise.create({
        data: { id: newId(), name, muscleGroup, equipment, source: "seed" },
      });
      creados += 1;
    }
  }

  const porGrupo = await db.exercise.groupBy({
    by: ["muscleGroup"],
    _count: true,
  });
  console.log(`ejercicios: ${creados} creados, ${existentes} ya presentes`);
  for (const g of porGrupo.sort((a, b) => b._count - a._count)) {
    console.log(`  ${String(g.muscleGroup).padEnd(10)} ${g._count}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
