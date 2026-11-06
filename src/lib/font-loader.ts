import { resolveResumeFont } from "./fonts";

// Keep the other families out of the initial render-blocking stylesheet.
const fontStyles = {
  "noto-sans-jp": () => Promise.all([import("@fontsource/noto-sans-jp/400.css?inline"), import("@fontsource/noto-sans-jp/700.css?inline")]),
  "noto-serif-jp": () => Promise.all([import("@fontsource/noto-serif-jp/400.css?inline"), import("@fontsource/noto-serif-jp/700.css?inline")]),
  "biz-udpgothic": () => Promise.all([import("@fontsource/biz-udpgothic/400.css?inline"), import("@fontsource/biz-udpgothic/700.css?inline")]),
  "biz-udpmincho": () => Promise.all([import("@fontsource/biz-udpmincho/400.css?inline"), import("@fontsource/biz-udpmincho/700.css?inline")]),
  "zen-kaku-gothic-new": () => Promise.all([import("@fontsource/zen-kaku-gothic-new/400.css?inline"), import("@fontsource/zen-kaku-gothic-new/700.css?inline")]),
  "zen-maru-gothic": () => Promise.all([import("@fontsource/zen-maru-gothic/400.css?inline"), import("@fontsource/zen-maru-gothic/700.css?inline")]),
  "klee-one": () => Promise.all([import("@fontsource/klee-one/400.css?inline"), import("@fontsource/klee-one/600.css?inline")]),
};

const loadedStyles = new Map<string, Promise<void>>();

function loadStyles(id: keyof typeof fontStyles): Promise<void> {
  const existing = loadedStyles.get(id);
  if (existing) return existing;
  const pending = fontStyles[id]().then(modules => {
    const style = document.createElement("style");
    style.dataset.resumeFont = id;
    style.textContent = modules.map(module => module.default).join("\n");
    document.head.append(style);
  }).catch(error => { loadedStyles.delete(id); throw error; });
  loadedStyles.set(id, pending);
  return pending;
}

export async function loadResumeFont(id: string) {
  const font = resolveResumeFont(id);
  const fallback = font.kind === "serif" ? "noto-serif-jp" : "noto-sans-jp";
  await Promise.all([loadStyles(font.id), ...(font.id === fallback ? [] : [loadStyles(fallback)])]);
}
