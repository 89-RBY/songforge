export async function register() {
  // Fail fast: an invalid configuration stops the server at startup, not at the first request.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getEnv } = await import("@/server/config/env");
    getEnv();
  }
}
