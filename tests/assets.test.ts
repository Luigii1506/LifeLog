import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase, HAY_BASE_DE_PRUEBAS } from "./setup-db";

/**
 * Fotos de las máquinas del gimnasio.
 *
 * Habla con R2 DE VERDAD, no con un simulacro. Un simulacro prueba que el código
 * llama a las funciones que el simulacro espera, que es justo lo que no falla;
 * lo que falla es la credencial, el nombre del bucket, la región o el
 * `Content-Type`. Los objetos que crea se borran por la vía normal.
 *
 * Sin configuración de R2 la suite se salta con aviso, en vez de fallar y que
 * alguien acabe desactivándola.
 */

let cleanup: () => void;
let db: typeof import("@/lib/db").db;
let assets: typeof import("@/lib/assets/asset");
let storage: typeof import("@/lib/assets/storage");
let ejercicioId: string;

const HAY_R2 = Boolean(
  process.env.CLOUDFLARE_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME,
);
const CORRER = HAY_BASE_DE_PRUEBAS && HAY_R2;

if (HAY_BASE_DE_PRUEBAS && !HAY_R2) {
  console.warn("[pruebas] sin configuración de R2: se saltan las pruebas de fotos");
}

/** Un PNG de 1×1 real. Permite comprobar integridad byte a byte. */
const PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DAwAAABQABh6FO1AAAAABJRU5ErkJggg==",
    "base64",
  ),
);

beforeAll(async () => {
  if (!CORRER) return;
  const test = createTestDatabase();
  cleanup = test.cleanup;
  process.env.DATABASE_URL = test.url;
  ({ db } = await import("@/lib/db"));
  assets = await import("@/lib/assets/asset");
  storage = await import("@/lib/assets/storage");
});

afterAll(async () => {
  if (!CORRER) return;
  await db.$disconnect();
  cleanup?.();
});

beforeEach(async () => {
  if (!CORRER) return;
  // Se borran por la vía normal para que se lleven también su binario de R2.
  const links = await db.assetLink.findMany({ where: { exerciseId: { not: null } } });
  for (const link of links) {
    if (link.exerciseId) await assets.removeExercisePhoto(link.exerciseId);
  }
  await db.assetLink.deleteMany();
  await db.asset.deleteMany();
  await db.exerciseSet.deleteMany();
  await db.exercise.deleteMany();

  const { newId } = await import("@/lib/ids");
  ejercicioId = newId();
  await db.exercise.create({
    data: { id: ejercicioId, name: "Prensa de piernas", muscleGroup: "pierna" },
  });
});

async function guardar(bytes: Uint8Array = PNG, mimeType = "image/png") {
  return assets.saveExercisePhoto({
    exerciseId: ejercicioId,
    bytes,
    mimeType,
    checksum: "abc123",
    width: 640,
    height: 480,
    source: "test",
  });
}

describe.skipIf(!CORRER)("fotos de ejercicio", () => {
  it("sube el binario a R2 y lo devuelve íntegro", async () => {
    const { assetId } = await guardar();

    const leido = await assets.readAsset(assetId);
    expect(leido).not.toBeNull();
    expect(leido!.contentType).toBe("image/png");
    // Byte a byte: es lo único que demuestra que no se corrompió al viajar.
    expect(Array.from(leido!.bytes)).toEqual(Array.from(PNG));
  });

  it("la URL la sirve la app, no R2", async () => {
    // El bucket es privado a propósito: una foto del gimnasio es dato personal,
    // y un bucket público la deja accesible a cualquiera que tenga la URL.
    const { assetId } = await guardar();
    const urls = await assets.exercisePhotos([ejercicioId]);
    expect(urls[ejercicioId]).toBe(`/api/assets/${assetId}`);
  });

  it("la URL cambia al cambiar la foto", async () => {
    // Lleva el id del activo, no el del ejercicio. Es lo que permite cachear
    // para siempre sin arriesgarse a mostrar la foto vieja.
    const primera = await guardar();
    const antes = (await assets.exercisePhotos([ejercicioId]))[ejercicioId];
    const segunda = await guardar();
    const despues = (await assets.exercisePhotos([ejercicioId]))[ejercicioId];

    expect(antes).toContain(primera.assetId);
    expect(despues).toContain(segunda.assetId);
    expect(antes).not.toBe(despues);
  });

  it("el EXIF se marca como retirado: es obligatorio antes de subir", async () => {
    // ADR-114. El navegador redibuja la imagen en un canvas y eso descarta los
    // metadatos, incluidas las coordenadas GPS del gimnasio.
    const { assetId } = await guardar();
    const fila = await db.asset.findUnique({ where: { id: assetId } });
    expect(fila!.exifStripped).toBe(true);
  });

  it("el key es la carpeta y un ULID", async () => {
    const { assetId } = await guardar();
    const fila = await db.asset.findUnique({ where: { id: assetId } });
    expect(fila!.storageKey).toMatch(/^exercises\/[0-9A-HJKMNP-TV-Z]{26}\.png$/);
  });

  it("una foto nueva reemplaza a la anterior, binario incluido", async () => {
    // Un ejercicio tiene UNA foto: con dos activas la tarjeta mostraría una al
    // azar, y el bucket crecería sin motivo.
    const primera = await guardar();
    const clavePrimera = (await db.asset.findUnique({ where: { id: primera.assetId } }))!
      .storageKey;

    await guardar();

    expect(await db.assetLink.count({ where: { exerciseId: ejercicioId } })).toBe(1);
    expect(await db.asset.findUnique({ where: { id: primera.assetId } })).toBeNull();
    // Y el binario tampoco está: se borró de R2, no solo de la base.
    expect(await storage.getObject(clavePrimera)).toBeNull();
  });

  it("quitar la foto borra fila, enlace y binario", async () => {
    const { assetId } = await guardar();
    const clave = (await db.asset.findUnique({ where: { id: assetId } }))!.storageKey;

    await assets.removeExercisePhoto(ejercicioId);

    expect(await db.asset.count()).toBe(0);
    expect(await db.assetLink.count()).toBe(0);
    expect(await storage.getObject(clave)).toBeNull();
    expect(await assets.exercisePhotos([ejercicioId])).toEqual({});
  });

  it("borrar el ejercicio se lleva el enlace", async () => {
    await guardar();
    await db.exercise.delete({ where: { id: ejercicioId } });
    expect(await db.assetLink.count()).toBe(0);
  });

  it("un activo que no existe no revienta al servirlo", async () => {
    // La ruta debe poder devolver 404, no un error de servidor.
    expect(await assets.readAsset("01NOEXISTENOEXISTENOEXIST")).toBeNull();
  });

  it("rechaza formatos que no sabemos servir", async () => {
    await expect(guardar(PNG, "image/heic")).rejects.toThrow(/no admitido/);
  });

  it("rechaza una imagen vacía", async () => {
    await expect(guardar(new Uint8Array())).rejects.toThrow(/vacía/);
  });

  it("un ejercicio inexistente se rechaza antes de subir nada", async () => {
    await expect(
      assets.saveExercisePhoto({
        exerciseId: "01NOEXISTENOEXISTENOEXIST",
        bytes: PNG,
        mimeType: "image/png",
        checksum: "x",
        source: "test",
      }),
    ).rejects.toThrow(/No existe/);
    // La comprobación va ANTES del PUT, así que no queda binario huérfano.
    expect(await db.asset.count()).toBe(0);
  });
});
