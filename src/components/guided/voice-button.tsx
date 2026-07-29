"use client";

import { useVoice } from "./use-voice";

/**
 * Botón de dictado ancho, para dentro de un flujo.
 *
 * Se oculta solo donde la API no existe: un botón que no funciona es peor que
 * un botón que no está.
 */
export function VoiceButton({
  lang = "es-MX",
  idleLabel,
  onTranscript,
}: {
  lang?: string;
  idleLabel: string;
  /** Devuelve false si el texto no se pudo interpretar. */
  onTranscript: (texto: string) => boolean | void;
}) {
  const { soportado, escuchando, oido, error, gestos } = useVoice({ lang, onTranscript });
  if (!soportado) return null;

  return (
    <div className="space-y-1">
      <button
        type="button"
        {...gestos}
        aria-label={idleLabel}
        className={`flex w-full touch-none items-center justify-center gap-3 rounded-xl border py-4 transition select-none ${
          escuchando
            ? "border-accent bg-accent text-white"
            : "border-line bg-surface text-muted active:scale-[0.98]"
        }`}
      >
        <span className={`text-xl ${escuchando ? "animate-pulse" : ""}`}>🎙️</span>
        <span className="font-medium">{escuchando ? "Escuchando…" : idleLabel}</span>
      </button>

      {(oido || error) && (
        <p
          role="status"
          aria-live="polite"
          className={`text-center text-sm ${error ? "text-accent" : "text-muted"}`}
        >
          {error ?? `«${oido}»`}
        </p>
      )}
    </div>
  );
}
