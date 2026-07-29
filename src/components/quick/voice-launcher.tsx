"use client";

import { useRouter } from "next/navigation";
import { VoiceButton } from "@/components/guided/voice-button";
import { matchOption } from "@/lib/match-option";

/**
 * Dictado desde el home: «gimnasio», «gasto», «desperté» y entras directo.
 *
 * Es el atajo más corto que existe en la app: de abrir el teléfono a estar
 * dentro del flujo correcto sin mirar la pantalla.
 */
export function VoiceLauncher({
  destinations,
}: {
  destinations: { value: string; label: string }[];
}) {
  const router = useRouter();

  return (
    <VoiceButton
      idleLabel="Dilo y te llevo"
      onTranscript={(texto) => {
        const destino = matchOption(texto, destinations);
        if (!destino) return false;
        router.push(destino.value);
        return true;
      }}
    />
  );
}
