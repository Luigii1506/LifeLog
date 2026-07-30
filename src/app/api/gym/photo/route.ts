import { revalidatePath } from "next/cache";
import { AssetError, BYTES_MAXIMOS, saveExercisePhoto } from "@/lib/assets/asset";

/**
 * Recibe la foto de una máquina y la guarda.
 *
 * Es una ruta y no una acción de servidor porque una acción serializa el cuerpo
 * y tiene un tope pequeño por defecto; una ruta recibe el binario tal cual.
 *
 * El navegador ya comprimió a ~40 KB, así que pasar por aquí no cuesta nada — y
 * ahorra configurar CORS en el bucket, que es lo que rompe con un error de red
 * que no menciona CORS.
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const archivo = form.get("file");
    const exerciseId = String(form.get("exerciseId") ?? "");
    const checksum = String(form.get("checksum") ?? "");

    if (!(archivo instanceof Blob)) {
      return Response.json({ ok: false, error: "Falta la imagen" }, { status: 400 });
    }
    if (!exerciseId) {
      return Response.json({ ok: false, error: "Falta el ejercicio" }, { status: 400 });
    }
    if (archivo.size > BYTES_MAXIMOS) {
      return Response.json(
        { ok: false, error: "La imagen es demasiado grande" },
        { status: 413 },
      );
    }

    const { assetId } = await saveExercisePhoto({
      exerciseId,
      bytes: new Uint8Array(await archivo.arrayBuffer()),
      mimeType: archivo.type || "image/webp",
      checksum,
      width: Number(form.get("width")) || undefined,
      height: Number(form.get("height")) || undefined,
      source: "app:gym",
    });

    revalidatePath("/gym");
    return Response.json({ ok: true, assetId });
  } catch (error) {
    if (error instanceof AssetError) {
      return Response.json({ ok: false, error: error.message }, { status: 400 });
    }
    console.error("subida de foto falló", error);
    return Response.json(
      { ok: false, error: "No se pudo guardar la foto" },
      { status: 500 },
    );
  }
}
