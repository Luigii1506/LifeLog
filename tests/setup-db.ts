import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";

/**
 * Base de pruebas sobre Postgres.
 *
 * Cada suite corre en su propio SCHEMA, que es la forma barata de aislar en
 * Postgres: se crea, se migra, se borra. Sin contenedores ni bases separadas.
 *
 * Necesita TEST_DATABASE_URL. Sin ella las suites que tocan base se saltan —
 * a propósito y con aviso, en vez de fallar y que alguien las desactive.
 *
 *   docker run -d -p 5433:5432 -e POSTGRES_PASSWORD=test postgres:16
 *   export TEST_DATABASE_URL="postgres://postgres:test@localhost:5433/postgres"
 *
 * O una rama de Neon, que es gratis y no necesita Docker.
 */

export const HAY_BASE_DE_PRUEBAS = Boolean(process.env.TEST_DATABASE_URL);

export function createTestDatabase() {
  const base = process.env.TEST_DATABASE_URL;
  if (!base) throw new Error("TEST_DATABASE_URL no está definida");

  const schema = `test_${randomBytes(6).toString("hex")}`;
  const url = `${base}${base.includes("?") ? "&" : "?"}schema=${schema}`;

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });

  return {
    url,
    cleanup: () => {
      try {
        execFileSync(
          "npx",
          ["prisma", "db", "execute", "--stdin"],
          {
            env: { ...process.env, DATABASE_URL: url },
            input: `DROP SCHEMA IF EXISTS "${schema}" CASCADE;`,
            stdio: "pipe",
          },
        );
      } catch {
        // Un schema huérfano en la base de pruebas no rompe nada.
      }
    },
  };
}
