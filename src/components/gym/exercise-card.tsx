"use client";

import { useState } from "react";
import { ExercisePhotoButton } from "./exercise-photo";

/**
 * Tarjeta de ejercicio con la foto de tu máquina.
 *
 * La foto ES la tarjeta, no una miniatura encima de un bloque de texto. El
 * nombre va sobre un degradado dentro de la imagen: así la tarjeta mide lo que
 * mide la foto, caben seis en pantalla, y la vista reconoce el aparato antes de
 * leer nada — que es como se elige ejercicio en el gimnasio de verdad.
 *
 * Cuadrada, no retrato. Un grupo como pecho tiene once ejercicios: en 3:4 eso
 * eran casi tres pantallas de scroll, y una lista que hay que recorrer pierde
 * la ventaja de reconocer por la vista. En cuadrado caben seis de golpe y una
 * máquina se identifica igual de bien.
 *
 * La tarjeta sin foto no se disimula: se ve que le falta y se ve cómo
 * arreglarlo. El catálogo se llena yendo al gimnasio, así que durante semanas
 * habrá mezcla — y una tarjeta vacía que parece rota hace dudar de si la app
 * falla.
 */

export type ExerciseTileData = {
  id: string;
  name: string;
  equipment: string | null;
  lastSets: string | null;
  timesLogged: number;
  photoUrl?: string | null;
};

export function ExerciseTile({
  exercise,
  disabled,
  onPick,
}: {
  exercise: ExerciseTileData;
  disabled?: boolean;
  onPick: () => void;
}) {
  const [cargada, setCargada] = useState(false);
  const tieneFoto = Boolean(exercise.photoUrl);

  return (
    <div className="group relative">
      <button
        disabled={disabled}
        onClick={onPick}
        className="relative block aspect-square w-full overflow-hidden rounded-2xl border border-line bg-surface text-left transition active:scale-[0.97] disabled:opacity-50"
      >
        {tieneFoto ? (
          <>
            {/* Aparece con una transición: sin ella la foto salta de golpe al
                terminar de cargar y la rejilla entera parece parpadear. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={exercise.photoUrl!}
              alt=""
              loading="lazy"
              onLoad={() => setCargada(true)}
              className={`absolute inset-0 size-full object-cover transition-opacity duration-300 ${
                cargada ? "opacity-100" : "opacity-0"
              }`}
            />
            {/* El degradado existe para que el texto se lea sobre cualquier
                foto. Sin él, un nombre blanco sobre una máquina clara
                desaparece. */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-[linear-gradient(135deg,var(--color-surface),var(--color-background))]">
            <span className="text-2xl opacity-30">📷</span>
            <span className="text-[10px] tracking-wide text-muted uppercase">
              sin foto
            </span>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-3">
          <span
            className={`text-sm leading-tight font-semibold ${
              tieneFoto ? "text-white drop-shadow-sm" : ""
            }`}
          >
            {exercise.name}
          </span>
          {exercise.lastSets ? (
            <span
              className={`font-mono text-[11px] tabular-nums ${
                tieneFoto ? "text-white/80" : "text-muted"
              }`}
            >
              {exercise.lastSets}
            </span>
          ) : (
            exercise.equipment && (
              <span
                className={`text-[11px] ${tieneFoto ? "text-white/70" : "text-muted"}`}
              >
                {exercise.equipment}
              </span>
            )
          )}
        </div>

        {/* Cuántas veces lo has hecho. Va arriba a la izquierda, lejos del
            botón de cámara, y solo si hay historial: un «0» no informa. */}
        {exercise.timesLogged > 0 && (
          <span
            className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums backdrop-blur ${
              tieneFoto ? "bg-black/40 text-white" : "bg-background/80 text-muted"
            }`}
          >
            {exercise.timesLogged}×
          </span>
        )}
      </button>

      <div className="absolute top-2 right-2">
        <ExercisePhotoButton
          exerciseId={exercise.id}
          hasPhoto={tieneFoto}
          compact
        />
      </div>
    </div>
  );
}
