/**
 * Catálogo de flujos rápidos.
 *
 * Vive aparte de `flows.ts` porque ese módulo toca la base de datos, y
 * cualquier componente de cliente que importara la lista arrastraría SQLite al
 * bundle del navegador. Aquí no hay más que datos.
 */

export type QuickFlowId =
  | "wake" | "sleep" | "weight" | "medication" | "mood"
  | "expense" | "focus" | "activity" | "note";

/**
 * `steps` duplica lo que define `flows.ts`. Se acepta la duplicación porque la
 * alternativa es peor: la pantalla de Hoy tendría que construir los nueve
 * flujos —y varios consultan la base— solo para poder decir «paso 2 de 3».
 *
 * Una prueba comprueba que ambos números coincidan, así que si se añade un
 * paso y se olvida esta tabla, falla el test en vez de mentir la interfaz.
 */
export const QUICK_FLOWS: {
  id: QuickFlowId;
  label: string;
  icon: string;
  steps: number;
}[] = [
  { id: "wake", label: "Desperté", icon: "🌅", steps: 1 },
  { id: "sleep", label: "Sueño", icon: "😴", steps: 1 },
  { id: "mood", label: "Ánimo", icon: "😊", steps: 2 },
  { id: "weight", label: "Peso", icon: "⚖️", steps: 1 },
  { id: "medication", label: "Medicamento", icon: "💊", steps: 1 },
  { id: "expense", label: "Gasto", icon: "💸", steps: 3 },
  { id: "focus", label: "Trabajo", icon: "🎯", steps: 2 },
  { id: "activity", label: "Actividad", icon: "⏱", steps: 1 },
  { id: "note", label: "Nota", icon: "📝", steps: 1 },
];
