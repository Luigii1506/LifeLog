/**
 * Compresión de fotos en el navegador, antes de subirlas.
 *
 * Tres cosas que resuelve, y las tres importan:
 *
 * **Tamaño.** Una foto de móvil pesa entre 3 y 8 MB. Para reconocer una máquina
 * del gimnasio en una tarjeta de 160 px basta con una imagen de 640 px y unos
 * 40 KB. Subir el original gastaría doscientas veces más de red, en el
 * gimnasio, con la señal que suele haber en un sótano.
 *
 * **EXIF.** Volver a dibujar la imagen en un canvas descarta TODOS los
 * metadatos: coordenadas GPS, modelo de teléfono, fecha exacta. Es obligatorio
 * (ADR-114) y aquí sale gratis, como efecto de comprimir. Si algún día se
 * subiera el original habría que quitarlos a mano.
 *
 * **Orientación.** `createImageBitmap` aplica la rotación que declara el EXIF.
 * Sin eso, las fotos verticales de iPhone se suben tumbadas — y como el EXIF se
 * descarta, quedarían tumbadas para siempre.
 */

/** Lado mayor de la imagen guardada. Suficiente para una tarjeta y para verla. */
const LADO_MAXIMO = 640;

/** Calidad WebP. Por debajo de 0,7 se notan bloques en superficies metálicas. */
const CALIDAD = 0.78;

export type CompressedImage = {
  blob: Blob;
  mimeType: string;
  bytes: number;
  width: number;
  height: number;
  /** SHA-256 en hexadecimal. Deduplicación e integridad. */
  checksum: string;
};

export class CompressError extends Error {}

export async function compressImage(file: File): Promise<CompressedImage> {
  if (!file.type.startsWith("image/")) {
    throw new CompressError("Eso no es una imagen");
  }

  // `imageOrientation: "from-image"` es lo que respeta la rotación del EXIF.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * escala);
  const height = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new CompressError("El navegador no pudo procesar la imagen");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", CALIDAD),
  );
  if (!blob) throw new CompressError("No se pudo comprimir la imagen");

  return {
    blob,
    mimeType: "image/webp",
    bytes: blob.size,
    width,
    height,
    checksum: await sha256(blob),
  };
}

async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
