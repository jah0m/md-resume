// MCP tools for the Japanese-style 履歴書. Its data is the same JSON the
// site's 履歴書 tab saves and opens (「データを保存」/「データを開く」), so an
// AI assistant can fill it in, check it, hand the file to the user, or turn
// it straight into a PDF. The limits below mirror validate() in
// src/lib/rirekisho.ts; keep them in sync.
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

const SITE_URL = "https://md-resume.jahom.dev/";

const FIELDS = {
  date: "作成日 — document date, YYYY-MM-DD (shown as 「〇年〇月〇日 現在」; also used to compute age)",
  name: "氏名",
  kana: "ふりがな for the name, in hiragana",
  birthday: "生年月日, YYYY-MM-DD",
  gender: "性別 (optional; leave empty to omit)",
  postal: "郵便番号, e.g. 100-0001 (without 〒)",
  addressKana: "ふりがな for the address, in hiragana",
  address: "現住所",
  phone: "電話番号",
  email: "メールアドレス",
  contact: "連絡先 — only if different from 現住所; otherwise empty",
};
const GROUPS = ["education", "employment", "qualifications"];
const FIELD_MAX = 160;
const ROW_TEXT_MAX = 180;
const MAX_ROWS = 50;
const MAX_SECTIONS = 20;
const SECTION_TITLE_MAX = 80;
const SECTION_CONTENT_MAX = 1000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const AUTO_ROWS = new Set(["学歴", "職歴", "以上"]);

function today() {
  // Japan time, since the document is Japanese.
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export function sampleRirekisho() {
  return {
    fields: {
      date: today(),
      name: "山田 太郎",
      kana: "やまだ たろう",
      birthday: "1995-04-15",
      gender: "",
      postal: "100-0001",
      addressKana: "とうきょうと ちよだく ちよだ",
      address: "東京都千代田区千代田1-1 サンプルマンション101",
      phone: "090-0000-0000",
      email: "taro.yamada@example.com",
      contact: "",
    },
    education: [
      { year: "2014", month: "4", text: "〇〇大学 情報学部 入学" },
      { year: "2018", month: "3", text: "〇〇大学 情報学部 卒業" },
    ],
    employment: [
      { year: "2018", month: "4", text: "株式会社〇〇 入社\n開発部にてWebアプリケーション開発に従事" },
      { year: "", month: "", text: "現在に至る" },
    ],
    qualifications: [
      { year: "2017", month: "10", text: "基本情報技術者試験 合格" },
      { year: "2020", month: "6", text: "普通自動車第一種運転免許 取得" },
    ],
    sections: [
      {
        id: "motivation",
        title: "志望動機・自己PR",
        content:
          "これまでWebアプリケーションの開発に携わり、使いやすさと品質を大切に取り組んできました。\n貴社のサービスを通じて、より多くの方の課題解決に貢献したいと考え、志望いたしました。",
      },
      { id: "wishes", title: "本人希望欄", content: "貴社の規定に従います。" },
    ],
    font: "noto-sans-jp",
    theme: "navy",
    background: "paper",
    showDate: true,
  };
}

// Built per request: Workers freeze the clock at module load, so today()
// would read 1970-01-01 there.
const guideText = () => `# Markdown Resume Studio: 履歴書 (Japanese résumé) data format

The 履歴書 tab of ${SITE_URL} (open ${SITE_URL}#rirekisho) is a form, not
Markdown. Its data is one JSON object, the same file the tab saves with
「データを保存」 and loads with 「データを開く」. The printed document is
always in Japanese.

## Shape

\`\`\`json
{
  "fields": { ${Object.keys(FIELDS).map((k) => `"${k}": "…"`).join(", ")} },
  "education":      [{ "year": "2014", "month": "4", "text": "…" }],
  "employment":     [{ "year": "2018", "month": "4", "text": "…" }],
  "qualifications": [{ "year": "2017", "month": "10", "text": "…" }],
  "sections": [{ "id": "motivation", "title": "志望動機・自己PR", "content": "…" }],
  "font": "noto-sans-jp", "theme": "navy", "background": "paper", "showDate": true
}
\`\`\`

### fields (all strings, max ${FIELD_MAX} characters, no line breaks)
${Object.entries(FIELDS).map(([k, v]) => `- \`${k}\`: ${v}`).join("\n")}

### education / employment / qualifications (each up to ${MAX_ROWS} rows)
- \`year\`: 4-digit Western year as a string ("2018"), or "" for none.
- \`month\`: month number as a string without padding ("4"), or "".
- \`text\`: up to ${ROW_TEXT_MAX} characters; a line break is allowed for a
  short description under the entry.
- Do **not** add 「学歴」「職歴」 heading rows or a closing 「以上」 row: the
  app inserts them automatically.

Conventions:
- education: usually from high school graduation on, e.g.
  「〇〇高等学校 卒業」「〇〇大学 〇〇学部 〇〇学科 入学」「… 卒業」.
- employment: 「株式会社〇〇 入社」, optionally with a second line describing the
  role, and 「一身上の都合により退社」 (or 「契約期間満了により退社」) when
  leaving. If still employed, end with a row \`{"year":"","month":"","text":"現在に至る"}\`.
- qualifications: official names with 「取得」 or 「合格」, oldest first.

### sections (up to ${MAX_SECTIONS} free-text boxes)
- \`id\`: short ASCII id (letters, digits, _ or -), unique.
- \`title\`: up to ${SECTION_TITLE_MAX} characters, e.g. 「志望動機・自己PR」「本人希望欄」「趣味・特技」.
- \`content\`: up to ${SECTION_CONTENT_MAX} characters; line breaks are kept.
- The default pair is 志望動機・自己PR and 本人希望欄. When the user has no
  particular wishes, 本人希望欄 is customarily 「貴社の規定に従います。」.

### design (optional)
- \`font\`: ${FONTS.join(", ")}
- \`theme\`: ${THEMES.join(", ")}
- \`background\`: ${BACKGROUNDS.join(", ")}
- \`showDate\`: whether to print 「〇年〇月〇日 現在」.

The ID photo cannot be set through this data; the user adds it on the site.

## Working with the user
- Keep the user's facts; do not invent schools, employers, dates or
  qualifications. Ask for anything required that is missing (name, birthday,
  address, history), or leave it empty.
- Call \`validate_rirekisho_data\` before handing the JSON over or generating
  a PDF, and fix what it reports.
- To edit further on the site, give the user the \`normalized\` JSON from the
  validator as a .json file and tell them to open ${SITE_URL}#rirekisho and
  use 「データを開く」. To get the PDF directly, call \`generate_rirekisho_pdf\`.

## Complete example

\`\`\`json
${JSON.stringify(sampleRirekisho(), null, 2)}
\`\`\`
`;

// Mirrors validate() in src/lib/rirekisho.ts, but reports what it changes
// instead of silently truncating, plus a few 履歴書 conventions.
export function validateRirekisho(value) {
  const errors = [];
  const warnings = [];
  const notes = [];
  const fail = (message) => {
    errors.push(message);
    return { ok: false, errors, warnings, notes };
  };

  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return fail("The data is not valid JSON.");
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fail("The data must be a JSON object.");
  if (!value.fields || typeof value.fields !== "object" || Array.isArray(value.fields))
    return fail("`fields` must be an object.");

  const normalized = {
    fields: {},
    education: [],
    employment: [],
    qualifications: [],
    sections: [],
    photo: "",
    position: 50,
    zoom: 100,
    photoX: 0,
    photoY: 0,
    font: "noto-sans-jp",
    theme: "navy",
    background: "paper",
    showDate: true,
  };

  for (const key of Object.keys(value.fields))
    if (!(key in FIELDS)) warnings.push(`fields.${key} is not a 履歴書 field and is ignored.`);
  for (const key of Object.keys(FIELDS)) {
    let text = value.fields[key];
    if (text === undefined || text === null) text = "";
    if (typeof text !== "string") {
      errors.push(`fields.${key} must be a string.`);
      continue;
    }
    if (/[\r\n]/.test(text)) {
      warnings.push(`fields.${key} contains a line break; it was replaced with a space.`);
      text = text.replace(/[\r\n]+/g, " ");
    }
    if (text.length > FIELD_MAX) {
      warnings.push(`fields.${key} is longer than ${FIELD_MAX} characters and was cut.`);
      text = text.slice(0, FIELD_MAX);
    }
    normalized.fields[key] = text;
  }
  const f = normalized.fields;
  if (!f.date) {
    f.date = today();
    notes.push(`fields.date was empty; set to today (${f.date}).`);
  }
  for (const key of ["date", "birthday"])
    if (f[key] && !DATE_PATTERN.test(f[key]))
      warnings.push(`fields.${key} must be YYYY-MM-DD; otherwise it is not shown${key === "birthday" ? " and the age is not calculated" : ""}.`);
  if (f.birthday && f.date && DATE_PATTERN.test(f.birthday) && f.birthday > f.date)
    warnings.push("fields.birthday is after fields.date.");
  if (!f.name) warnings.push("fields.name (氏名) is empty.");
  for (const key of ["kana", "addressKana"])
    if (f[key] && /[ァ-ヺ]/.test(f[key]))
      notes.push(`fields.${key} contains katakana; ふりがな is usually written in hiragana.`);
  if (f.postal.startsWith("〒")) {
    f.postal = f.postal.replace(/^〒\s*/, "");
    notes.push("Removed 〒 from fields.postal; the app adds it.");
  }

  for (const group of GROUPS) {
    const rows = value[group] ?? [];
    if (!Array.isArray(rows)) {
      errors.push(`${group} must be an array.`);
      continue;
    }
    if (rows.length > MAX_ROWS) {
      errors.push(`${group} has ${rows.length} rows; the maximum is ${MAX_ROWS}.`);
      continue;
    }
    rows.forEach((row, index) => {
      const at = `${group}[${index}]`;
      if (!row || typeof row !== "object") {
        errors.push(`${at} must be an object with year, month and text.`);
        return;
      }
      const year = row.year == null ? "" : String(row.year).trim();
      const month = row.month == null ? "" : String(row.month).trim();
      let text = typeof row.text === "string" ? row.text : row.text == null ? "" : null;
      if (text === null) {
        errors.push(`${at}.text must be a string.`);
        return;
      }
      if (AUTO_ROWS.has(text.trim()) && !year && !month) {
        notes.push(`Removed ${at} 「${text.trim()}」; the app adds this row automatically.`);
        return;
      }
      if (year && !/^\d{4}$/.test(year))
        warnings.push(`${at}.year should be a 4-digit Western year (got "${year}").`);
      if (month && !(/^\d{1,2}$/.test(month) && +month >= 1 && +month <= 12))
        warnings.push(`${at}.month should be 1–12 (got "${month}").`);
      if (text.length > ROW_TEXT_MAX) {
        warnings.push(`${at}.text is longer than ${ROW_TEXT_MAX} characters and was cut.`);
        text = text.slice(0, ROW_TEXT_MAX);
      }
      normalized[group].push({
        year: year.slice(0, 4),
        month: month.replace(/^0(?=\d)/, "").slice(0, 2),
        text,
      });
    });
  }
  if (!normalized.education.length && !normalized.employment.length)
    warnings.push("Both education and employment are empty.");
  const lastJob = normalized.employment.at(-1)?.text ?? "";
  if (normalized.employment.length && !/現在に至る|退社|退職|満了/.test(lastJob))
    notes.push("The last employment row is neither 「現在に至る」 nor a leaving entry; check whether the user is still employed.");

  const sections = value.sections ?? [];
  if (!Array.isArray(sections)) errors.push("sections must be an array.");
  else if (sections.length > MAX_SECTIONS)
    errors.push(`sections has ${sections.length} items; the maximum is ${MAX_SECTIONS}.`);
  else {
    const ids = new Set();
    sections.forEach((section, index) => {
      const at = `sections[${index}]`;
      if (!section || typeof section.title !== "string" || typeof section.content !== "string") {
        errors.push(`${at} needs string title and content.`);
        return;
      }
      let id = typeof section.id === "string" && /^[\w-]{1,80}$/.test(section.id) ? section.id : "";
      if (!id || ids.has(id)) {
        id = `section-${index + 1}`;
        while (ids.has(id)) id += "-x";
      }
      ids.add(id);
      let title = section.title.replace(/[\r\n]+/g, " ");
      let content = section.content;
      if (title.length > SECTION_TITLE_MAX) {
        warnings.push(`${at}.title is longer than ${SECTION_TITLE_MAX} characters and was cut.`);
        title = title.slice(0, SECTION_TITLE_MAX);
      }
      if (content.length > SECTION_CONTENT_MAX) {
        warnings.push(`${at}.content is longer than ${SECTION_CONTENT_MAX} characters and was cut.`);
        content = content.slice(0, SECTION_CONTENT_MAX);
      }
      normalized.sections.push({ id, title, content });
    });
  }

  for (const [key, allowed] of [["font", FONTS], ["theme", THEMES], ["background", BACKGROUNDS]]) {
    if (value[key] === undefined) continue;
    if (allowed.includes(value[key])) normalized[key] = value[key];
    else warnings.push(`${key} "${value[key]}" is not available; using ${normalized[key]}.`);
  }
  normalized.showDate = value.showDate !== false;
  if (value.photo) notes.push("photo is ignored; the user adds the ID photo on the site.");

  const placeholderCount = JSON.stringify(normalized).match(/〇〇|△△/g)?.length ?? 0;
  if (placeholderCount)
    notes.push(`${placeholderCount} placeholder(s) (〇〇 / △△) remain; ask the user to fill them in.`);

  return { ok: errors.length === 0, errors, warnings, notes, normalized };
}

const DATA_SCHEMA = {
  type: "object",
  description:
    "The 履歴書 data object (see get_rirekisho_format_guide). A JSON string of the same object is also accepted.",
  properties: {
    fields: {
      type: "object",
      properties: Object.fromEntries(
        Object.entries(FIELDS).map(([k, v]) => [k, { type: "string", description: v }]),
      ),
    },
    ...Object.fromEntries(
      GROUPS.map((g) => [
        g,
        {
          type: "array",
          items: {
            type: "object",
            properties: {
              year: { type: "string" },
              month: { type: "string" },
              text: { type: "string" },
            },
          },
        },
      ]),
    ),
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          content: { type: "string" },
        },
      },
    },
    font: { type: "string", enum: FONTS },
    theme: { type: "string", enum: THEMES },
    background: { type: "string", enum: BACKGROUNDS },
    showDate: { type: "boolean" },
  },
  required: ["fields"],
};

function checkResultText(result) {
  return JSON.stringify(result, null, 2);
}

export const RIREKISHO_TOOLS = [
  {
    name: "get_rirekisho_format_guide",
    title: "Get 履歴書 data format guide",
    description:
      "Returns the JSON data format for the Japanese-style 履歴書 (rirekisho) in Markdown Resume Studio: personal fields, 学歴・職歴 and 免許・資格 rows, free-text sections, design options, Japanese conventions, and a complete example. Read this before filling in a 履歴書.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: () => ({ content: [{ type: "text", text: guideText() }] }),
  },
  {
    name: "validate_rirekisho_data",
    title: "Validate 履歴書 data",
    description:
      "Checks 履歴書 JSON data against the app's limits and 履歴書 conventions, and returns errors, warnings, notes and the `normalized` data. The normalized JSON can be saved as a .json file and opened in the site's 履歴書 tab (「データを開く」). The data is checked in memory and not stored.",
    inputSchema: {
      type: "object",
      properties: { data: DATA_SCHEMA },
      required: ["data"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: (args) => {
      const result = validateRirekisho(args.data);
      return {
        content: [{ type: "text", text: checkResultText(result) }],
        structuredContent: result,
      };
    },
  },
  {
    name: "generate_rirekisho_pdf",
    title: "Generate 履歴書 PDF",
    description:
      "Renders 履歴書 JSON data into an A4 PDF with the site's 履歴書 layout (same result as its \"Save as PDF\") and returns a download link that expires after 1 hour. Validate the data first. No ID photo is included; for a photo, the user should open the data on the site instead. The data is sent to the server for rendering and the PDF is kept only until the link expires.",
    inputSchema: {
      type: "object",
      properties: {
        data: DATA_SCHEMA,
        theme: { type: "string", enum: THEMES, description: "Overrides data.theme." },
        font: { type: "string", enum: FONTS, description: "Overrides data.font." },
        background: { type: "string", enum: BACKGROUNDS, description: "Overrides data.background." },
        show_date: { type: "boolean", description: "Overrides data.showDate." },
      },
      required: ["data"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    run: async (args, context) => {
      const check = validateRirekisho(args.data);
      if (!check.ok)
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "The data has errors; fix them and try again.\n" + JSON.stringify(check.errors, null, 2),
            },
          ],
        };
      const limited = await pdfRateLimit(context);
      if (limited) return limited;

      const draft = check.normalized;
      draft.theme = pickOption(args.theme, THEMES, draft.theme);
      draft.font = pickOption(args.font, FONTS, draft.font);
      draft.background = pickOption(args.background, BACKGROUNDS, draft.background);
      if (typeof args.show_date === "boolean") draft.showDate = args.show_date;

      const name = draft.fields.name.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, "");
      const result = await generatePdf(
        context.env,
        context.origin,
        PAGE_JOBS.rirekisho(draft),
        name ? `履歴書_${name}` : "履歴書",
      );
      return pdfToolResult(result, {
        options: { theme: draft.theme, font: draft.font, background: draft.background, showDate: draft.showDate },
        warnings: check.warnings,
      });
    },
  },
];
