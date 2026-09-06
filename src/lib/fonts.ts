// All bundled families are OFL-1.1. See /font-licenses.txt for notices.
export const resumeFonts = [
  { id: "noto-sans-jp", family: "Noto Sans JP", kind: "sans-serif" },
  { id: "noto-serif-jp", family: "Noto Serif JP", kind: "serif" },
  { id: "biz-udpgothic", family: "BIZ UDPGothic", kind: "sans-serif" },
  { id: "biz-udpmincho", family: "BIZ UDPMincho", kind: "serif" },
  { id: "zen-kaku-gothic-new", family: "Zen Kaku Gothic New", kind: "sans-serif" },
  { id: "zen-maru-gothic", family: "Zen Maru Gothic", kind: "sans-serif" },
  { id: "klee-one", family: "Klee One", kind: "serif" },
] as const;

export function resolveResumeFont(id: string) {
  return resumeFonts.find((font) => font.id === id) ?? resumeFonts[0];
}

export function resumeFontStack(id: string) {
  const font = resolveResumeFont(id);
  // Fill missing Japanese glyphs using bundled, openly licensed fonts.
  const fallback = font.kind === "serif"
    ? '"Noto Serif JP", serif'
    : '"Noto Sans JP", sans-serif';
  return `"${font.family}", ${fallback}`;
}
