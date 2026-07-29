import Link from "next/link";
import { Timeline } from "@/components/timeline";
import { EndActivity } from "@/components/quick/end-activity";
import { VoiceLauncher } from "@/components/quick/voice-launcher";
import { openActivities, timelineForDay } from "@/lib/events/query";
import { QUICK_FLOWS } from "@/lib/quick/flows";

export const dynamic = "force-dynamic";

/**
 * Hoy — el paso 0 del flujo guiado.
 *
 * La pregunta es «¿qué quieres registrar?» y cada tarjeta entra en su propio
 * flujo. Los dominios profundos van arriba y más grandes porque son los que
 * más se usan y los que más pasos ahorran.
 */
export default async function TodayPage() {
  const now = new Date();
  const [entries, abiertas] = await Promise.all([
    timelineForDay(now),
    openActivities(now),
  ]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-5 py-8 sm:py-12">
      <header className="mb-7">
        <p className="text-sm text-muted">{saludo(now)}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {formatearFecha(now)}
        </h1>
      </header>

      {abiertas.length > 0 && (
        <div className="mb-4 space-y-2">
          {abiertas.map((a) => (
            <EndActivity
              key={a.activity}
              activity={a.activity}
              startedAt={a.startedAt.toISOString()}
            />
          ))}
        </div>
      )}

      <h2 className="mb-3 text-xl font-semibold tracking-tight">
        ¿Qué quieres registrar?
      </h2>

      <div className="mb-3">
        <VoiceLauncher
          destinations={[
            { value: "/gym", label: "gimnasio pesas entrenar entrenamiento" },
            { value: "/food", label: "comida comer desayuno cena almuerzo" },
            ...QUICK_FLOWS.map((f) => ({
              value: `/registrar/${f.id}`,
              label: f.label,
            })),
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Tarjeta href="/gym" icon="🏋️" label="Gimnasio" destacada />
        <Tarjeta href="/food" icon="🍽️" label="Comida" destacada />
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        {QUICK_FLOWS.map((flujo) => (
          <Tarjeta
            key={flujo.id}
            href={`/registrar/${flujo.id}`}
            icon={flujo.icon}
            label={flujo.label}
          />
        ))}
      </div>

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

function Tarjeta({
  href,
  icon,
  label,
  destacada,
}: {
  href: string;
  icon: string;
  label: string;
  destacada?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-line bg-surface text-center transition active:scale-[0.96] ${
        destacada ? "py-7" : "py-5"
      }`}
    >
      <span className={destacada ? "text-3xl" : "text-2xl"}>{icon}</span>
      <span className={`font-medium ${destacada ? "" : "text-sm"}`}>{label}</span>
    </Link>
  );
}

function saludo(date: Date) {
  const h = date.getHours();
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

function formatearFecha(date: Date) {
  const texto = date.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
