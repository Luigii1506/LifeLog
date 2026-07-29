"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Reconocimiento de voz del navegador.
 *
 * El audio lo procesa el sistema; no pasa por LifeLog. Se prueban todas las
 * alternativas que devuelve el reconocedor porque a veces la primera
 * transcripción no sirve y la segunda sí.
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

function crear(): Recognition | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  const C = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return C ? new C() : null;
}

export function useVoice({
  lang = "es-MX",
  onTranscript,
}: {
  lang?: string;
  /** Devuelve false si el texto no se pudo interpretar. */
  onTranscript: (texto: string) => boolean | void;
}) {
  const [soportado, setSoportado] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [oido, setOido] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);
  // El callback cambia en cada render; la referencia evita reconstruir el
  // reconocedor y perder el permiso del micrófono a media frase.
  const callback = useRef(onTranscript);
  callback.current = onTranscript;

  useEffect(() => {
    setSoportado(crear() !== null);
    return () => recognition.current?.abort();
  }, []);

  function empezar() {
    setError(null);
    setOido("");

    const rec = crear();
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

      for (let i = 0; i < ultimo.length; i++) {
        if (callback.current(ultimo[i].transcript) !== false) return;
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

  /**
   * Props para mantener pulsado. Se prefiere a alternar porque sabes
   * exactamente cuándo escucha y soltar cierra: un micrófono abierto sin que
   * lo notes no es aceptable en una app que registra tu vida.
   */
  const gestos = {
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      empezar();
    },
    onPointerUp: parar,
    onPointerLeave: () => escuchando && parar(),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };

  return { soportado, escuchando, oido, error, gestos };
}
