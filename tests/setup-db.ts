import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Cada suite corre contra su propia base efímera.
 *
 * Se aplican las migraciones reales, no `db push`: así los tests también
 * verifican que los triggers de I-02 existen, que es la mitad del valor.
 */
export function createTestDatabase() {
  const dir = mkdtempSync(join(tmpdir(), "lifelog-test-"));
  const url = `file:${join(dir, "test.db")}`;

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });

  return {
    url,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}
