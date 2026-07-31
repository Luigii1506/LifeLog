import { Timeline } from "@/components/timeline";
import { EndActivity } from "@/components/quick/end-activity";
import { TodayCard } from "@/components/quick/today-card";
import { openActivities, timelineForDay } from "@/lib/events/query";
import { QUICK_FLOWS } from "@/lib/quick/catalog";
import { todayStatus } from "@/lib/quick/status";
import { formatoAgua } from "@/lib/water/units";

export const dynamic = "force-dynamic";

/**
 * Hoy — el paso 0 del flujo guiado.
 *
 * La pregunta es «¿qué quieres registrar?» y cada tarjeta entra en su propio
 * flujo. Los dominios profundos van arriba y más grandes porque son los que
 * más se usan y los que más pasos ahorran.
 *
 * Cada tarjeta lleva su estado del día —pendiente, a medias, hecho— porque la
 * pregunta real de las siete de la tarde no es «¿qué registro?» sino «¿ya me
 * pesé?». Sin el estado hay que bajar a leer la línea de tiempo, y lo que
 * ocurre en la práctica es que registras dos veces o no registras.
 */
export default async function TodayPage() {
  const now = new Date();
  const [entries, abiertas, estado] = await Promise.all([
    timelineForDay(now),
    openActivities(now),
    todayStatus(now),
  ]);

  const hechos = QUICK_FLOWS.filter((f) => estado.flows[f.id]?.count > 0).length;

  return (
    <main className="py-6">
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

      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-xl font-semibold tracking-tight">
          ¿Qué quieres registrar?
        </h2>
        {hechos > 0 && (
          <span className="text-xs tabular-nums text-muted">
            {hechos} de {QUICK_FLOWS.length}
          </span>
        )}
      </div>


      <div className="grid grid-cols-3 gap-2">
        <TodayCard
          href="/agua"
          icon="💧"
          label="Agua"
          destacada
          status={{
            count: estado.water.totalMl > 0 ? 1 : 0,
            lastAt: null,
            progress: estado.water.totalMl / estado.water.goalMl,
            progressLabel: etiquetaAgua(estado.water),
          }}
        />
        <TodayCard
          href="/gym"
          icon="🏋️"
          label="Gimnasio"
          destacada
          status={{ count: estado.gym.count, lastAt: null, open: estado.gym.open }}
        />
        <TodayCard
          href="/food"
          icon="🍽️"
          label="Comida"
          destacada
          status={{ count: estado.food.count, lastAt: null, open: estado.food.open }}
        />
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        {QUICK_FLOWS.map((flujo) => (
          <TodayCard
            key={flujo.id}
            href={flujo.href ?? `/registrar/${flujo.id}`}
            icon={flujo.icon}
            label={flujo.label}
            flowId={flujo.id}
            totalSteps={flujo.steps}
            status={estado.flows[flujo.id] ?? { count: 0, lastAt: null }}
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

/** «1,5 de 2 L», «meta cumplida», «excelente». */
function etiquetaAgua({
  totalMl,
  goalMl,
  excellentMl,
}: {
  totalMl: number;
  goalMl: number;
  excellentMl: number;
}): string {
  if (totalMl >= excellentMl) return "excelente";
  if (totalMl >= goalMl) return "meta cumplida";
  return `${formatoAgua(totalMl)} de ${formatoAgua(goalMl)}`;
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
