import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Sin paralelismo entre archivos: los tests comparten bases SQLite y
    // SQLite admite un escritor. En paralelo se pisan y el fallo es
    // intermitente, que es el peor tipo de fallo.
    fileParallelism: false,
    globalSetup: ["./tests/global-setup.ts"],
    // Migrar contra una base remota tarda; el valor por defecto de 10 s
    // expiraba antes de terminar.
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
