/**
 * Lo que tomas cada día.
 *
 * Vive aparte de `queries.ts` porque ese módulo toca la base, y un componente
 * de cliente que importara de ahí arrastraría Prisma al navegador.
 *
 * Cada suplemento declara CÓMO se registra, no solo cómo se llama. Es la
 * diferencia entre una lista y algo usable: una pastilla se toma o no se toma
 * —un toque basta— mientras que la proteína va en medios scoops y la creatina
 * en scoops enteros de 5 g. Un formulario único para los tres obligaría a
 * teclear en los tres.
 */

export type Dosing =
  /** Se toma o no se toma. Un toque y queda registrado. */
  | { kind: "single" }
  /** Cantidad en pasos, con su unidad. */
  | {
      kind: "steps";
      /** Cuánto sube o baja cada toque del + o del −. */
      step: number;
      /** Lo que tomas normalmente. Es lo que sale al abrir. */
      default: number;
      /** Tope de cordura: por encima, casi siempre es un toque de más. */
      max: number;
      unit: string;
      /** Singular y plural, para no escribir «1 scoops». */
      unitLabel: [uno: string, varios: string];
    };

export type Supplement = {
  id: string;
  /** Va tal cual al evento, así que no se cambia a la ligera. */
  name: string;
  icon: string;
  dosing: Dosing;
};

export const SUPLEMENTOS: Supplement[] = [
  {
    id: "proteina",
    name: "Proteína",
    icon: "🥤",
    // Medios scoops porque a veces son dos y medio. Redondear a enteros
    // falsearía el dato justo en el suplemento donde más se nota.
    dosing: {
      kind: "steps",
      step: 0.5,
      default: 1,
      max: 5,
      unit: "scoop",
      unitLabel: ["scoop", "scoops"],
    },
  },
  {
    id: "creatina",
    name: "Creatina",
    icon: "💪",
    // El scoop son 5 GRAMOS. En miligramos el dato quedaría mil veces por
    // debajo y nadie lo notaría hasta mirar una media.
    dosing: {
      kind: "steps",
      step: 5,
      default: 5,
      max: 20,
      unit: "g",
      unitLabel: ["g", "g"],
    },
  },
  {
    id: "psiquiatra",
    name: "Pastillas del psiquiatra",
    icon: "💊",
    dosing: { kind: "single" },
  },
  {
    id: "omega3",
    name: "Aceite de pescado",
    icon: "🐟",
    dosing: { kind: "single" },
  },
];

export function suplementoPorId(id: string): Supplement | undefined {
  return SUPLEMENTOS.find((s) => s.id === id);
}

/** «2 scoops», «5 g», «1 scoop». Sin decimales cuando no hacen falta. */
export function formatoDosis(dose: number, dosing: Dosing): string {
  if (dosing.kind !== "steps") return "";
  const n = Number.isInteger(dose) ? String(dose) : String(dose);
  const [uno, varios] = dosing.unitLabel;
  return `${n} ${dose === 1 ? uno : varios}`;
}
