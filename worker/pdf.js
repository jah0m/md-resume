// Server-side PDF export for the MCP PDF tools. A headless browser
// (Cloudflare Browser Rendering) opens this site with the document preloaded
// into localStorage, waits for the preview to finish laying out, and prints
// it. That is the same page and print CSS the "Save as PDF" buttons use, so
// the output matches the browser export.
import puppeteer from "@cloudflare/puppeteer";

export const PDF_TTL_SECONDS = 60 * 60;

export const THEMES = ["navy", "graphite", "slate", "forest", "burgundy", "amber"];
export const BACKGROUNDS = ["paper", "mist", "linen"];
export const FONTS = [
  "noto-sans-jp",
  "noto-serif-jp",
  "biz-udpgothic",
  "biz-udpmincho",
  "zen-kaku-gothic-new",
  "zen-maru-gothic",
  "klee-one",
];

const RENDER_TIMEOUT_MS = 30_000;

// What to load and how to tell the page has finished laying out, per document.
export const PAGE_JOBS = {
  career: (markdown, options) => ({
    path: "/",
    storage: {
      "md-resume-content-v2": markdown,
      "md-resume-theme": options.theme,
      "md-resume-font": options.font,
      "md-resume-background": options.background,
      "md-resume-show-date": String(options.showDate),
      "md-resume-name-align": options.nameAlign,
      "md-resume-locale": "ja",
      // No photo: the MCP tool has no way to receive one.
      "md-resume-avatar-default-dismissed": "true",
    },
    ready: () => {
      const preview = document.getElementById("resume-preview");
      const state = preview?.dataset.fontStatus;
      if (!preview?.querySelector(".resume-page")) return false;
      if (state === "error") return "error";
      if (state !== "ready") return false;
      return document.getElementById("content-overflow-warning")?.hidden === false
        ? "clipped"
        : "ready";
    },
  }),
  rirekisho: (draft) => ({
    path: "/#rirekisho",
    storage: {
      "rirekisho-draft-v1": JSON.stringify(draft),
      "md-resume-locale": "ja",
    },
    ready: () => {
      const panel = document.getElementById("personal-workspace");
      const button = document.getElementById("r-print");
      if (!panel || panel.hidden || !document.querySelector("#r-pages .r-sheet"))
        return false;
      // The print button is disabled while the font loads, as in the app.
      if (button?.disabled || document.getElementById("r-font-status")?.textContent)
        return false;
      return "ready";
    },
  }),
};

// Kept separate from launching so it can be exercised against a local browser.
export async function printPage(browser, origin, job) {
  const page = await browser.newPage();
  try {
    await page.evaluateOnNewDocument((entries) => {
      try {
        // Only seed the first load; the app writes its own state afterwards.
        if (sessionStorage.getItem("mcp-seeded")) return;
        sessionStorage.setItem("mcp-seeded", "1");
        localStorage.clear();
        for (const [key, value] of Object.entries(entries))
          localStorage.setItem(key, value);
      } catch {}
    }, job.storage);
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(`${origin}${job.path}`, {
      waitUntil: "networkidle0",
      timeout: RENDER_TIMEOUT_MS,
    });
    const status = await page
      .waitForFunction(job.ready, { timeout: RENDER_TIMEOUT_MS, polling: 200 })
      .then((handle) => handle.jsonValue());
    if (status === "error") throw new Error("The resume fonts failed to load.");

    await page.emulateMediaType("print");
    const pdf = await page.pdf({
      preferCSSPageSize: true,
      printBackground: true,
      timeout: RENDER_TIMEOUT_MS,
    });
    return { pdf, clipped: status === "clipped" };
  } finally {
    await page.close().catch(() => {});
  }
}

function randomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function pickOption(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

// Per-IP limit shared by both PDF tools. Returns an MCP error result when hit.
export async function pdfRateLimit(context) {
  if (!context.limiter) return null;
  const { success } = await context.limiter.limit({ key: context.clientKey });
  return success
    ? null
    : {
        isError: true,
        content: [{ type: "text", text: "Too many PDF requests. Wait a minute and try again." }],
      };
}

// Render a job, keep the PDF in R2 and return its expiring download link.
export async function generatePdf(env, origin, job, fileName) {
  if (!env.BROWSER || !env.PDFS)
    throw new Error("PDF generation is not configured on this server.");

  const browser = await puppeteer.launch(env.BROWSER);
  let result;
  try {
    result = await printPage(browser, origin, job);
  } finally {
    await browser.close();
  }
  const { pdf, clipped } = result;

  const id = randomId();
  const expiresAt = new Date(Date.now() + PDF_TTL_SECONDS * 1000);
  const fullName = `${fileName}.pdf`;
  await env.PDFS.put(`pdf/${id}`, pdf, {
    httpMetadata: { contentType: "application/pdf" },
    customMetadata: { expiresAt: expiresAt.toISOString(), fileName: fullName },
  });

  // Same anonymous counter the browser "Save as PDF" buttons bump.
  await env.DB?.prepare(
    "UPDATE counters SET n = n + 1 WHERE name = 'export_pdf'",
  ).run().catch(() => {});

  return {
    url: `${origin}/api/pdf/${id}`,
    fileName: fullName,
    expiresAt: expiresAt.toISOString(),
    sizeBytes: pdf.byteLength,
    contentClipped: clipped,
  };
}

// MCP tool result for a finished PDF, shared by both documents.
export function pdfToolResult(result, extra = {}) {
  const lines = [
    `PDF ready: ${result.url}`,
    `File name: ${result.fileName}`,
    `The link expires at ${result.expiresAt} (1 hour).`,
  ];
  if (result.contentClipped)
    lines.push(
      "Warning: some paragraph or list item is longer than one page, so part of it is cut off in the PDF. Split it and generate again.",
    );
  return {
    content: [
      { type: "text", text: lines.join("\n") },
      {
        type: "resource_link",
        uri: result.url,
        name: result.fileName,
        mimeType: "application/pdf",
        size: result.sizeBytes,
      },
    ],
    structuredContent: { ...result, ...extra },
  };
}

// GET /api/pdf/<id>: serve a generated PDF until it expires. The R2 bucket's
// lifecycle rule deletes leftovers; expired objects are also removed here.
export async function servePdf(env, id) {
  if (!/^[0-9a-f]{48}$/.test(id) || !env.PDFS)
    return new Response("Not found", { status: 404 });
  const object = await env.PDFS.get(`pdf/${id}`);
  if (!object) return new Response("Not found or expired", { status: 404 });

  const { expiresAt, fileName = "resume.pdf" } = object.customMetadata ?? {};
  if (!expiresAt || Date.parse(expiresAt) < Date.now()) {
    await env.PDFS.delete(`pdf/${id}`);
    return new Response("This link has expired", { status: 410 });
  }

  const asciiName = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return new Response(object.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
      "Referrer-Policy": "no-referrer",
    },
  });
}
