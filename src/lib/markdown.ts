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

export function renderMarkdown(source: string): string {
  return md.render(source);
}
