// Only /api/* reaches this Worker (see run_worker_first in wrangler.jsonc); every
// other path is served directly from the static assets.
export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/export" && request.method === "POST") {
      await env.DB
        .prepare("UPDATE counters SET n = n + 1 WHERE name = 'export_pdf'")
        .run();
      return new Response(null, { status: 204 });
    }

    return new Response("Not found", { status: 404 });
  },
};
