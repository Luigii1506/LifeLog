import { readAsset } from "@/lib/assets/asset";

/**
 * Sirve una foto desde R2, detrás de la puerta de entrada.
 *
 * El bucket es privado: nada se lee directo de R2. Una foto del gimnasio es
 * dato personal, y un bucket público la deja accesible a cualquiera con la URL
 * aunque la app pida contraseña. `proxy.ts` protege `/api/*`, así que esta ruta
 * ya exige sesión sin hacer nada más.
 *
 * `immutable` en la caché es seguro porque la URL lleva el ULID del activo: al
 * cambiar la foto cambia la URL. Así el navegador la pide una vez y nunca más,
 * y la rejilla de ejercicios no cuesta una petición por tarjeta en cada visita.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const asset = await readAsset(id);
  if (!asset) return new Response("No encontrado", { status: 404 });

  return new Response(asset.bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": asset.contentType,
      "Content-Length": String(asset.bytes.byteLength),
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
