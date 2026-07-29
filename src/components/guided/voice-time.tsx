"use client";

import { VoiceButton } from "./voice-button";
import { parseSpokenTime, type SpokenTime } from "@/lib/parse-spoken-time";

/** Dictado de hora sobre el botón genérico: «cinco y media» → 05:30. */
export function VoiceTime({ onTime }: { onTime: (t: SpokenTime) => void }) {
  return (
    <VoiceButton
      lang="es-MX"
      idleLabel="Mantén pulsado y dilo"
      onTranscript={(texto) => {
        const hora = parseSpokenTime(texto);
        if (!hora) return false;
        onTime(hora);
        return true;
      }}
    />
  );
}
