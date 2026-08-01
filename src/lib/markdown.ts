import MarkdownIt from 'markdown-it';

// html:false disables raw HTML passthrough so user-pasted markdown can never
// inject a script tag into their own preview pane.
export const md = new MarkdownIt({
  html: false,
  linkify: true,
  // Resume authors generally expect a single newline (date / name / contact)
  // to remain a visual line break in the exported document.
  breaks: true,
  typographer: true,
});

const SPACER_PATTERN = /^<!--\s*spacer\s*-->$/i;

// Support a small, safe layout extension without enabling raw HTML in user
// content. The marker must occupy a line by itself and is rendered as a
// controlled spacer element instead of visible Markdown text.
md.block.ruler.before(
  "paragraph",
  "resume_spacer",
  (state: any, startLine: number, _endLine: number, silent: boolean) => {
    const lineStart = state.bMarks[startLine] + state.tShift[startLine];
    const lineEnd = state.eMarks[startLine];
    const line = state.src.slice(lineStart, lineEnd).trim();
    const match = SPACER_PATTERN.exec(line);

    if (!match) return false;
    if (silent) return true;

    const token = state.push("resume_spacer", "div", 0);
    token.block = true;
    token.meta = { size: 1 };
    state.line = startLine + 1;
    return true;
  },
);

md.renderer.rules.resume_spacer = (tokens, index) => {
  const size = tokens[index].meta?.size ?? 1;
  return `<div class="resume-spacer" style="--resume-spacer-size:${size}"></div>\n`;
};

// CommonMark's delimiter rules can leave strong markers untouched when a
// Japanese word immediately follows the closing `**`. Keep the familiar
// Markdown syntax working for Japanese resume prose without changing how
// regular emphasis or code spans are parsed.
md.inline.ruler.before(
  "emphasis",
  "japanese_strong",
  (state: any, silent: boolean) => {
    const start = state.pos;
    if (
      state.src.charCodeAt(start) !== 0x2a ||
      state.src.charCodeAt(start + 1) !== 0x2a
    )
      return false;

    const end = state.src.indexOf("**", start + 2);
    if (end < 0 || end === start + 2) return false;

    const content = state.src.slice(start + 2, end);
    if (!/[\u3040-\u30ff\u3400-\u9fff\uff00-\uffef]/.test(content))
      return false;
    if (silent) return true;

    const previousPosition = state.pos;
    const previousMax = state.posMax;
    const open = state.push("strong_open", "strong", 1);
    open.markup = "**";

    state.pos = start + 2;
    state.posMax = end;
    state.md.inline.tokenize(state);

    state.pos = previousPosition;
    state.posMax = previousMax;
    const close = state.push("strong_close", "strong", -1);
    close.markup = "**";
    state.pos = end + 2;
    return true;
  },
);

export function renderMarkdown(source: string): string {
  // A spacer is allowed directly between two Markdown lines. Add paragraph
  // boundaries before parsing so the block rule can recognize it even when
  // the author does not add an extra blank line around the marker.
  const normalizedSource = source.replace(
    /^([ \t]*)<!--\s*spacer\s*-->[ \t]*\r?$/gm,
    "\n$&\n",
  );
  return md.render(normalizedSource);
}
