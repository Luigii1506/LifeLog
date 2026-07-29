"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Botón de dictado. Mantener pulsado, hablar, soltar.
 *
 * Genérico: no sabe qué se dicta. Entrega el texto y quien lo use decide si
 * sirve. `onTranscript` devuelve false cuando no ha podido interpretarlo, y
 * entonces se muestra lo que se oyó para que se vea por qué falló.
 *
 * Mantener pulsado en vez de alternar: sabes exactamente cuándo escucha y
 * soltar cierra. Un micrófono que se queda abierto sin que lo notes no es
 * aceptable en una app que registra tu vida. El audio lo procesa el navegador
 * con el reconocedor del sistema; no pasa por LifeLog.
 *
 * Se oculta solo donde la API no existe: un botón que no funciona es peor que
 * un botón que no está.
 */

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: EventoVoz) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type EventoVoz = {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
};

function crearReconocimiento(): Recognition | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  const Constructor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Constructor ? new Constructor() : null;
}

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
  const [soportado, setSoportado] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [oido, setOido] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);

  useEffect(() => {
    setSoportado(crearReconocimiento() !== null);
    return () => recognition.current?.abort();
  }, []);

  function empezar() {
    setError(null);
    setOido("");

    const rec = crearReconocimiento();
    if (!rec) return;
    recognition.current = rec;

    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 3;

    rec.onresult = (evento) => {
      const ultimo = evento.results[evento.results.length - 1];
      setOido(ultimo[0].transcript);
      if (!ultimo.isFinal) return;

      // Se prueban todas las alternativas: el reconocedor a veces pone
      // primero una transcripción que no sirve y la segunda sí.
      for (let i = 0; i < ultimo.length; i++) {
        if (onTranscript(ultimo[i].transcript) !== false) return;
      }
      setError(`No entendí «${ultimo[0].transcript}»`);
    };

    rec.onerror = (e) => {
      setEscuchando(false);
      setError(
        e.error === "not-allowed"
          ? "Hace falta permiso del micrófono"
          : e.error === "no-speech"
            ? "No escuché nada"
            : "No se pudo escuchar",
      );
    };

    rec.onend = () => setEscuchando(false);

    try {
      rec.start();
      setEscuchando(true);
    } catch {
      setError("No se pudo escuchar");
    }
  }

  function parar() {
    recognition.current?.stop();
    setEscuchando(false);
  }

  if (!soportado) return null;

  return (
    <div className="space-y-1">
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          empezar();
        }}
        onPointerUp={parar}
        onPointerLeave={() => escuchando && parar()}
        onContextMenu={(e) => e.preventDefault()}
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
