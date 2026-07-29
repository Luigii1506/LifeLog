"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { openWorkout } from "@/app/gym/actions";
import { useVoiceTarget } from "@/components/voice/registry";
import { matchOption } from "@/lib/match-option";

export type GroupCard = {
  group: string;
  exerciseCount: number;
  timesTrained: number;
};

type Routine = {
  id: string;
  name: string;
  objective: string | null;
  exercises: string[];
  /** Grupo del primer ejercicio: adonde lleva la rutina al empezar. */
  firstGroup: string | null;
};

/**
 * Pantalla de entrada del gimnasio.
 *
 * Es directamente el selector de grupo muscular: elegir qué vas a trabajar
 * abre la sesión. No hay un «empezar entrenamiento» previo — era ceremonia y
 * un toque de más justo cuando tienes prisa.
 */
export function StartWorkout({
  groups,
  routines,
}: {
  groups: GroupCard[];
  routines: Routine[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function empezar(group: string | null, routineId?: string) {
    startTransition(async () => {
      // La zona la sabe el navegador. En el servidor es UTC, y una sesión
      // con la zona equivocada cae en el día que no es.
      const zona = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const r = await openWorkout(routineId ?? null, zona);
      if (!r.ok) return setError(r.error);
      router.push(`/gym?grupo=${encodeURIComponent(group ?? "")}`);
    });
  }

  // Decir «pecho» empieza el entrenamiento de pecho. Elegir qué trabajas ES
  // empezar; no hay un paso intermedio que confirmar.
  useVoiceTarget("Di el grupo · «pecho»", (texto) => {
    const elegido = matchOption(
      texto,
      groups.map((g) => ({ value: g.group, label: g.group })),
    );
    if (!elegido) return false;
    empezar(elegido.value);
    return true;
  });

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold tracking-tight">¿Qué vas a trabajar?</h2>

      <div className="grid grid-cols-2 gap-2">
        {groups.map((g) => (
          <button
            key={g.group}
            disabled={pending}
            onClick={() => empezar(g.group)}
            className="rounded-xl border border-line bg-surface p-5 text-left transition active:scale-[0.97] disabled:opacity-50"
          >
            <span className="block text-lg font-medium capitalize">{g.group}</span>
            <span className="mt-0.5 block text-xs text-muted">
              {g.exerciseCount} ejercicios
              {g.timesTrained > 0 && ` · ${g.timesTrained} series`}
            </span>
          </button>
        ))}
      </div>

      {routines.length > 0 && (
        <section className="space-y-2 pt-2">
          <h3 className="text-xs font-medium tracking-[0.12em] text-muted uppercase">
            O una rutina guardada
          </h3>
          {routines.map((rutina) => (
            <button
              key={rutina.id}
              disabled={pending}
              onClick={() => empezar(rutina.firstGroup, rutina.id)}
              className="w-full rounded-xl border border-line bg-surface p-4 text-left transition active:scale-[0.99] disabled:opacity-50"
            >
              <span className="font-medium">{rutina.name}</span>
              {rutina.exercises.length > 0 && (
                <span className="mt-1 block text-sm text-muted">
                  {rutina.exercises.slice(0, 4).join(" · ")}
                </span>
              )}
            </button>
          ))}
        </section>
      )}

      {error && (
        <p role="status" className="rounded-lg bg-accent px-4 py-3 text-center font-medium text-white">
          {error}
        </p>
      )}
    </div>
  );
}
