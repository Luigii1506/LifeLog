"use client";

import { useVoice } from "./use-voice";

/**
 * Micrófono compacto para la barra inferior.
 *
 * Misma mecánica que el botón ancho, otro tamaño: aquí compite por espacio con
 * las pestañas y tiene que seguir siendo un objetivo cómodo para el pulgar.
 */
export function VoiceMic({
  onTranscript,
}: {
  onTranscript: (texto: string) => boolean | void;
}) {
  const { soportado, escuchando, oido, error, gestos } = useVoice({ onTranscript });
  if (!soportado) return null;

  return (
    <div className="relative flex flex-col items-center">
      {(escuchando || oido || error) && (
        <p
          role="status"
          aria-live="polite"
          className={`absolute bottom-full mb-2 w-56 rounded-lg px-3 py-2 text-center text-sm shadow-lg ${
            error ? "bg-accent text-white" : "bg-foreground text-background"
          }`}
        >
          {error ?? (oido ? `«${oido}»` : "Escuchando…")}
        </p>
      )}

      <button
        type="button"
        {...gestos}
        aria-label="Mantener pulsado para hablar"
        className={`flex size-12 touch-none items-center justify-center rounded-full text-xl transition select-none ${
          escuchando ? "scale-110 bg-accent" : "bg-accent/15 active:scale-95"
        }`}
      >
        <span className={escuchando ? "animate-pulse" : ""}>🎙️</span>
      </button>
    </div>
  );
}
