/**
 * Base de pruebas sobre Postgres.
 *
 * `global-setup.ts` valida que sea una base DISTINTA de la real y aplica las
 * migraciones. Aquí solo se lee la URL que dejó preparada.
 *
 * Sin TEST_DATABASE_URL las suites que tocan base se saltan, con aviso, en vez
 * de fallar y que alguien acabe desactivándolas.
 */

export const HAY_BASE_DE_PRUEBAS = Boolean(process.env.TEST_DATABASE_URL);

export function createTestDatabase() {
  const url = process.env.TEST_SCHEMA_URL;
  if (!url) throw new Error("global-setup no preparó la base de pruebas");
  return { url, cleanup: () => {} };
}
