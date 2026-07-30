"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { compressImage, CompressError } from "@/lib/assets/compress";
import { deleteExercisePhoto } from "@/app/gym/photo-actions";

/**
 * Botón de foto de una máquina.
 *
 * `capture="environment"` abre la cámara trasera directamente en el móvil, sin
 * pasar por el selector de archivos. Estás delante de la máquina: el camino
 * corto es apuntar y disparar.
 *
 * La foto se comprime AQUÍ, en el móvil, antes de enviarla: de 3-8 MB a unos
 * 40 KB. En el sótano de un gimnasio esa es la diferencia entre que funcione y
 * que no — y al redibujarla en un canvas se descartan los metadatos EXIF, que
 * es obligatorio antes de subir (ADR-114).
 */
export function ExercisePhotoButton({
  exerciseId,
  hasPhoto,
  compact,
}: {
  exerciseId: string;
  hasPhoto: boolean;
  /** En la lista de ejercicios el botón es un icono; en detalle, una fila. */
  compact?: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  async function subir(file: File) {
    setError(null);
    setSubiendo(true);
    try {
      const imagen = await compressImage(file);

      const cuerpo = new FormData();
      cuerpo.set("file", imagen.blob, "foto.webp");
      cuerpo.set("exerciseId", exerciseId);
      cuerpo.set("checksum", imagen.checksum);
      cuerpo.set("width", String(imagen.width));
      cuerpo.set("height", String(imagen.height));

      const respuesta = await fetch("/api/gym/photo", { method: "POST", body: cuerpo });
      const datos = (await respuesta.json().catch(() => null)) as
        | { ok: boolean; error?: string }
        | null;
      if (!respuesta.ok || !datos?.ok) {
        throw new Error(datos?.error ?? `Falló la subida (${respuesta.status})`);
      }

      router.refresh();
    } catch (e) {
      setError(
        e instanceof CompressError ? e.message : (e as Error).message || "No se pudo subir",
      );
    } finally {
      setSubiendo(false);
      if (input.current) input.current.value = "";
    }
  }

  const ocupado = pending || subiendo;

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void subir(file);
        }}
      />

      {compact ? (
        <button
          type="button"
          disabled={ocupado}
          onClick={(e) => {
            // La tarjeta entera es un botón que elige el ejercicio: sin esto,
            // tocar la cámara además abriría el ejercicio.
            e.preventDefault();
            e.stopPropagation();
            input.current?.click();
          }}
          aria-label={hasPhoto ? "Cambiar la foto" : "Añadir foto de la máquina"}
          className="flex size-8 items-center justify-center rounded-full bg-background/80 text-sm backdrop-blur transition active:scale-90 disabled:opacity-50"
        >
          {ocupado ? "…" : hasPhoto ? "🔄" : "📷"}
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              type="button"
              disabled={ocupado}
              onClick={() => input.current?.click()}
              className="flex-1 rounded-xl border border-line bg-surface py-3 font-medium transition active:scale-[0.98] disabled:opacity-50"
            >
              {ocupado ? "Subiendo…" : hasPhoto ? "Cambiar foto" : "📷 Foto de la máquina"}
            </button>
            {hasPhoto && (
              <button
                type="button"
                disabled={ocupado}
                onClick={() =>
                  startTransition(async () => {
                    const r = await deleteExercisePhoto(exerciseId);
                    if (!r.ok) setError(r.error);
                    else router.refresh();
                  })
                }
                aria-label="Quitar la foto"
                className="rounded-xl border border-line bg-surface px-4 text-muted transition active:scale-95 disabled:opacity-50"
              >
                ×
              </button>
            )}
          </div>
          {error && (
            <p role="status" className="text-center text-sm text-accent">
              {error}
            </p>
          )}
        </div>
      )}

      {compact && error && (
        <p role="status" className="col-span-full text-center text-xs text-accent">
          {error}
        </p>
      )}
    </>
  );
}
