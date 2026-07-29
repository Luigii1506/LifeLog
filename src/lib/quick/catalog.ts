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

export const QUICK_FLOWS: { id: QuickFlowId; label: string; icon: string }[] = [
  { id: "wake", label: "Desperté", icon: "🌅" },
  { id: "sleep", label: "Sueño", icon: "😴" },
  { id: "mood", label: "Ánimo", icon: "😊" },
  { id: "weight", label: "Peso", icon: "⚖️" },
  { id: "medication", label: "Medicamento", icon: "💊" },
  { id: "expense", label: "Gasto", icon: "💸" },
  { id: "focus", label: "Trabajo", icon: "🎯" },
  { id: "activity", label: "Actividad", icon: "⏱" },
  { id: "note", label: "Nota", icon: "📝" },
];
