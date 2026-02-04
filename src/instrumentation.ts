/**
 * Instrumentation runs in both Node and Edge runtimes. Edge disallows eval/codegen,
 * so we do nothing here. GitHub fetch patching is done in lib/patch-github-fetch.ts
 * (imported by auth.ts, Node-only).
 */
export async function register() {
  // No-op: fetch patch lives in lib/patch-github-fetch.ts for Node-only use
}
