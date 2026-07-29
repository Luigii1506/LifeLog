import Link from "next/link";
import { QuickActions } from "@/components/quick-actions";
import { Timeline } from "@/components/timeline";
import { openActivities, timelineForDay } from "@/lib/events/query";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const now = new Date();
  const [entries, abiertas] = await Promise.all([
    timelineForDay(now),
    openActivities(now),
  ]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-5 py-8 sm:py-12">
      <header className="mb-8">
        <p className="text-sm text-muted">{greeting(now)}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {formatDate(now)}
        </h1>
      </header>

      <div className="mb-3 grid grid-cols-2 gap-2">
        {[
          { href: "/gym", label: "Gimnasio" },
          { href: "/food", label: "Alimentación" },
        ].map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-4 transition active:scale-[0.99]"
          >
            <span className="font-medium">{m.label}</span>
            <span className="text-muted">→</span>
          </Link>
        ))}
      </div>

      <QuickActions
        openActivities={abiertas.map((a) => ({
          activity: a.activity,
          startedAt: a.startedAt.toISOString(),
        }))}
      />

      <section className="mt-10">
        <h2 className="mb-5 text-xs font-medium tracking-[0.12em] text-muted uppercase">
          Hoy · {entries.length}{" "}
          {entries.length === 1 ? "registro" : "registros"}
        </h2>
        <Timeline entries={entries} />
      </section>
    </main>
  );
}

function greeting(date: Date) {
  const h = date.getHours();
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

function formatDate(date: Date) {
  const formatted = date.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}
