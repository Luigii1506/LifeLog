"use client";

import { useEffect, useRef, useState } from "react";
import { parseSpokenTime, type SpokenTime } from "@/lib/parse-spoken-time";

/**
 * Dictado de hora: mantener pulsado y decir «cinco y media».
 *
 * Usa la API de voz del navegador, que reconoce en el dispositivo o en el
 * servicio del sistema — no hay servidor propio de por medio y el audio no
 * pasa por LifeLog.
 *
 * Se esconde solo si el navegador no la soporta: un botón que no funciona es
 * peor que un botón que no está.
 *
 * Mantener pulsado en vez de alternar: sabes exactamente cuándo escucha, y
 * soltar cierra. Un micrófono que se queda abierto sin que lo notes no es
 * aceptable en una app que registra tu vida.
 */

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
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

export function VoiceTime({ onTime }: { onTime: (t: SpokenTime) => void }) {
  const [soportado, setSoportado] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [oido, setOido] = useState<string>("");
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

    rec.lang = "es-MX";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 3;

    rec.onresult = (evento) => {
      const ultimo = evento.results[evento.results.length - 1];
      const texto = ultimo[0].transcript;
      setOido(texto);

      if (!ultimo.isFinal) return;

      // Se prueban todas las alternativas: el reconocedor a veces pone
      // primero una transcripción que no es una hora, y la segunda sí lo es.
      for (let i = 0; i < ultimo.length; i++) {
        const hora = parseSpokenTime(ultimo[i].transcript);
        if (hora) {
          onTime(hora);
          setError(null);
          return;
        }
      }
      setError(`No entendí «${texto}»`);
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
    <div className="space-y-2">
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          empezar();
        }}
        onPointerUp={parar}
        onPointerLeave={() => escuchando && parar()}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="Mantener pulsado para decir la hora"
        className={`flex w-full touch-none items-center justify-center gap-3 rounded-xl border py-4 transition select-none ${
          escuchando
            ? "border-accent bg-accent text-white"
            : "border-line bg-surface text-muted active:scale-[0.98]"
        }`}
      >
        <span className={`text-xl ${escuchando ? "animate-pulse" : ""}`}>🎙️</span>
        <span className="font-medium">
          {escuchando ? "Escuchando…" : "Mantén pulsado y dilo"}
        </span>
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
