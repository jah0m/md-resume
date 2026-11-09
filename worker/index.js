import { handleMcp } from "./mcp.js";
import { servePdf } from "./pdf.js";

// Only /api/* and /mcp reach this Worker (see run_worker_first in
// wrangler.jsonc); every other path is served directly from the static assets.
export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === "/mcp") return handleMcp(request, env);

    if (pathname.startsWith("/api/pdf/") && request.method === "GET")
      return servePdf(env, pathname.slice("/api/pdf/".length));

    if (pathname === "/api/export" && request.method === "POST") {
      await env.DB
        .prepare("UPDATE counters SET n = n + 1 WHERE name = 'export_pdf'")
        .run();
      return new Response(null, { status: 204 });
    }

    return new Response("Not found", { status: 404 });
  },
};
