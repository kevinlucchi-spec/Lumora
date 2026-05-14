import { PrismaClient } from "@prisma/client"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import path from "node:path"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function getDbUrl(): string {
  const raw = process.env.DATABASE_URL
  if (raw && raw.startsWith("file:")) {
    const stripped = raw.slice(5)
    if (path.isAbsolute(stripped)) return `file:${stripped}`
    return `file:${path.join(process.cwd(), stripped)}`
  }
  return `file:${path.join(process.cwd(), "prisma", "dev.db")}`
}

function createPrismaClient() {
  const adapter = new PrismaBetterSqlite3({ url: getDbUrl() })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
