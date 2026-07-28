import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

// SQLite en modo WAL: un escritor, muchos lectores (ADR-110).
// LifeLog escribe; brain-ops y los dashboards leen.
const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./data/lifelog.db",
});

// Singleton: Next.js recarga módulos en desarrollo y cada recarga abriría una
// conexión nueva. SQLite admite un solo escritor; agotarlo es fácil.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
