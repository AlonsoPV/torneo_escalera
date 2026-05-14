/**
 * Tipos mínimos para que TypeScript del IDE valide Edge Functions (runtime real: Deno en Supabase).
 */
declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
  serve(handler: (request: Request) => Response | Promise<Response>): void
}
