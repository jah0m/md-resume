// A stateless Model Context Protocol server over Streamable HTTP. Every POST
// carries one JSON-RPC message (or a batch) and gets a plain JSON reply, so
// there are no sessions, no SSE stream and no storage.
import { SITE_URL, TOOLS } from "./resume-tools.js";

const SUPPORTED_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER_INFO = {
  name: "md-resume-studio",
  title: "Markdown Resume Studio",
  version: "1.0.0",
  websiteUrl: SITE_URL,
};
const INSTRUCTIONS =
  "Helps prepare Japanese job-application documents with Markdown Resume Studio (" +
  SITE_URL +
  "), and export them as PDF. " +
  "職務経歴書 (career history) is Markdown: call get_resume_format_guide and get_sample_resume first, " +
  "then validate_resume_markdown, then generate_resume_pdf if the user wants a PDF. " +
  "履歴書 (rirekisho, the standard résumé form) is JSON data: call get_rirekisho_format_guide first, " +
  "then validate_rirekisho_data, then generate_rirekisho_pdf if the user wants a PDF. " +
  "Fix reported errors and warnings before handing anything to the user.";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Accept, Authorization, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, MCP-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function rpcError(id, code, message) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

async function handleMessage(message, context) {
  const isRequest =
    message && typeof message === "object" && "method" in message && "id" in message;
  const isNotification =
    message && typeof message === "object" && "method" in message && !("id" in message);

  // Notifications (e.g. notifications/initialized) and client responses need
  // no reply.
  if (isNotification || (message && typeof message === "object" && !("method" in message)))
    return null;
  if (!isRequest || message.jsonrpc !== "2.0" || typeof message.method !== "string")
    return rpcError(message?.id, -32600, "Invalid Request");

  const { id, method, params } = message;
  const ok = (result) => ({ jsonrpc: "2.0", id, result });

  switch (method) {
    case "initialize": {
      const requested = params?.protocolVersion;
      return ok({
        protocolVersion: SUPPORTED_VERSIONS.includes(requested)
          ? requested
          : SUPPORTED_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return ok({});
    case "tools/list":
      return ok({
        tools: TOOLS.map(({ run, ...definition }) => definition),
      });
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === params?.name);
      if (!tool) return rpcError(id, -32602, `Unknown tool: ${params?.name}`);
      const args = params?.arguments ?? {};
      // Required arguments must be present with their declared type. An
      // object argument may also arrive as a JSON string; the tool parses it.
      const badArgs = (tool.inputSchema.required ?? []).filter((key) => {
        const type = tool.inputSchema.properties[key]?.type;
        const value = args[key];
        if (type === "object")
          return !(typeof value === "string" || (value && typeof value === "object"));
        return typeof value !== type;
      });
      if (badArgs.length)
        return ok({
          isError: true,
          content: [
            {
              type: "text",
              text: `Missing or invalid required argument(s): ${badArgs.join(", ")}`,
            },
          ],
        });
      try {
        return ok(await tool.run(args, context));
      } catch (error) {
        return ok({
          isError: true,
          content: [{ type: "text", text: `Tool failed: ${error?.message ?? error}` }],
        });
      }
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

export async function handleMcp(request, env) {
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: CORS_HEADERS });

  if (request.method !== "POST")
    // No server-initiated stream and no sessions to delete.
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "POST, OPTIONS", ...CORS_HEADERS },
    });

  const version = request.headers.get("MCP-Protocol-Version");
  if (version && !SUPPORTED_VERSIONS.includes(version))
    return json(rpcError(null, -32600, `Unsupported protocol version: ${version}`), 400);

  const context = {
    env,
    origin: new URL(request.url).origin,
    limiter: env.PDF_LIMITER,
    clientKey: request.headers.get("CF-Connecting-IP") ?? "unknown",
  };

  let body;
  try {
    body = await request.json();
  } catch {
    return json(rpcError(null, -32700, "Parse error"), 400);
  }

  if (Array.isArray(body)) {
    if (!body.length) return json(rpcError(null, -32600, "Invalid Request"), 400);
    const replies = (
      await Promise.all(body.map((message) => handleMessage(message, context)))
    ).filter(Boolean);
    return replies.length
      ? json(replies)
      : new Response(null, { status: 202, headers: CORS_HEADERS });
  }

  const reply = await handleMessage(body, context);
  return reply ? json(reply) : new Response(null, { status: 202, headers: CORS_HEADERS });
}
