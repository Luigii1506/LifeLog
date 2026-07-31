"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logWater, undoWater } from "@/app/agua/actions";
import { useVoiceTarget } from "@/components/voice/registry";
import { matchOption } from "@/lib/match-option";
import { CustomAmount } from "./custom-amount";
import { WaterRing } from "./water-ring";

/**
 * Registro de agua.
 *
 * Es el registro más frecuente del sistema: ocho o diez veces al día frente a
 * una del peso. Eso manda sobre todo el diseño — un flujo de tres toques serían
 * treinta toques diarios.
 *
 * Por eso NO es un flujo guiado: es una sola pantalla donde tocas y te quedas.
 * Registrar no navega a ningún sitio; el anillo se actualiza y ya puedes tocar
 * otra vez. Es el mismo principio que el grupo muscular pegajoso del gimnasio,
 * llevado al extremo.
 */

export type Entry = {
  id: string;
  ml: number;
  at: string;
  vessel: string | null;
};

export function WaterTracker({
  totalMl,
  goalMl,
  excellentMl,
  presets,
  entries,
}: {
  totalMl: number;
  goalMl: number;
  excellentMl: number;
  presets: { ml: number; label: string; icon: string }[];
  entries: Entry[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [libre, setLibre] = useState(false);
  /** Lo último registrado, para acusar recibo del toque. */
  const [acuse, setAcuse] = useState<number | null>(null);
  /** Lo recién tocado, para que el anillo responda antes que la red. */
  const [optimista, setOptimista] = useState(0);

  /**
   * El optimismo se descuenta cuando LLEGAN los datos nuevos, no al recibir el
   * «ok» del servidor.
   *
   * Ponerlo a cero antes hacía que el aro retrocediera un instante: el servidor
   * confirmaba, se borraba el optimismo, y `totalMl` seguía siendo el viejo
   * hasta que `router.refresh()` traía el nuevo. Ese salto atrás y adelante era
   * la animación rara.
   */
  const anterior = useRef(totalMl);
  useEffect(() => {
    if (totalMl !== anterior.current) {
      anterior.current = totalMl;
      setOptimista(0);
    }
  }, [totalMl]);

  const total = Math.max(0, totalMl + optimista);

  function registrar(ml: number, vessel: string | null) {
    setError(null);
    setLibre(false);
    // El aro se mueve YA. Con diez registros al día, esperar a la red en cada
    // uno convierte la pantalla en algo que se siente lento.
    setOptimista((prev) => prev + ml);
    // El aro se mueve poco con un vaso sobre dos litros —un octavo de vuelta—
    // así que sin esto el toque parece no haber hecho nada.
    setAcuse(ml);
    window.setTimeout(() => setAcuse(null), 1400);
    startTransition(async () => {
      const zona = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const r = await logWater(ml, vessel, zona);
      if (!r.ok) {
        setOptimista((prev) => prev - ml);
        setError(r.error);
      } else {
        router.refresh();
      }
    });
  }

  function deshacer(id: string, ml: number) {
    setError(null);
    setOptimista((prev) => prev - ml);
    startTransition(async () => {
      const r = await undoWater(id);
      if (!r.ok) {
        setOptimista((prev) => prev + ml);
        setError(r.error);
      } else {
        router.refresh();
      }
    });
  }

  // «un vaso», «medio litro», «botella». Con las manos mojadas en la cocina,
  // hablar gana a apuntar.
  useVoiceTarget("Di cuánto · «un vaso»", (texto) => {
    const elegido = matchOption(texto, [
      ...presets.map((p) => ({
        value: String(p.ml),
        label: `${p.label} ${p.ml >= 1000 ? `${p.ml / 1000} litro litros` : `${p.ml} mililitros`}`,
      })),
      { value: "500", label: "medio litro media botella" },
      { value: "1000", label: "un litro litro entero" },
      { value: "250", label: "vaso vasito trago" },
    ]);
    if (!elegido) return false;
    const ml = Number(elegido.value);
    registrar(
      ml,
      presets.find((p) => p.ml === ml)?.label.toLowerCase() ?? null,
    );
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="relative">
        <WaterRing total={total} goalMl={goalMl} excellentMl={excellentMl} />
        {acuse !== null && (
          <span
            role="status"
            className="animate-[acuse_1400ms_ease-out] pointer-events-none absolute inset-x-0 top-6 text-center font-mono text-lg font-medium text-done"
          >
            +{acuse >= 1000 ? `${acuse / 1000} L` : `${acuse} ml`}
          </span>
        )}
      </div>

      {libre ? (
        <CustomAmount
          busy={pending}
          onCancel={() => setLibre(false)}
          onConfirm={(ml) => registrar(ml, null)}
        />
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {/* La pregunta explícita separa el marcador de las respuestas. Sin
              ella, el aro parecía la primera opción de una lista. Es el mismo
              patrón que usa todo el resto de la app: una pregunta, y debajo
              lo que se puede tocar. */}
          <h2 className="col-span-2 text-center text-lg font-medium">
            ¿Cuánto tomaste?
          </h2>
          {presets.map((p) => (
            <button
              key={p.ml}
              disabled={pending}
              onClick={() => registrar(p.ml, p.label.toLowerCase())}
              className="flex flex-col items-center gap-1 rounded-2xl border border-line bg-surface py-5 transition active:scale-[0.96] disabled:opacity-50"
            >
              <span className="text-3xl">{p.icon}</span>
              <span className="text-sm font-medium">{p.label}</span>
              <span className="font-mono text-[11px] tabular-nums text-muted">
                {p.ml >= 1000 ? `${p.ml / 1000} L` : `${p.ml} ml`}
              </span>
            </button>
          ))}

          <button
            disabled={pending}
            onClick={() => setLibre(true)}
            className="col-span-2 rounded-2xl border border-dashed border-line py-3.5 text-sm text-muted transition active:scale-[0.98] disabled:opacity-50"
          >
            Otra cantidad
          </button>
        </div>
      )}

      {error && (
        <p
          role="status"
          className="rounded-lg bg-accent px-4 py-3 text-center font-medium text-white"
        >
          {error}
        </p>
      )}

      {entries.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-medium tracking-[0.12em] text-muted uppercase">
            Hoy · {entries.length}
          </h2>
          <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {entries
              .slice()
              .reverse()
              .map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="font-mono text-sm tabular-nums text-muted">
                    {new Date(e.at).toLocaleTimeString("es-MX", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </span>
                  <span className="flex-1 text-sm">
                    {e.vessel
                      ? e.vessel.charAt(0).toUpperCase() + e.vessel.slice(1)
                      : "Agua"}
                  </span>
                  <span className="font-mono text-sm tabular-nums">
                    {e.ml >= 1000 ? `${e.ml / 1000} L` : `${e.ml} ml`}
                  </span>
                  {/* Deshacer, no borrar: el registro se anula con otro evento
                      (I-02). Con diez toques al día, el toque de más es
                      cuestión de tiempo. */}
                  <button
                    onClick={() => deshacer(e.id, e.ml)}
                    disabled={pending}
                    aria-label={`Deshacer ${e.ml} ml`}
                    className="text-muted transition hover:text-accent disabled:opacity-50"
                  >
                    ×
                  </button>
                </li>
              ))}
          </ol>
        </section>
      )}
    </div>
  );
}
