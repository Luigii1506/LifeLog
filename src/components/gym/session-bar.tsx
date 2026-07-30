"use client";

import { useEffect, useState } from "react";

/**
 * Barra de sesión en curso.
 *
 * Existe porque terminar el entrenamiento solo se podía desde dentro de un
 * ejercicio: si estabas eligiendo grupo, no había salida y tocaba entrar en un
 * ejercicio cualquiera para poder cerrar. Ahora la barra vive en todas las
 * pantallas del gimnasio mientras haya sesión abierta.
 *
 * Va abajo, pegada a la barra de navegación, y deja hueco a la derecha para el
 * botón de voz — que queda encima, como acoplado. Ese hueco no es decorativo:
 * sin él, el texto de la barra pasa por debajo del micrófono y no se lee.
 *
 * Muestra el tiempo en vivo. Es el dato que uno mira entre series y el único
 * que no se puede reconstruir después: las series quedan registradas, pero
 * «cuánto llevo» solo existe mientras entrenas.
 */

export function SessionBar({
  startedAt,
  initialMinutes,
  setCount,
  volumeKg,
  exercises,
  pending,
  onFinish,
}: {
  /** ISO. Se recalcula en el cliente para que el reloj corra. */
  startedAt: string;
  /** Minutos ya transcurridos, calculados en el servidor. Evita el parpadeo. */
  initialMinutes: number;
  setCount: number;
  volumeKg: number;
  /** Ejercicios trabajados, para el resumen antes de cerrar. */
  exercises: string[];
  pending: boolean;
  onFinish: () => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const minutos = useMinutosDesde(startedAt, initialMinutes);
  const olvidada = minutos >= MINUTOS_SOSPECHOSOS;

  return (
    <>
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 4.75rem)" }}
      >
        <button
          onClick={() => setAbierta(true)}
          disabled={pending}
          aria-label="Ver el entrenamiento y terminarlo"
          className="pointer-events-auto flex w-full items-center gap-3 rounded-full border border-line bg-surface/95 py-2.5 pr-20 pl-4 shadow-lg backdrop-blur transition active:scale-[0.98] disabled:opacity-50"
        >
          {/* El punto latiendo dice «esto sigue corriendo» sin gastar palabras.
              Es lo que distingue una sesión abierta de un resumen. */}
          <span className="relative flex size-2 shrink-0" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-accent" />
          </span>

          <span
            className={`font-mono text-sm tabular-nums ${
              olvidada ? "text-accent" : ""
            }`}
          >
            {formatoDuracion(minutos)}
          </span>

          <span className="truncate text-sm text-muted">
            {olvidada
              ? "¿se quedó abierta?"
              : `${setCount} ${setCount === 1 ? "serie" : "series"}${
                  volumeKg > 0
                    ? ` · ${Math.round(volumeKg).toLocaleString("es-MX")} kg`
                    : ""
                }`}
          </span>
        </button>
      </div>

      {abierta && (
        <HojaConfirmacion
          minutos={minutos}
          setCount={setCount}
          volumeKg={volumeKg}
          exercises={exercises}
          pending={pending}
          onCancel={() => setAbierta(false)}
          onFinish={onFinish}
        />
      )}
    </>
  );
}

/**
 * Confirmación con el resumen delante.
 *
 * No es un «¿seguro?» — eso obliga a decidir sin datos. Enseña lo que llevas
 * hecho, porque la razón real para dudar es «¿me falta algo?», y esa pregunta
 * se responde viendo los ejercicios, no leyendo una advertencia.
 *
 * Cerrar es irreversible: emite el evento resumen y la sesión pasa a inmutable.
 */
function HojaConfirmacion({
  minutos,
  setCount,
  volumeKg,
  exercises,
  pending,
  onCancel,
  onFinish,
}: {
  minutos: number;
  setCount: number;
  volumeKg: number;
  exercises: string[];
  pending: boolean;
  onCancel: () => void;
  onFinish: () => void;
}) {
  // Escape cierra. En un móvil no hay teclado, pero en el portátil sí y no
  // tenerlo se nota como brusquedad.
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button
        aria-label="Cerrar"
        onClick={onCancel}
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Terminar entrenamiento"
        className="animate-[subir_200ms_ease-out] relative w-full max-w-2xl rounded-t-3xl border-t border-line bg-surface p-5 pb-8 shadow-2xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" aria-hidden />

        <h2 className="text-xl font-semibold tracking-tight">Terminar entrenamiento</h2>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Dato valor={formatoDuracion(minutos)} etiqueta="tiempo" />
          <Dato valor={String(setCount)} etiqueta={setCount === 1 ? "serie" : "series"} />
          <Dato
            valor={Math.round(volumeKg).toLocaleString("es-MX")}
            etiqueta="kg de volumen"
          />
        </div>

        {exercises.length > 0 && (
          <p className="mt-4 text-sm leading-relaxed text-muted">
            {exercises.join(" · ")}
          </p>
        )}

        <button
          onClick={onFinish}
          disabled={pending}
          className="mt-5 w-full rounded-xl bg-accent py-4 text-lg font-medium text-white transition active:scale-[0.98] disabled:opacity-50"
        >
          {pending ? "Cerrando…" : "Terminar"}
        </button>
        <button
          onClick={onCancel}
          disabled={pending}
          className="mt-2 w-full py-3 text-sm text-muted disabled:opacity-50"
        >
          Seguir entrenando
        </button>
      </div>
    </div>
  );
}

function Dato({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <div className="rounded-xl border border-line bg-background px-2 py-3">
      <div className="font-mono text-lg tabular-nums">{valor}</div>
      <div className="mt-0.5 text-[11px] text-muted">{etiqueta}</div>
    </div>
  );
}

/** Minutos desde que empezó, refrescados cada quince segundos. */
function useMinutosDesde(startedAt: string, inicial: number): number {
  const calcular = () =>
    Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000));

  // Arranca con el valor que calculó el SERVIDOR, no con cero ni recalculando:
  // cero parpadearía a la vista en una sesión de hora y media, y recalcular
  // aquí daría un número distinto al del HTML y rompería la hidratación.
  const [minutos, setMinutos] = useState(inicial);

  useEffect(() => {
    setMinutos(calcular());
    // Cada quince segundos, no cada segundo: la barra muestra minutos, así que
    // despertar el hilo sesenta veces por minuto no cambiaría un solo píxel.
    const id = setInterval(() => setMinutos(calcular()), 15_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt]);

  return minutos;
}

/**
 * «45 min», «1h 20m», «2d 4h».
 *
 * No `1:20`: con una sesión larga eso se lee como una hora del reloj —«28:39»
 * no parece un tiempo transcurrido— y el dato deja de significar nada.
 */
function formatoDuracion(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h < 24) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

/**
 * A partir de aquí, la sesión se dio por olvidada.
 *
 * Nadie entrena tres horas seguidas. Pasado ese punto, lo más probable es que
 * saliera del gimnasio sin cerrarla — y una sesión abierta de ayer falsea la
 * duración del entrenamiento y bloquea empezar el de hoy.
 */
const MINUTOS_SOSPECHOSOS = 3 * 60;
