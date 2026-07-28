import type { TimelineEntry } from "@/lib/events/query";

const DOMAIN_COLOR: Record<string, string> = {
  health: "#5b8c5a",
  nutrition: "#c98a2b",
  training: "#b4551f",
  finance: "#7a6ba8",
  place: "#3f7d9e",
  work: "#4a5a7a",
  life: "#8a8378",
  ritual: "#9c6b8e",
};

export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted">
        Todavía no hay nada registrado hoy.
      </p>
    );
  }

  return (
    <ol className="relative space-y-0">
      {entries.map((entry, i) => (
        <li key={entry.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <span
              className="mt-2 size-2.5 shrink-0 rounded-full"
              style={{ background: DOMAIN_COLOR[entry.domain] ?? "#8a8378" }}
            />
            {i < entries.length - 1 && (
              <span className="w-px flex-1 bg-line" />
            )}
          </div>

          <div className="flex-1 pb-5">
            <div className="flex items-baseline gap-3">
              <time className="font-mono text-sm tabular-nums text-muted">
                {formatTime(entry.startedAt)}
              </time>
              <span className="font-medium">{entry.label}</span>
            </div>
            <p className="mt-0.5 text-sm text-muted">
              {summarize(entry)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Resumen de una línea por evento. El detalle vive en la base, no aquí. */
function summarize(entry: TimelineEntry): string {
  const p = entry.payload;
  const n = (k: string) => (typeof p[k] === "number" ? (p[k] as number) : null);
  const s = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : null);

  switch (entry.kind) {
    case "sleep.logged": {
      const parts = [`${n("hours") ?? "?"} h`];
      if (n("quality")) parts.push(`calidad ${n("quality")}/10`);
      return parts.join(" · ");
    }
    case "wake.up":
      return n("energy") ? `energía ${n("energy")}/10` : "—";
    case "weight.logged":
      return `${n("kg")} kg`;
    case "medication.taken":
      return s("name") ?? "—";
    case "mood.logged":
      return [`${n("score")}/10`, s("note")].filter(Boolean).join(" · ");
    case "workout.session":
      return [
        s("routine"),
        n("durationMin") ? `${n("durationMin")} min` : null,
        n("volumeKg") ? `${Math.round(n("volumeKg")!).toLocaleString("es-MX")} kg` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    case "meal.logged":
      return [
        s("mealType"),
        n("kcal") ? `${Math.round(n("kcal")!)} kcal` : null,
        n("proteinG") ? `${Math.round(n("proteinG")!)} g proteína` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    case "expense.logged":
      return [
        `$${n("amount")?.toLocaleString("es-MX")}`,
        s("merchant") ?? s("category"),
      ]
        .filter(Boolean)
        .join(" · ");
    case "focus.block":
      return [`${n("minutes")} min`, s("task")].filter(Boolean).join(" · ");
    case "place.visit":
      return entry.entityId ?? "—";
    case "activity.started":
    case "activity.ended":
      return s("activity") ?? "—";
    case "note.quick":
      return s("text") ?? "—";
    default:
      return "—";
  }
}
