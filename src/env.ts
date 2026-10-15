/** Load .env if present (Node 22+). Import this first in any entrypoint. */
try {
  process.loadEnvFile(".env");
} catch {
  // no .env: rely on the real environment (CI secrets)
}
