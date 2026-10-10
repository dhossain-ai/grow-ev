/** Minimal runtime surface used by the Edge Function; verify with Deno before deployment. */
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): unknown;
};
