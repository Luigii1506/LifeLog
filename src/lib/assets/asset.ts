import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { deleteObject, getObject, putObject, storageKeyFor } from "./storage";

/**
 * Ciclo de vida de una foto.
 *
 * Un solo paso: llega el binario, se sube a R2, se crea la fila y se enlaza.
 * Si R2 falla no queda fila, y si la fila falla se retira el binario — no hay
 * estado intermedio que limpiar después.
 *
 * (Antes eran dos pasos, con una fila `pending` y una URL firmada para que el
 * navegador subiera directo. Sobraba: la foto llega comprimida a ~40 KB, así
 * que pasar por el servidor no cuesta nada y ahorra configurar CORS y una vía
 * de lectura pública.)
 */

/** Formatos que aceptamos. WebP es el que produce el navegador al comprimir. */
const EXTENSIONES: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

/** Tope de seguridad. Comprimida son ~40 KB; 2 MB ya indica que algo va mal. */
export const BYTES_MAXIMOS = 2 * 1024 * 1024;

export class AssetError extends Error {}

/**
 * Guarda la foto de una máquina y la deja como la única del ejercicio.
 *
 * Un ejercicio tiene UNA foto: es para reconocer la máquina de un vistazo, no
 * un álbum. Con dos activas la tarjeta mostraría una al azar.
 */
export async function saveExercisePhoto(input: {
  exerciseId: string;
  bytes: Uint8Array;
  mimeType: string;
  checksum: string;
  width?: number;
  height?: number;
  source: string;
}): Promise<{ assetId: string }> {
  const extension = EXTENSIONES[input.mimeType];
  if (!extension) throw new AssetError(`Formato no admitido: ${input.mimeType}`);
  if (input.bytes.byteLength === 0) throw new AssetError("La imagen llegó vacía");
  if (input.bytes.byteLength > BYTES_MAXIMOS) {
    throw new AssetError("La imagen es demasiado grande");
  }

  const ejercicio = await db.exercise.findUnique({
    where: { id: input.exerciseId },
    select: { id: true },
  });
  if (!ejercicio) throw new AssetError("No existe ese ejercicio");

  const assetId = newId();
  const storageKey = storageKeyFor("exercises", assetId, extension);

  await putObject(storageKey, input.bytes, input.mimeType);

  try {
    // Las anteriores se leen ANTES de crear la nueva, para no barrerla de paso.
    const anteriores = await db.assetLink.findMany({
      where: { exerciseId: input.exerciseId, predicate: "photo_of" },
      include: { asset: true },
    });

    await db.asset.create({
      data: {
        id: assetId,
        mimeType: input.mimeType,
        storageKey,
        checksum: input.checksum,
        bytes: input.bytes.byteLength,
        width: input.width ?? null,
        height: input.height ?? null,
        // El navegador redibuja la foto en un canvas antes de enviarla, y eso
        // descarta los metadatos EXIF de paso. Es obligatorio (ADR-114): una
        // foto del gimnasio lleva las coordenadas GPS del gimnasio.
        exifStripped: true,
        status: "active",
        source: input.source,
      },
    });
    await db.assetLink.create({
      data: { id: newId(), assetId, exerciseId: input.exerciseId, predicate: "photo_of" },
    });

    for (const link of anteriores) {
      await db.assetLink.delete({ where: { id: link.id } });
      await db.asset.delete({ where: { id: link.assetId } });
      await deleteObject(link.asset.storageKey).catch(() => {
        // Si R2 falla al borrar, la fila ya no existe y el binario queda
        // huérfano. Es preferible a dejar la app en estado inconsistente.
      });
    }

    return { assetId };
  } catch (error) {
    // La fila no se creó: el binario sobra. Sin esto, cada fallo dejaría una
    // foto en el bucket que nada referencia.
    await deleteObject(storageKey).catch(() => {});
    throw error;
  }
}

export async function removeExercisePhoto(exerciseId: string): Promise<void> {
  const links = await db.assetLink.findMany({
    where: { exerciseId, predicate: "photo_of" },
    include: { asset: true },
  });
  for (const link of links) {
    await db.assetLink.delete({ where: { id: link.id } });
    await db.asset.delete({ where: { id: link.assetId } });
    await deleteObject(link.asset.storageKey).catch(() => {});
  }
}

/** El binario de un activo, para servirlo desde la app. */
export async function readAsset(
  assetId: string,
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const asset = await db.asset.findUnique({
    where: { id: assetId },
    select: { storageKey: true, mimeType: true, status: true },
  });
  if (!asset || asset.status !== "active") return null;

  const objeto = await getObject(asset.storageKey);
  if (!objeto) return null;
  return { bytes: objeto.bytes, contentType: asset.mimeType };
}

/**
 * URL de la foto de un ejercicio. La sirve la app, no R2.
 *
 * Lleva el id del activo y no el del ejercicio a propósito: al cambiar la foto
 * cambia la URL, así que la caché del navegador no muestra la vieja.
 */
export function assetUrl(assetId: string): string {
  return `/api/assets/${assetId}`;
}

/** Foto de cada ejercicio, lista para pintar. Clave: id del ejercicio. */
export async function exercisePhotos(
  exerciseIds: string[],
): Promise<Record<string, string>> {
  if (exerciseIds.length === 0) return {};

  const links = await db.assetLink.findMany({
    where: {
      exerciseId: { in: exerciseIds },
      predicate: "photo_of",
      asset: { status: "active" },
    },
    select: { exerciseId: true, assetId: true },
    orderBy: { createdAt: "desc" },
  });

  const porEjercicio: Record<string, string> = {};
  for (const link of links) {
    if (!link.exerciseId || porEjercicio[link.exerciseId]) continue;
    porEjercicio[link.exerciseId] = assetUrl(link.assetId);
  }
  return porEjercicio;
}
