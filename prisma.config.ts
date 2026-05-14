import path from "node:path"
import fs from "node:fs"
import { defineConfig } from "prisma/config"

// Load .env.local manually since Prisma config doesn't use Next.js env loading
function loadEnvLocal() {
  try {
    const envPath = path.join(__dirname, ".env.local")
    const content = fs.readFileSync(envPath, "utf8")
    for (const line of content.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eqIndex = trimmed.indexOf("=")
      if (eqIndex === -1) continue
      const key = trimmed.slice(0, eqIndex)
      let value = trimmed.slice(eqIndex + 1)
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = value
    }
  } catch { /* no .env.local */ }
}

loadEnvLocal()

const tursoUrl = process.env.TURSO_DATABASE_URL
const tursoToken = process.env.TURSO_AUTH_TOKEN

let datasourceUrl: string
if (tursoUrl && tursoToken) {
  // Convert libsql:// to https:// for Prisma schema engine compatibility
  const httpUrl = tursoUrl.replace("libsql://", "https://")
  datasourceUrl = `${httpUrl}?authToken=${tursoToken}`
} else {
  datasourceUrl = `file:${path.join(__dirname, "prisma", "dev.db")}`
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: datasourceUrl,
  },
})
