import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Almacenamiento de binarios en Cloudflare R2.
 *
 * La base guarda la REFERENCIA, nunca el binario (DATA_OWNERSHIP §9.1). Meter
 * imágenes en Postgres infla cada copia de seguridad y ralentiza consultas que
 * no piden la foto.
 *
 * **El bucket es privado y lo sirve la app.** Nada se lee directo de R2. Dos
 * razones, y la primera pesa más de lo que parece:
 *
 *   Una foto del gimnasio es dato personal, y la clasificación de privacidad
 *   del vault marca esta zona como privada. Un bucket público la deja
 *   accesible a cualquiera con la URL, para siempre, aunque la app pida
 *   contraseña. La sirve `/api/assets/<id>`, que está detrás de la puerta de
 *   entrada (ADR-113).
 *
 *   Y elimina la configuración que más falla: sin lectura pública no hace falta
 *   dominio ni Worker, y sin subida directa desde el navegador no hace falta
 *   CORS — que rompe con un error de red que no menciona CORS.
 *
 * El coste de pasar por el servidor es real pero pequeño AQUÍ: el navegador
 * comprime a unos 40 KB antes de enviar. Con la foto original de 3-8 MB este
 * diseño sería equivocado y habría que volver a URLs firmadas.
 *
 * El bucket es exclusivo de LifeLog, así que los keys no llevan prefijo de
 * proyecto: `exercises/<ulid>.webp`, no `lifelog/exercises/…` dentro de un
 * bucket que ya se llama lifelog.
 */

class AssetConfigError extends Error {}

function requerido(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new AssetConfigError(
      `Falta ${nombre}. Las fotos necesitan la configuración de R2 en .env.`,
    );
  }
  return valor;
}

let cliente: S3Client | null = null;

function s3(): S3Client {
  if (cliente) return cliente;
  cliente = new S3Client({
    // R2 no tiene regiones: "auto" es lo que espera su endpoint.
    region: "auto",
    endpoint: `https://${requerido("CLOUDFLARE_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requerido("R2_ACCESS_KEY_ID"),
      secretAccessKey: requerido("R2_SECRET_ACCESS_KEY"),
    },
  });
  return cliente;
}

/** Ruta dentro del bucket. El ULID la hace única. */
export function storageKeyFor(carpeta: string, id: string, extension: string): string {
  return `${carpeta}/${id}.${extension}`;
}

export async function putObject(
  storageKey: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: requerido("R2_BUCKET_NAME"),
      Key: storageKey,
      Body: bytes,
      ContentType: contentType,
    }),
  );
}

export async function getObject(
  storageKey: string,
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  try {
    const r = await s3().send(
      new GetObjectCommand({
        Bucket: requerido("R2_BUCKET_NAME"),
        Key: storageKey,
      }),
    );
    if (!r.Body) return null;
    return {
      bytes: await r.Body.transformToByteArray(),
      contentType: r.ContentType ?? "application/octet-stream",
    };
  } catch (error) {
    // Un objeto que falta no es un error del servidor: la fila existe y el
    // binario no, lo que pasa si una subida se cortó a mitad.
    if ((error as { name?: string }).name === "NoSuchKey") return null;
    throw error;
  }
}

/**
 * Borra el objeto. Sin esto, cada foto reemplazada dejaría un binario que
 * nadie va a encontrar nunca y el bucket crecería sin motivo.
 */
export async function deleteObject(storageKey: string): Promise<void> {
  await s3().send(
    new DeleteObjectCommand({
      Bucket: requerido("R2_BUCKET_NAME"),
      Key: storageKey,
    }),
  );
}

/** ¿Está configurado R2? La interfaz esconde las fotos si no lo está. */
export function assetsEnabled(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME,
  );
}
