// vitest no lee .env por su cuenta. Sin esto, DATABASE_URL queda indefinida
// y la comprobación de abajo no tendría con qué comparar: un guardia que se
// salta solo es peor que no tenerlo, porque da falsa confianza.
import "dotenv/config";
import { execFileSync } from "node:child_process";

/**
 * Base de pruebas.
 *
 * PARA QUE NO VUELVA A PASAR: los tests borran tablas enteras en cada
 * `beforeEach`. Si apuntan a la base real, la vacían.
 *
 * Ocurrió. Se intentó aislar con `?schema=test_xxx` en la URL, pero el
 * adaptador serverless de Neon IGNORA ese parámetro: los tests corrieron
 * contra `public` y borraron 29 alimentos y 63 ejercicios de producción. Los
 * schemas `test_*` se crearon vacíos, dando la falsa impresión de aislamiento.
 *
 * Por eso ahora la comprobación no es «hay un schema distinto» sino «la URL de
 * pruebas es OTRA BASE». Es la única garantía que no depende de que un
 * adaptador respete un parámetro.
 *
 * Opciones para TEST_DATABASE_URL:
 *   - Una rama de Neon (gratis): Neon → Branches → New branch → copia su cadena
 *   - Postgres local: docker run -d -p 5433:5432 -e POSTGRES_PASSWORD=test postgres:16
 */
export async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;

  const produccion = process.env.DATABASE_URL;
  if (!produccion) {
    throw new Error(
      "No hay DATABASE_URL con la que comparar. Sin saber cuál es la base real " +
        "no se puede garantizar que los tests no la borren.",
    );
  }
  if (mismaBase(url, produccion)) {
    throw new Error(
      "TEST_DATABASE_URL apunta a la MISMA base que DATABASE_URL.\n" +
        "Los tests borran tablas enteras: esto vaciaría tu base real.\n" +
        "Usa una rama de Neon o un Postgres local. Ver tests/global-setup.ts.",
    );
  }

  await liberarLockDeMigracion(url);

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });

  process.env.TEST_SCHEMA_URL = url;
}

/**
 * Libera el lock de migración que dejan las ejecuciones interrumpidas.
 *
 * `prisma migrate deploy` toma un lock consultivo (`pg_advisory_lock`). Si el
 * proceso muere antes de soltarlo —Ctrl-C, un pipe que se cierra, el test
 * runner que se cae— la sesión queda inactiva en el servidor con el lock
 * puesto, y TODA ejecución posterior espera diez segundos y falla. El error que
 * sale no menciona ningún lock huérfano, así que parece un problema de red.
 *
 * Solo se hace sobre la base de PRUEBAS, y solo con sesiones inactivas: una
 * migración en curso de verdad está `active` y no se toca.
 */
async function liberarLockDeMigracion(url: string): Promise<void> {
  const { PrismaClient } = await import("../src/generated/prisma/client");
  const { PrismaNeon } = await import("@prisma/adapter-neon");
  const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });

  try {
    const huerfanos = await db.$queryRawUnsafe<{ pid: number }[]>(
      `SELECT l.pid
         FROM pg_locks l
         JOIN pg_stat_activity a ON a.pid = l.pid
        WHERE l.locktype = 'advisory'
          AND l.granted
          AND a.state = 'idle'
          AND a.pid <> pg_backend_pid()`,
    );
    for (const { pid } of huerfanos) {
      await db.$queryRawUnsafe(`SELECT pg_terminate_backend($1)`, pid);
    }
    if (huerfanos.length > 0) {
      console.warn(
        `[pruebas] liberados ${huerfanos.length} lock(s) de migración huérfanos`,
      );
    }
  } catch {
    // Si esto falla, que falle la migración con su propio mensaje. Limpiar es
    // una cortesía, no un requisito.
  } finally {
    await db.$disconnect();
  }
}

/** Compara host y nombre de base, ignorando parámetros como `?schema=`. */
function mismaBase(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return ua.host === ub.host && ua.pathname === ub.pathname;
  } catch {
    return a === b;
  }
}
