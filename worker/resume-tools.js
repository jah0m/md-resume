// Tools the MCP endpoint exposes. They help an AI assistant write Markdown
// that this app lays out correctly and export it as PDF. Resume text is never
// logged; only the PDF tools keep anything (the PDF, until its link expires).
// The 履歴書 tools live in rirekisho-tools.js.
import { md } from "../src/lib/markdown.ts";
import sampleResume from "../src/data/sample-resume.md";
import {
  BACKGROUNDS,
  FONTS,
  PAGE_JOBS,
  THEMES,
  generatePdf,
  pdfRateLimit,
  pdfToolResult,
  pickOption,
} from "./pdf.js";
import { RIREKISHO_TOOLS } from "./rirekisho-tools.js";

const MAX_MARKDOWN_CHARS = 100_000;

export const SITE_URL = "https://md-resume.jahom.dev/";

export const FORMAT_GUIDE = `# Markdown Resume Studio: Markdown format guide

Markdown Resume Studio (${SITE_URL}) turns one Markdown file into a designed
A4 Japanese career history document (職務経歴書). Everything runs in the
user's browser. The user pastes the Markdown into the editor (or opens the
.md file), checks the preview, then saves it as PDF.

## Document structure

Write the blocks in this order. The first three are detected by position, so
keep them exactly in this shape.

1. **Document title** — the first line, a level-1 heading:
   \`# 職務経歴書\` (use the document's language, e.g. \`# Resume\`).
   Use only one \`#\` heading in the whole document.
2. **Name block** — the paragraph right after the title, made only of bold
   text. Put the name on one line and, optionally, the romanized name on the
   next line, both inside one pair of \`**\`:
   \`\`\`md
   **山田 太郎
   Taro Yamada**
   \`\`\`
   The app puts this next to the title (left or right, user's choice) and
   uses the first line as the PDF file name (\`職務経歴書_山田 太郎\`).
3. **Contact line** (optional) — the paragraph right after the name block,
   on one line, items separated by \` · \`. Email is shown as plain text
   (mailto links are flattened); profiles are Markdown links:
   \`\`\`md
   Phone: 090-0000-0000 · Email: you@example.com · [LinkedIn](https://www.linkedin.com/in/you) · [GitHub](https://github.com/you)
   \`\`\`
4. **Sections** — level-2 headings, e.g. \`## 職務要約\`, \`## 活かせる経験・知識・技術\`,
   \`## テクニカルスキル\`, \`## 職務経歴\`, \`## 資格\`, \`## 自己PR\`.
5. **Inside 職務経歴**, nest headings without skipping levels:
   - \`### <period>｜<company>\` for each employer, followed by a short bullet
     list (事業内容, 雇用形態 …).
   - \`#### <number> <period> ／ <project>\` for each project, followed by a
     bullet list (役職, チーム規模, 担当 …).
   - \`##### <topic>\` for project subsections such as プロジェクト概要,
     業務内容・工夫, 成果・実績, 開発環境.

## Supported Markdown

- Headings \`#\` to \`#####\`
- Paragraphs; a single newline is kept as a line break
- Bullet and numbered lists
- Tables (good for skills and development environments)
- Bold (\`**text**\`, also works directly before Japanese text), italic, links
- Horizontal rules
- \`<!-- spacer -->\` on a line by itself adds vertical space

Raw HTML is not rendered (it shows up as literal text). Images, code blocks
and other syntax are not part of the layout; the profile photo is added in
the app, not in Markdown.

## Page breaks

Lists and tables split across pages automatically, and table header rows
repeat on each page. A single paragraph or list item cannot be split: if one
is longer than a page, the overflow is cut from the PDF. Keep paragraphs to a
few sentences.

## Writing rules when converting a user's existing resume

- Keep the user's content; do not invent experience, numbers or skills.
- Where information is missing, use placeholders such as \`〇〇\`.
- Bold the key label of a bullet followed by a full-width colon, e.g.
  \`- **要件整理：** 利用部門へのヒアリングを行い…\`.
- Call \`get_sample_resume\` for a complete example, and
  \`validate_resume_markdown\` on the result before giving it to the user.
- Tell the user to paste the result into ${SITE_URL} (or save it as a .md
  file and use "Open .md"), then use "Save as PDF".
`;

export function getSampleResume() {
  return sampleResume;
}

const CONTACT_PATTERN =
  /@|linkedin|github|email|メール|電話|携帯|phone|tel|website|ポートフォリオ/i;
const SPACER_LINE = /^\s*<!--\s*spacer\s*-->\s*$/i;
const PLACEHOLDER_PATTERN = /〇〇|△△/g;
// About one third of an A4 page of Japanese text. A block this long is not an
// error by itself, but it is the kind that ends up clipped at a page break.
const LONG_BLOCK_CHARS = 700;

function isBoldOnly(inline) {
  let depth = 0;
  let sawText = false;
  for (const child of inline.children ?? []) {
    if (child.type === "strong_open") depth += 1;
    else if (child.type === "strong_close") depth -= 1;
    else if (child.type === "softbreak" || child.type === "hardbreak") continue;
    else if (child.type === "text" && !child.content.trim()) continue;
    else if (depth === 0) return false;
    else sawText = true;
  }
  return sawText;
}

function inlineText(inline) {
  return (inline.children ?? [])
    .map((child) =>
      child.type === "softbreak" || child.type === "hardbreak"
        ? "\n"
        : child.content,
    )
    .join("");
}

function lineOf(token) {
  return token.map ? token.map[0] + 1 : undefined;
}

export function validateResumeMarkdown(source) {
  const errors = [];
  const warnings = [];
  const notes = [];
  const add = (list, message, line) =>
    list.push(line ? { line, message } : { message });

  if (typeof source !== "string" || !source.trim()) {
    add(errors, "The Markdown is empty.");
    return { ok: false, errors, warnings, notes, outline: [] };
  }

  // Parse the source as written (without the app's spacer normalization) so
  // the reported line numbers match the user's text.
  const originalTokens = md.parse(source, {});
  const blocks = originalTokens.filter((t) => t.level === 0 && t.nesting !== -1);

  // 1. Title, name block and contact line, detected by position.
  const first = blocks[0];
  if (!first || first.type !== "heading_open" || first.tag !== "h1") {
    add(
      errors,
      "The document must start with a level-1 title such as `# 職務経歴書`.",
      first && lineOf(first),
    );
  } else {
    const firstIndex = originalTokens.indexOf(first);
    const afterTitle = originalTokens[firstIndex + 3];
    const nameInline = originalTokens[firstIndex + 4];
    if (afterTitle?.type !== "paragraph_open" || !isBoldOnly(nameInline)) {
      add(
        warnings,
        "No name block after the title. Put the name in a bold-only paragraph right after the title (e.g. `**山田 太郎\\nTaro Yamada**`) so it is laid out next to the title and used for the PDF file name.",
        afterTitle && lineOf(afterTitle),
      );
    } else {
      const contactOpen = originalTokens[firstIndex + 6];
      const contactInline = originalTokens[firstIndex + 7];
      const contactText =
        contactOpen?.type === "paragraph_open" ? inlineText(contactInline) : "";
      const hasLink = (contactInline?.children ?? []).some(
        (c) => c.type === "link_open",
      );
      if (!contactText || (!hasLink && !CONTACT_PATTERN.test(contactText))) {
        add(
          notes,
          "No contact line after the name block. This is optional; add one line like `Email: you@example.com · [GitHub](https://github.com/you)` to show it under the title.",
        );
      } else {
        if (/\n/.test(contactText.trim()))
          add(
            warnings,
            "The contact line spans several lines. Keep it on one line separated by ` · `.",
            lineOf(contactOpen),
          );
        if (
          (contactInline.children ?? []).some(
            (c) => c.type === "link_open" && /^mailto:/i.test(c.attrGet("href") ?? ""),
          )
        )
          add(
            notes,
            "Email links in the contact line are shown as plain text.",
            lineOf(contactOpen),
          );
      }
    }
  }

  // 2. Whole-document checks.
  const outline = [];
  let previousLevel = 0;
  let h1Count = 0;
  for (let i = 0; i < originalTokens.length; i += 1) {
    const token = originalTokens[i];
    const line = lineOf(token);

    if (token.type === "heading_open") {
      const level = Number(token.tag.slice(1));
      const text = inlineText(originalTokens[i + 1]).trim();
      outline.push({ level, text, line });
      if (level === 1) h1Count += 1;
      if (level === 6)
        add(warnings, "Level-6 headings (`######`) are not styled; use up to `#####`.", line);
      if (previousLevel && level > previousLevel + 1)
        add(
          warnings,
          `Heading "${text}" jumps from level ${previousLevel} to ${level}. Do not skip heading levels.`,
          line,
        );
      previousLevel = level;
    }

    if (token.type === "fence" || token.type === "code_block")
      add(warnings, "Code blocks are not part of the resume layout.", line);

    if (token.type === "inline") {
      // With html:false, raw HTML survives as literal text tokens. Link URLs
      // and code spans are separate tokens, so they are not flagged.
      if (
        (token.children ?? []).some(
          (c) =>
            c.type === "text" &&
            !SPACER_LINE.test(c.content) &&
            /<\/?[a-zA-Z][^>]*>|<!--/.test(c.content),
        )
      )
        add(
          warnings,
          "Raw HTML is not rendered and will appear as literal text. The only supported tag is `<!-- spacer -->` on its own line.",
          line,
        );
      if ((token.children ?? []).some((c) => c.type === "image"))
        add(
          warnings,
          "Markdown images are not supported. The profile photo is added in the app.",
          line,
        );
    }

    if (
      (token.type === "paragraph_open" || token.type === "list_item_open") &&
      token.level <= 2
    ) {
      // Measure the text of this block, excluding nested lists.
      let length = 0;
      for (let j = i + 1; j < originalTokens.length; j += 1) {
        const inner = originalTokens[j];
        if (inner.type === "paragraph_close" && token.type === "paragraph_open") break;
        if (inner.type === "bullet_list_open" || inner.type === "ordered_list_open") break;
        if (inner.type === "list_item_close") break;
        if (inner.type === "inline") length += inner.content.length;
      }
      if (length > LONG_BLOCK_CHARS)
        add(
          warnings,
          `This block is about ${length} characters long. A single paragraph or list item cannot split across pages, so very long ones may be cut off in the PDF. Consider splitting it.`,
          line,
        );
    }
  }
  if (h1Count > 1)
    add(warnings, `Found ${h1Count} level-1 headings. Use \`#\` only for the document title.`);
  if (!outline.some((h) => h.level === 2))
    add(warnings, "No `##` sections found (e.g. `## 職務要約`, `## 職務経歴`).");

  // 3. Remaining placeholders.
  const placeholderLines = [];
  source.split(/\r?\n/).forEach((text, index) => {
    if (PLACEHOLDER_PATTERN.test(text)) placeholderLines.push(index + 1);
    PLACEHOLDER_PATTERN.lastIndex = 0;
  });
  if (placeholderLines.length)
    add(
      notes,
      `Placeholders (〇〇 / △△) remain on ${placeholderLines.length} line(s): ${placeholderLines.slice(0, 20).join(", ")}${placeholderLines.length > 20 ? ", …" : ""}. Ask the user to fill them in.`,
    );

  return { ok: errors.length === 0, errors, warnings, notes, outline };
}

// Same rule as the app's pdfTitle(): "<title>_<first line of the name>".
export function pdfFileName(source) {
  const tokens = md.parse(source, {});
  const titleIndex = tokens.findIndex(
    (t) => t.type === "heading_open" && t.tag === "h1",
  );
  const title =
    titleIndex >= 0 ? inlineText(tokens[titleIndex + 1]).trim() : "";
  let name = "";
  if (
    titleIndex === 0 &&
    tokens[3]?.type === "paragraph_open" &&
    isBoldOnly(tokens[4])
  )
    name = inlineText(tokens[4]).trim().split("\n")[0].trim();
  const base = [title || "職務経歴書", name].filter(Boolean).join("_");
  return base.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").slice(0, 120) || "resume";
}

export const TOOLS = [
  {
    name: "get_resume_format_guide",
    title: "Get resume Markdown format guide",
    description:
      "Returns the Markdown structure Markdown Resume Studio expects for a Japanese career history document (職務経歴書): title, name block, contact line, section and project headings, supported syntax and page-break rules. Read this before writing or converting a resume for this app.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: () => ({ content: [{ type: "text", text: FORMAT_GUIDE }] }),
  },
  {
    name: "get_sample_resume",
    title: "Get sample resume Markdown",
    description:
      "Returns the app's complete sample 職務経歴書 in Markdown, with placeholder content (〇〇). Use its headings and structure as the template when organizing a user's resume.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: () => ({ content: [{ type: "text", text: getSampleResume() }] }),
  },
  {
    name: "validate_resume_markdown",
    title: "Validate resume Markdown",
    description:
      "Checks resume Markdown against Markdown Resume Studio's layout rules and reports errors, warnings and notes with line numbers, plus the heading outline. Errors break the layout; warnings are likely problems; notes are informational (e.g. remaining 〇〇 placeholders). The text is checked in memory and not stored.",
    inputSchema: {
      type: "object",
      properties: {
        markdown: {
          type: "string",
          description: "The full resume Markdown to check.",
        },
      },
      required: ["markdown"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: (args) => {
      const result = validateResumeMarkdown(args?.markdown);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    },
  },
  {
    name: "generate_resume_pdf",
    title: "Generate resume PDF",
    description:
      "Renders resume Markdown into an A4 PDF with Markdown Resume Studio's layout (same result as the site's \"Save as PDF\") and returns a download link that expires after 1 hour. Validate the Markdown first and fix its errors. No profile photo is included; for a photo, the user should paste the Markdown into the site instead. The Markdown is sent to the server for rendering and the PDF is kept only until the link expires.",
    inputSchema: {
      type: "object",
      properties: {
        markdown: {
          type: "string",
          description: "The full resume Markdown.",
        },
        theme: {
          type: "string",
          enum: THEMES,
          description: "Accent color. Default: navy.",
        },
        font: {
          type: "string",
          enum: FONTS,
          description: "Resume font. Default: noto-sans-jp.",
        },
        background: {
          type: "string",
          enum: BACKGROUNDS,
          description: "Page background tint. Default: paper.",
        },
        show_date: {
          type: "boolean",
          description: "Show today's date on the first page. Default: true.",
        },
        name_align: {
          type: "string",
          enum: ["right", "left"],
          description: "Which side of the title the name block sits on. Default: right.",
        },
      },
      required: ["markdown"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    run: async (args, context) => {
      const check = validateResumeMarkdown(args.markdown);
      if (!check.ok)
        return {
          isError: true,
          content: [
            {
              type: "text",
              text:
                "The Markdown has errors; fix them and try again.\n" +
                JSON.stringify(check.errors, null, 2),
            },
          ],
        };

      if (args.markdown.length > MAX_MARKDOWN_CHARS)
        return {
          isError: true,
          content: [{ type: "text", text: `The Markdown is too long (max ${MAX_MARKDOWN_CHARS} characters).` }],
        };
      const limited = await pdfRateLimit(context);
      if (limited) return limited;
      const options = {
        theme: pickOption(args.theme, THEMES, "navy"),
        font: pickOption(args.font, FONTS, "noto-sans-jp"),
        background: pickOption(args.background, BACKGROUNDS, "paper"),
        showDate: args.show_date !== false,
        nameAlign: args.name_align === "left" ? "left" : "right",
      };
      const result = await generatePdf(
        context.env,
        context.origin,
        PAGE_JOBS.career(args.markdown, options),
        pdfFileName(args.markdown),
      );
      return pdfToolResult(result, { options });
    },
  },
  ...RIREKISHO_TOOLS,
];
