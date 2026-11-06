import { strings } from "./rirekisho-i18n";
import { getInitialLocale, translate, type MessageKey, type Locale } from "./i18n";
import { resolveResumeFont, resumeFontStack } from "./fonts";
import { loadResumeFont } from "./font-loader";
import { initIdPhotoEditor } from "./id-photo-editor";
import { printDocument } from "./print-document";

const themes = { navy: "#344f66", graphite: "#343b42", slate: "#345d6a", forest: "#2f5d50", burgundy: "#7a3f4a", amber: "#8a6545" };
const backgrounds = { paper: "#ffffff", mist: "#f3f6f8", linen: "#faf7f0" };

type Entry = { year: string; month: string; text: string; heading?: boolean };
type FreeSection = { id: string; title: string; content: string };
type Group = "education" | "employment" | "qualifications";
type Draft = {
  fields: Record<string, string>;
  education: Entry[]; employment: Entry[]; qualifications: Entry[];
  sections: FreeSection[];
  photo: string; position: number; zoom: number; photoX: number; photoY: number; font: string; theme: keyof typeof themes; background: keyof typeof backgrounds;
};
export function initRirekishoEditor() {
  const root = document.getElementById("personal-workspace")!;
  let needsRender = false;
  const KEY = "rirekisho-draft-v1";
  const groups: Group[] = ["education", "employment", "qualifications"];
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const form = $<HTMLFormElement>("r-form");
  const pages = $("r-pages");

  let locale: Locale = "ja";
  try { locale = getInitialLocale(); } catch { /* Storage may be unavailable. */ }
  const t = (key: keyof typeof strings.ja) => strings[locale][key];
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const defaultSections = (): FreeSection[] => [
    { id: "motivation", title: "志望動機・自己PR", content: "" },
    { id: "wishes", title: "本人希望欄", content: "" },
  ];
  const blank = (): Draft => ({ fields: { date: today() }, education: [{ year: "", month: "", text: "" }], employment: [{ year: "", month: "", text: "" }], qualifications: [{ year: "", month: "", text: "" }], sections: defaultSections(), photo: "", position: 50, zoom: 100, photoX: 0, photoY: 0, font: "noto-sans-jp", theme: "navy", background: "paper" });
  function validate(value: unknown): Draft {
    if (!value || typeof value !== "object") throw new Error("Invalid draft");
    const v = value as Draft;
    if (!v.fields || typeof v.fields !== "object" || !groups.every(g => Array.isArray(v[g]) && v[g].length <= 50)) throw new Error("Invalid draft");
    const result = blank();
    for (const field of form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[name]")) {
      const text = v.fields[field.name];
      if (text !== undefined && typeof text !== "string") throw new Error("Invalid field");
      result.fields[field.name] = (field instanceof HTMLInputElement ? (text ?? "").replace(/[\r\n]/g, " ") : text ?? "").slice(0, field.maxLength > 0 ? field.maxLength : 160);
    }
    for (const group of groups) result[group] = v[group].map(row => {
      if (!row || ![row.year, row.month, row.text].every(x => typeof x === "string")) throw new Error("Invalid row");
      return { year: row.year.slice(0, 4), month: row.month.slice(0, 2), text: row.text.slice(0, 180) };
    });
    if (v.sections === undefined) {
      // Preserve text from drafts and backups created before custom sections.
      for (const section of result.sections) {
        const legacy = v.fields[section.id];
        if (legacy !== undefined && typeof legacy !== "string") throw new Error("Invalid section");
        section.content = (legacy ?? "").slice(0, 1000);
      }
    } else {
      if (!Array.isArray(v.sections) || v.sections.length > 20) throw new Error("Invalid sections");
      const ids = new Set<string>();
      result.sections = v.sections.map(section => {
        if (!section || typeof section.title !== "string" || typeof section.content !== "string") throw new Error("Invalid section");
        const id = typeof section.id === "string" && /^[\w-]{1,80}$/.test(section.id) && !ids.has(section.id) ? section.id : crypto.randomUUID();
        ids.add(id);
        return { id, title: section.title.replace(/[\r\n]/g, " ").slice(0, 80), content: section.content.slice(0, 1000) };
      });
    }
    result.photo = typeof v.photo === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v.photo) && v.photo.length < 3000000 ? v.photo : "";
    result.position = Number.isFinite(v.position) ? Math.max(0, Math.min(100, v.position)) : 50;
    result.zoom = Number.isFinite(v.zoom) ? Math.max(100, Math.min(240, v.zoom)) : 100;
    result.photoX = Number.isFinite(v.photoX) ? Math.max(-100, Math.min(100, v.photoX)) : 0;
    result.photoY = Number.isFinite(v.photoY) ? Math.max(-100, Math.min(100, v.photoY)) : 0;
    result.font = resolveResumeFont(v.font === "serif" ? "noto-serif-jp" : v.font).id;
    result.theme = (v.theme as string) === "black" ? "graphite" : Object.hasOwn(themes, v.theme) ? v.theme : "navy";
    result.background = Object.hasOwn(backgrounds, v.background) ? v.background : "paper";
    return result;
  }
  let draft = blank();
  try { const stored = localStorage.getItem(KEY); if (stored) draft = validate(JSON.parse(stored)); } catch { /* A damaged draft must not block the editor. */ }
  const status = (message: string) => { $("r-status").textContent = message; };
  function save() { try { localStorage.setItem(KEY, JSON.stringify(draft)); status(t("saved")); } catch { status(t("saveError")); } }
  function node<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = "") { const el = document.createElement(tag); el.className = className; el.textContent = text; return el; }
  function renderRows(group: Group) {
    const list = $(`r-${group}`); list.replaceChildren();
    draft[group].forEach((row, index) => {
      const wrapper = node("div", "r-entry");
      (["year", "month", "text"] as const).forEach(key => {
        const label = node("label", "r-field"); label.append(node("span", "", t(key === "text" ? "entry" : key)));
        const input = key === "text" ? node("textarea") : node("input");
        if (input instanceof HTMLInputElement) input.type = "text";
        else input.rows = 2;
        input.value = row[key]; input.maxLength = key === "text" ? 180 : key === "year" ? 4 : 2;
        input.setAttribute("aria-label", `${t(group)} ${index + 1} ${t(key === "text" ? "entry" : key)}`);
        if (key !== "text") input.inputMode = "numeric";
        input.addEventListener("input", () => { row[key] = input.value; update(); }); label.append(input); wrapper.append(label);
      });
      const remove = node("button", "studio-button r-row-remove");
      remove.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M6 6l12 12M6 18L18 6"/></svg>';
      remove.type = "button"; remove.setAttribute("aria-label", `${t(group)} ${index + 1}: ${t("remove")}`); remove.title = t("remove");
      remove.addEventListener("click", () => { draft[group].splice(index, 1); renderRows(group); update(); ($(`r-${group}`).querySelector("input") ?? document.querySelector<HTMLButtonElement>(`[data-add="${group}"]`))?.focus(); });
      wrapper.append(remove); list.append(wrapper);
    });
  }
  function renderSections() {
    const list = $("r-sections"); list.replaceChildren();
    draft.sections.forEach((section, index) => {
      const wrapper = node("section", "r-section-editor"); wrapper.dataset.sectionId = section.id;
      const toolbar = node("div", "r-section-toolbar");
      const controls = node("div", "action-group");
      for (const [key, offset] of [["moveUp", -1], ["moveDown", 1], ["removeSection", 0]] as const) {
        const button = node("button", "studio-button", t(key)); button.type = "button"; button.dataset.sectionAction = key;
        button.disabled = offset === -1 ? index === 0 : offset === 1 ? index === draft.sections.length - 1 : false;
        button.setAttribute("aria-label", `${t(key)}: ${section.title || index + 1}`);
        button.addEventListener("click", () => {
          if (offset) [draft.sections[index], draft.sections[index + offset]] = [draft.sections[index + offset], draft.sections[index]];
          else draft.sections.splice(index, 1);
          renderSections(); update();
          const next = $("r-sections").children[Math.min(index + offset, draft.sections.length - 1)];
          (next?.querySelector<HTMLInputElement>("[data-section-title]") ?? $("r-add-section")).focus();
        });
        controls.append(button);
      }
      toolbar.append(controls);
      const titleLabel = node("label", "r-field"); titleLabel.append(node("span", "", t("sectionTitle")));
      const title = node("input"); title.type = "text"; title.maxLength = 80; title.value = section.title; title.dataset.sectionTitle = "";
      title.addEventListener("input", () => { section.title = title.value; update(); }); titleLabel.append(title);
      const contentLabel = node("label", "r-field"); contentLabel.append(node("span", "", t("sectionContent")));
      const content = node("textarea"); content.rows = 5; content.maxLength = 1000; content.value = section.content; content.dataset.sectionContent = "";
      content.addEventListener("input", () => { section.content = content.value; update(); }); contentLabel.append(content);
      wrapper.append(toolbar, titleLabel, contentLabel); list.append(wrapper);
    });
  }
  function fill(renderPreview = true) {
    for (const field of form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[name]")) field.value = draft.fields[field.name] ?? "";
    for (const group of groups) renderRows(group);
    renderSections();
    $<HTMLSelectElement>("r-font").value = draft.font;
    $<HTMLInputElement>("r-photo").value = "";
    if (renderPreview) render();
  }
  function setLocale(next: Locale) {
    locale = next;
    root.querySelectorAll<HTMLElement>("[data-r]").forEach(el => { const key = el.dataset.r as keyof typeof strings.ja; if (key in strings[locale]) el.textContent = t(key); });
    root.querySelectorAll<HTMLElement>("[data-i18n]").forEach(el => { el.textContent = translate(locale, el.dataset.i18n as MessageKey); });
    root.querySelectorAll<HTMLElement>("[data-i18n-aria-label]").forEach(el => { el.setAttribute("aria-label", translate(locale, el.dataset.i18nAriaLabel as MessageKey)); });
    for (const group of groups) renderRows(group);
    renderSections();
    render();
  }
  const jpDate = (value: string) => { const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value); return parts ? `${Number(parts[1])}年${Number(parts[2])}月${Number(parts[3])}日` : ""; };
  function cell(label: string, value: string, className = "") { const box = node("div", `r-cell ${className}`); if (label) box.append(node("span", "r-cell-label", label)); box.append(node("div", "r-cell-value", value)); return box; }
  function identity() {
    const f = draft.fields; const block = node("section", "r-identity");
    const main = node("div", "r-personal");
    main.append(cell("ふりがな", f.kana, "r-kana"), cell("氏名", f.name, "r-name"));
    const birth = node("div", "r-birth");
    let age = "";
    if (jpDate(f.birthday) && jpDate(f.date) && f.birthday <= f.date) {
      const [by, bm, bd] = f.birthday.split("-").map(Number); const [y, m, d] = f.date.split("-").map(Number);
      age = `（満${y - by - Number(m < bm || (m === bm && d < bd))}歳）`;
    }
    birth.append(cell("生年月日", `${jpDate(f.birthday)}${age}`));
    if (f.gender) birth.append(cell("性別（任意）", f.gender));
    main.append(birth); block.append(main);
    const photo = node("div", "r-id-photo");
    if (draft.photo) { const img = node("img"); img.src = draft.photo; img.alt = "証明写真"; img.style.objectPosition = `50% ${draft.position}%`; img.style.transform = `translate(${draft.photoX}%, ${draft.photoY}%) scale(${draft.zoom / 100})`; photo.append(img); }
    else photo.append(node("span", "", "写真欄\n縦40mm × 横30mm\n（任意）"));
    block.append(photo);
    const address = node("div", "r-address");
    address.append(cell("ふりがな", f.addressKana, "r-kana"), cell("現住所", `${f.postal ? `〒${f.postal}\n` : ""}${f.address ?? ""}`));
    const contacts = node("div", "r-birth"); contacts.append(cell("電話", f.phone), cell("E-mail", f.email)); address.append(contacts);
    address.append(cell("連絡先（現住所と異なる場合）", f.contact)); block.append(address); return block;
  }
  function render() {
    if (root.hidden) { needsRender = true; return; }
    needsRender = false;
    pages.replaceChildren(); pages.dataset.font = draft.font; pages.dataset.theme = draft.theme;
    pages.dataset.background = draft.background;
    pages.style.setProperty("--r-line", themes[draft.theme]);
    pages.style.setProperty("--r-paper", backgrounds[draft.background]);
    pages.style.setProperty("--r-font", resumeFontStack(draft.font));
    root.querySelectorAll<HTMLButtonElement>("[data-theme-option]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.themeOption === draft.theme)));
    root.querySelectorAll<HTMLButtonElement>("[data-background-option]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.backgroundOption === draft.background)));
    $("r-photo-status").textContent = translate(locale, draft.photo ? "avatarSet" : "avatarUnset");
    $<HTMLButtonElement>("r-remove-photo").disabled = !draft.photo;
    $<HTMLButtonElement>("r-edit-photo").disabled = !draft.photo;
    let page: HTMLElement;
    let count = 0;
    const newPage = () => {
      page = node("article", "r-sheet");
      if (count === 0) {
        const heading = node("header", "r-sheet-heading");
        heading.append(node("h2", "", "履 歴 書"), node("span", "", jpDate(draft.fields.date) ? `${jpDate(draft.fields.date)} 現在` : ""));
        page.append(heading);
      }
      const frame = node("div", "r-sheet-frame"); frame.append(page);
      pages.append(frame); count++;
      page.append(node("footer", "r-sheet-footer", String(count)));
      page.setAttribute("aria-label", `履歴書 ${count}ページ`);
    };
    const overflows = () => {
      const bottom = page.clientHeight - parseFloat(getComputedStyle(page).paddingBottom);
      return [...page.children].some(child => child.tagName !== "FOOTER" && (child as HTMLElement).offsetTop + (child as HTMLElement).offsetHeight > bottom + 1);
    };
    const append = (block: HTMLElement) => {
      page.append(block);
      if (!overflows()) return;
      block.remove();
      if ([...page.children].some(child => child.tagName !== "HEADER" && child.tagName !== "FOOTER")) newPage();
      page.append(block);
      if (!block.classList.contains("r-text-box")) return;
      const label = block.querySelector<HTMLElement>(".r-cell-label")?.textContent ?? "";
      let value = block.querySelector<HTMLElement>(".r-cell-value")!;
      let remaining = value.textContent!;
      // Measure real line wrapping and explicit newlines, retaining every character.
      while (overflows()) {
        let low = 0, high = remaining.length;
        while (low < high) {
          const middle = Math.ceil((low + high) / 2);
          value.textContent = remaining.slice(0, middle);
          if (overflows()) high = middle - 1; else low = middle;
        }
        const cut = Math.max(1, low);
        value.textContent = remaining.slice(0, cut);
        remaining = remaining.slice(cut);
        const id = block.dataset.sectionId;
        newPage(); block = cell(label ? `${label}（続き）` : "", remaining, block.className);
        if (id) block.dataset.sectionId = id;
        page.append(block); value = block.querySelector<HTMLElement>(".r-cell-value")!;
      }
    };
    newPage();
    const personal = identity();
    const address = personal.querySelector<HTMLElement>(".r-address")!;
    address.remove(); append(personal); append(address);
    function history(title: string, rows: Entry[], minimum: number) {
      const table = () => { const el = node("table", "r-history"); const head = el.createTHead().insertRow(); ["年", "月", title].forEach(text => { const th = node("th", "", text); th.scope = "col"; head.append(th); }); el.createTBody(); return el; };
      let current = table(); append(current);
      const actual = [...rows]; while (actual.length < minimum) actual.push({ year: "", month: "", text: "" });
      for (const entry of actual) {
        const tr = node("tr"); [entry.year, entry.month, entry.text].forEach(text => tr.append(node("td", "", text)));
        if (entry.heading) tr.className = "r-history-group";
        current.tBodies[0].append(tr);
        if (overflows()) {
          tr.remove();
          const previous = current.tBodies[0].lastElementChild;
          // Keep a group heading with its first entry, and the closing marker
          // with the final entry, rather than leaving either alone on a page.
          const carry = previous && (previous.classList.contains("r-history-group") || entry.text === "以上") ? previous : null;
          carry?.remove();
          if (!current.tBodies[0].rows.length) current.remove();
          newPage(); current = table(); page.append(current);
          if (carry) current.tBodies[0].append(carry);
          current.tBodies[0].append(tr);
          let activeRow = tr, remaining = entry.text;
          while (overflows()) {
            const value = activeRow.lastElementChild!;
            let low = 0, high = remaining.length;
            while (low < high) {
              const middle = Math.ceil((low + high) / 2); value.textContent = remaining.slice(0, middle);
              if (overflows()) high = middle - 1; else low = middle;
            }
            const cut = Math.max(1, low); value.textContent = remaining.slice(0, cut); remaining = remaining.slice(cut);
            newPage(); current = table(); page.append(current);
            activeRow = node("tr"); [entry.year, entry.month, remaining].forEach(text => activeRow.append(node("td", "", text)));
            current.tBodies[0].append(activeRow);
          }
        }
      }
    }
    const historyRows: Entry[] = [];
    for (const group of ["education", "employment"] as const) {
      const entries = draft[group];
      if (!entries.some(row => row.text.trim() || row.year.trim() || row.month.trim())) continue;
      historyRows.push({ year: "", month: "", text: group === "education" ? "学歴" : "職歴", heading: true });
      historyRows.push(...entries);
    }
    if (draft.employment.some(row => row.text.trim() || row.year.trim() || row.month.trim())) historyRows.push({ year: "", month: "", text: "以上" });
    const hasEmployment = draft.employment.some(row => row.text.trim() || row.year.trim() || row.month.trim());
    history(hasEmployment ? "学歴・職歴（各別にまとめて書く）" : "学歴", historyRows, 10);
    const qualifications = draft.qualifications.some(row => row.text.trim() || row.year.trim() || row.month.trim()) ? draft.qualifications : [];
    const visibleSections = draft.sections;
    if (qualifications.length || visibleSections.length) newPage();
    if (qualifications.length) history("免許・資格", qualifications, 6);
    for (const section of visibleSections) {
      const block = cell(section.title.trim(), section.content, "r-text-box");
      block.dataset.sectionId = section.id; append(block);
    }
    $("r-page-count").textContent = `A4 / ${count} ${t("count")}`;
    resize();
  }
  function resize() { if (root.hidden) return; for (const sheet of pages.querySelectorAll<HTMLElement>(".r-sheet")) { const scale = Math.min(1, pages.clientWidth / sheet.offsetWidth); sheet.style.transform = `scale(${scale})`; const frame = sheet.parentElement!; frame.style.width = `${sheet.offsetWidth * scale}px`; frame.style.height = `${sheet.offsetHeight * scale}px`; } }
  function update() { render(); save(); }
  form.addEventListener("submit", event => event.preventDefault());
  form.addEventListener("input", event => { const input = event.target as HTMLInputElement; if (input.name) { draft.fields[input.name] = input.value; update(); } });
  $("r-add-section").addEventListener("click", () => {
    if (draft.sections.length >= 20) { status(t("sectionLimit")); return; }
    draft.sections.push({ id: crypto.randomUUID(), title: "自己PR", content: "" });
    renderSections(); update();
    $("r-sections").lastElementChild?.querySelector<HTMLInputElement>("[data-section-title]")?.focus();
  });
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-add]")) button.addEventListener("click", () => {
    const group = button.dataset.add as Group;
    if (draft[group].length >= 50) { status(t("limit")); return; }
    draft[group].push({ year: "", month: "", text: "" }); renderRows(group); update(); $(`r-${group}`).querySelector<HTMLInputElement>(".r-entry:last-child input")?.focus();
  });
  let fontRevision = 0;
  async function loadFont() {
    const revision = ++fontRevision;
    const button = $<HTMLButtonElement>("r-print");
    button.disabled = true; $("r-font-status").textContent = translate(locale, "fontLoading");
    try {
      const family = resolveResumeFont(draft.font).family;
      await loadResumeFont(draft.font);
      if (revision !== fontRevision) return;
      await Promise.all([document.fonts.load(`400 16px "${family}"`, "履歴書"), document.fonts.load(`700 16px "${family}"`, "履歴書")]);
      await document.fonts.ready;
      if (revision !== fontRevision) return;
      render(); $("r-font-status").textContent = ""; button.disabled = false;
    } catch { if (revision === fontRevision) $("r-font-status").textContent = translate(locale, "fontError"); }
  }
  $("r-font").addEventListener("change", event => { draft.font = (event.target as HTMLSelectElement).value; update(); void loadFont(); });
  root.querySelectorAll<HTMLButtonElement>("[data-theme-option]").forEach(button => button.addEventListener("click", () => { draft.theme = button.dataset.themeOption as Draft["theme"]; update(); }));
  root.querySelectorAll<HTMLButtonElement>("[data-background-option]").forEach(button => button.addEventListener("click", () => { draft.background = button.dataset.backgroundOption as Draft["background"]; update(); }));
  const photoEditor = initIdPhotoEditor(photo => {
    draft.photo = photo.src; draft.position = photo.position; draft.zoom = photo.zoom;
    draft.photoX = photo.x; draft.photoY = photo.y;
    update();
  }, () => status(t("photoError")));
  $("r-edit-photo").addEventListener("click", () => {
    if (draft.photo) photoEditor.open({ src: draft.photo, position: draft.position, zoom: draft.zoom, x: draft.photoX, y: draft.photoY });
  });
  let photoRevision = 0;
  $("r-photo").addEventListener("change", async event => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0]; input.value = ""; if (!file) return;
    const revision = ++photoRevision;
    try {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 20 * 1024 * 1024) throw new Error("Invalid image");
      const bitmap = await createImageBitmap(file); const canvas = document.createElement("canvas");
      const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height)); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
      if (revision !== photoRevision) return;
      photoEditor.open({ src: canvas.toDataURL("image/jpeg", 0.9), position: 50, zoom: 100, x: 0, y: 0 });
    } catch { status(t("photoError")); }
  });
  $("r-remove-photo").addEventListener("click", () => { photoRevision++; draft.photo = ""; fill(); save(); });
  const replace = (next: Draft) => { photoRevision++; draft = next; fill(); save(); void loadFont(); };
  $("r-clear").addEventListener("click", () => { if (confirm(t("replace"))) replace(blank()); });
  $("r-sample").addEventListener("click", () => {
    if (!confirm(t("replace"))) return;
    const sample = blank(); sample.fields = { date: today(), name: "山田 太郎", kana: "やまだ たろう", birthday: "1995-04-15", gender: "", postal: "100-0001", addressKana: "とうきょうと ちよだく ちよだ", address: "東京都千代田区千代田1-1 サンプルマンション101", phone: "090-0000-0000", email: "taro.yamada@example.com", contact: "", motivation: "これまでWebアプリケーションの開発に携わり、使いやすさと品質を大切に取り組んできました。\n貴社のサービスを通じて、より多くの方の課題解決に貢献したいと考え、志望いたしました。", wishes: "貴社の規定に従います。" };
    sample.education = [{ year: "2014", month: "4", text: "〇〇大学 情報学部 入学" }, { year: "2018", month: "3", text: "〇〇大学 情報学部 卒業" }];
    sample.employment = [{ year: "2018", month: "4", text: "株式会社〇〇 入社\n開発部にてWebアプリケーション開発に従事" }, { year: "", month: "", text: "現在に至る" }];
    sample.qualifications = [{ year: "2017", month: "10", text: "基本情報技術者試験 合格" }, { year: "2020", month: "6", text: "普通自動車第一種運転免許 取得" }];
    sample.sections[0].content = sample.fields.motivation; sample.sections[1].content = sample.fields.wishes;
    delete sample.fields.motivation; delete sample.fields.wishes;
    replace(sample);
  });
  $("r-save").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob);
    const a = node("a"); a.href = url; a.download = `rirekisho-${today()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $("r-open").addEventListener("change", async event => {
    const input = event.target as HTMLInputElement; const file = input.files?.[0]; if (!file) return;
    try { if (file.size > 4 * 1024 * 1024) throw new Error("Too large"); const next = validate(JSON.parse(await file.text())); if (confirm(t("replace"))) replace(next); }
    catch { status(t("invalid")); } finally { input.value = ""; }
  });
  $("r-print").addEventListener("click", async () => { render(); await document.fonts.ready; if (root.hidden) return; render(); save(); const name = draft.fields.name?.trim(); printDocument(name ? `履歴書_${name}` : "履歴書"); });
  new ResizeObserver(resize).observe(pages);
  fill(false); setLocale(locale);
  void loadFont();

  return { activate() { if (needsRender) render(); else resize(); }, deactivate() {}, setLocale };
}
