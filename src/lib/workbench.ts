import { getInitialLocale, isLocale, LOCALE_KEY, messages, type Locale } from "./i18n";
import { strings } from "./rirekisho-i18n";

type Mode = "career" | "personal";
type Editor = { activate(): void; deactivate(): void; setLocale(locale: Locale): void };
const panels = {
  career: document.getElementById("career-workspace")!,
  personal: document.getElementById("personal-workspace")!,
};
const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-document]"));
const editors: Partial<Record<Mode, Editor>> = {};
let locale: Locale = "ja";
try { locale = getInitialLocale(); } catch { /* The editor also works without persisted language. */ }
let active: Mode | null = null;
let generation = 0;

function setLocale(next: Locale) {
  locale = next;
  try { localStorage.setItem(LOCALE_KEY, next); } catch { /* Keep this session's selection. */ }
  document.documentElement.lang = next === "zh" ? "zh-CN" : next;
  document.documentElement.dataset.locale = next;
  const shared = messages[next] as Record<string, string>;
  const personal = strings[next] as Record<string, string>;
  for (const element of document.querySelectorAll<HTMLElement>("[data-i18n]")) {
    const value = shared[element.dataset.i18n!];
    if (value !== undefined) element.textContent = value;
  }
  for (const element of document.querySelectorAll<HTMLElement>("[data-r]")) {
    const value = personal[element.dataset.r!];
    if (value !== undefined) element.textContent = value;
  }
  for (const [attribute, key] of [["aria-label", "i18nAriaLabel"], ["title", "i18nTitle"], ["alt", "i18nAlt"]]) {
    const selector = key.replace(/[A-Z]/g, letter => "-" + letter.toLowerCase());
    for (const element of document.querySelectorAll<HTMLElement>(`[data-${selector}]`)) {
      const value = shared[element.dataset[key]!];
      if (value !== undefined) element.setAttribute(attribute, value);
    }
  }
  document.querySelectorAll<HTMLButtonElement>("[data-locale-option]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.localeOption === next)));
  for (const editor of Object.values(editors)) editor.setLocale(next);
  document.title = shared.documentTitle;
}

async function activate(mode: Mode, updateUrl = true) {
  if (active === mode && editors[mode]) return;
  const token = ++generation;
  if (active) editors[active]?.deactivate();
  active = mode;
  for (const key of ["career", "personal"] as const) panels[key].hidden = key !== mode;
  document.getElementById("resume-studio")!.classList.toggle("rirekisho-app", mode === "personal");
  tabs.forEach(button => {
    const selected = button.dataset.document === mode;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  if (updateUrl) history.pushState(null, "", mode === "personal" ? "#rirekisho" : location.pathname + location.search);
  panels[mode].setAttribute("aria-busy", "true");
  try {
    if (!editors[mode]) {
      const initialize = mode === "career"
        ? (await import("./career-editor")).initCareerEditor
        : (await import("./rirekisho")).initRirekishoEditor;
      if (token !== generation) return;
      editors[mode] = initialize();
    }
    if (token !== generation) return;
    editors[mode]!.activate();
  } finally {
    panels[mode].removeAttribute("aria-busy");
  }
}

tabs.forEach(button => {
  button.addEventListener("click", () => { void activate(button.dataset.document as Mode); });
  button.addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (tabs.indexOf(button) + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    tabs[index].focus(); tabs[index].click();
  });
});
document.querySelectorAll<HTMLButtonElement>("[data-locale-option]").forEach(button => button.addEventListener("click", () => {
  const next = button.dataset.localeOption;
  if (isLocale(next)) setLocale(next);
}));
document.addEventListener("keydown", event => {
  if (!active || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "p") return;
  event.preventDefault();
  document.getElementById(active === "personal" ? "r-print" : "save-pdf")?.click();
});
window.addEventListener("hashchange", () => { void activate(location.hash === "#rirekisho" ? "personal" : "career", false); });
window.addEventListener("pagehide", () => { if (active) editors[active]?.deactivate(); });
setLocale(locale);
void activate(location.hash === "#rirekisho" ? "personal" : "career", false);
