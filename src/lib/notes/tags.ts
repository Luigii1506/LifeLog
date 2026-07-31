/**
 * Etiquetas de las notas.
 *
 * Vive aparte de las consultas porque no toca la base: un componente de cliente
 * que importara de ahí arrastraría Prisma al navegador.
 *
 * Son POCAS y fijas a propósito. Una lista libre de etiquetas se convierte en
 * quince variantes de lo mismo —«idea», «ideas», «Idea»— y entonces filtrar
 * deja de servir, que es justo para lo que existen. Cuatro caben en una fila
 * del móvil y se eligen sin leer.
 */

export type Tag = {
  id: string;
  label: string;
  icon: string;
  /** Qué se captura aquí. Sale como pista al escribir. */
  hint: string;
};

export const ETIQUETAS: Tag[] = [
  {
    id: "idea",
    label: "Idea",
    icon: "💡",
    hint: "Algo que se te ocurrió y no quieres olvidar",
  },
  {
    id: "pendiente",
    label: "Pendiente",
    icon: "📌",
    hint: "Algo que tienes que hacer",
  },
  {
    id: "revisar",
    label: "Revisar",
    icon: "🔁",
    hint: "Algo que hay que procesar con calma",
  },
  { id: "nota", label: "Nota", icon: "📝", hint: "Lo que sea" },
];

/** La de por defecto: capturar no debe exigir clasificar. */
export const ETIQUETA_POR_DEFECTO = "nota";

export function etiquetaPorId(id: string | null | undefined): Tag | undefined {
  if (!id) return undefined;
  return ETIQUETAS.find((t) => t.id === id);
}
