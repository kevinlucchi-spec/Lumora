// @ts-nocheck
/**
 * Next.js instrumentation hook — runs once when the server starts.
 * Pipeline now runs inline via after() in the generate route,
 * so no background worker is needed.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("[instrumentation] Server started (pipeline runs inline via after())")
  }
}
