import avatar128 from "../assets/demo-avatar-128.webp?url&no-inline";
import avatar256 from "../assets/demo-avatar-256.webp?url";
import avatar512 from "../assets/demo-avatar-512.webp?url";
import { renderMarkdown } from "./markdown";
import { resolveResumeFont, resumeFontStack } from "./fonts";
import { loadResumeFont } from "./font-loader";
import { printDocument } from "./print-document";
import {
  getInitialLocale,
  isLocale,
  translate,
  type Locale,
  type MessageKey,
} from "./i18n";

export function initCareerEditor() {
  const root = document.getElementById("career-workspace")!;
  let needsRender = false;
  const STORAGE_KEY = "md-resume-content-v2";
  const FONT_KEY = "md-resume-font";
  const fontSelect = document.getElementById(
    "resume-font",
  ) as HTMLSelectElement;
  const fontStatus = document.getElementById("font-status") as HTMLElement;
  let pendingRender: Promise<boolean> = Promise.resolve(false);
  const THEME_KEY = "md-resume-theme";
  const BACKGROUND_KEY = "md-resume-background";
  const PAGE_MARGINS_KEY = "md-resume-page-margins";
  const DEFAULT_PAGE_MARGIN = 15;
  const MIN_PAGE_MARGIN = 0;
  const MAX_PAGE_MARGIN = 24;
  const AVATAR_KEY = "md-resume-avatar";
  const AVATAR_DEFAULT_DISMISSED_KEY = "md-resume-avatar-default-dismissed";

  const textarea = document.getElementById(
    "markdown-input",
  ) as HTMLTextAreaElement;
  const editorOutlineList = document.getElementById(
    "editor-outline-list",
  ) as HTMLElement;
  const editorOutlineCount = document.getElementById(
    "editor-outline-count",
  ) as HTMLElement;
  const spacerTrigger = document.getElementById(
    "insert-spacer",
  ) as HTMLButtonElement;
  const preview = document.getElementById("resume-preview") as HTMLElement;
  const previewScroll = root.querySelector(
    ".preview-scroll",
  ) as HTMLElement;
  const pages = document.getElementById("resume-pages") as HTMLElement;
  const pageCount = document.getElementById("page-count") as HTMLElement;
  const pageMarginSummary = document.getElementById(
    "page-margin-summary",
  ) as HTMLElement;
  const pageMarginTopInput = document.getElementById(
    "page-margin-top",
  ) as HTMLInputElement;
  const pageMarginBottomInput = document.getElementById(
    "page-margin-bottom",
  ) as HTMLInputElement;
  const pageMarginTopValue = document.getElementById(
    "page-margin-top-value",
  ) as HTMLOutputElement;
  const pageMarginBottomValue = document.getElementById(
    "page-margin-bottom-value",
  ) as HTMLOutputElement;
  const resetPageMarginsButton = document.getElementById(
    "reset-page-margins",
  ) as HTMLButtonElement;
  const copyAiPromptButton = document.getElementById(
    "copy-ai-prompt",
  ) as HTMLButtonElement;
  const themeButtons = Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-theme-option]"),
  );
  const backgroundButtons = Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-background-option]"),
  );
  const localeButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>("[data-locale-option]"),
  );
  let currentLocale: Locale = getInitialLocale();
  const avatarInput = document.getElementById(
    "avatar-input",
  ) as HTMLInputElement;
  const avatarStatus = document.getElementById(
    "avatar-status",
  ) as HTMLElement;
  const editAvatarButton = document.getElementById(
    "edit-avatar",
  ) as HTMLButtonElement;
  const clearAvatarButton = document.getElementById(
    "clear-avatar",
  ) as HTMLButtonElement;
  const avatarEditor = document.getElementById(
    "avatar-editor",
  ) as HTMLDialogElement;
  const avatarEditorStage = document.getElementById(
    "avatar-editor-stage",
  ) as HTMLElement;
  const avatarEditorCropWindow = document.getElementById(
    "avatar-editor-crop-window",
  ) as HTMLElement;
  const avatarEditorSourceImage = document.getElementById(
    "avatar-editor-source-image",
  ) as HTMLImageElement;
  const avatarEditorImage = document.getElementById(
    "avatar-editor-image",
  ) as HTMLImageElement;
  const avatarZoomInput = document.getElementById(
    "avatar-zoom",
  ) as HTMLInputElement;
  const avatarZoomValue = document.getElementById(
    "avatar-zoom-value",
  ) as HTMLOutputElement;
  const avatarShapeInputs = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[name="avatar-shape"]'),
  );
  const closeAvatarEditorButton = document.getElementById(
    "close-avatar-editor",
  ) as HTMLButtonElement;
  const cancelAvatarEditorButton = document.getElementById(
    "cancel-avatar-editor",
  ) as HTMLButtonElement;
  const saveAvatarEditorButton = document.getElementById(
    "save-avatar-editor",
  ) as HTMLButtonElement;
  const sampleData = document.getElementById(
    "sample-resume-data",
  ) as HTMLScriptElement;
  const sampleText = sampleData.textContent ?? "";
  const sampleIdentityLine =
    sampleText.split(/\r?\n/).find((line) => line.startsWith("**")) ?? "";
  const overflowWarning = document.getElementById(
    "content-overflow-warning",
  ) as HTMLElement;
  const storedAvatar = localStorage.getItem(AVATAR_KEY);
  let avatarDataUrl =
    storedAvatar ??
    (localStorage.getItem(AVATAR_DEFAULT_DISMISSED_KEY) === "true"
      ? ""
      : avatar512);
  // Migrate the default URL saved by older versions after editing its crop.
  if (avatarDataUrl === "/demo-avatar.png") avatarDataUrl = avatar512;
  const isDefaultAvatar = !storedAvatar && avatarDataUrl === avatar512;
  const AVATAR_SETTINGS_KEY = "md-resume-avatar-settings";
  const savedAvatarSettings = (() => {
    try {
      const parsed = JSON.parse(
        localStorage.getItem(AVATAR_SETTINGS_KEY) ?? "{}",
      );
      return {
        zoom: Number.isFinite(Number(parsed.zoom))
          ? Number(parsed.zoom)
          : 100,
        shape: isDefaultAvatar
          ? "circle"
          : parsed.shape === "circle"
            ? "circle"
            : "rectangle",
        x: Number.isFinite(Number(parsed.x)) ? Number(parsed.x) : 0,
        y: Number.isFinite(Number(parsed.y)) ? Number(parsed.y) : 0,
      };
    } catch {
      return {
        zoom: 100,
        shape: isDefaultAvatar ? "circle" : "rectangle",
        x: 0,
        y: 0,
      };
    }
  })();
  let avatarZoom = Math.min(240, Math.max(100, savedAvatarSettings.zoom));
  let avatarShape: "rectangle" | "circle" = savedAvatarSettings.shape;
  let avatarOffset = {
    x: Math.min(100, Math.max(-100, savedAvatarSettings.x)),
    y: Math.min(100, Math.max(-100, savedAvatarSettings.y)),
  };
  let avatarDraftDataUrl = avatarDataUrl;
  let avatarDraftZoom = avatarZoom;
  let avatarDraftShape: "rectangle" | "circle" = avatarShape;
  let avatarDraftOffset = { ...avatarOffset };

  const savedPageMargins = (() => {
    try {
      const parsed = JSON.parse(
        localStorage.getItem(PAGE_MARGINS_KEY) ?? "{}",
      );
      return {
        top: Number.isFinite(Number(parsed.top))
          ? Number(parsed.top)
          : DEFAULT_PAGE_MARGIN,
        bottom: Number.isFinite(Number(parsed.bottom))
          ? Number(parsed.bottom)
          : DEFAULT_PAGE_MARGIN,
      };
    } catch {
      return { top: DEFAULT_PAGE_MARGIN, bottom: DEFAULT_PAGE_MARGIN };
    }
  })();
  let pageMarginTop = savedPageMargins.top;
  let pageMarginBottom = savedPageMargins.bottom;

  function message(key: string) {
    return translate(currentLocale, key as MessageKey);
  }

  function applyLocale(locale: string) {
    const nextLocale: Locale = isLocale(locale) ? locale : "ja";
    currentLocale = nextLocale;
    document.documentElement.lang =
      nextLocale === "zh" ? "zh-CN" : nextLocale;
    document.documentElement.dataset.locale = nextLocale;

    root
      .querySelectorAll<HTMLElement>("[data-i18n]")
      .forEach((element) => {
        element.textContent = message(element.dataset.i18n ?? "");
      });
    root
      .querySelectorAll<HTMLElement>("[data-i18n-html]")
      .forEach((element) => {
        element.innerHTML = message(element.dataset.i18nHtml ?? "");
      });
    root
      .querySelectorAll<HTMLElement>("[data-i18n-aria-label]")
      .forEach((element) => {
        element.setAttribute(
          "aria-label",
          message(element.dataset.i18nAriaLabel ?? ""),
        );
      });
    root
      .querySelectorAll<HTMLElement>("[data-i18n-title]")
      .forEach((element) => {
        element.setAttribute(
          "title",
          message(element.dataset.i18nTitle ?? ""),
        );
      });
    root
      .querySelectorAll<HTMLImageElement>("[data-i18n-alt]")
      .forEach((element) => {
        element.alt = message(element.dataset.i18nAlt ?? "");
      });

    document.title = message("documentTitle");
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", message("description"));
    localeButtons.forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.localeOption === nextLocale),
      );
    });
    pageCount.textContent = formatPageCount(currentPageTotal);
    updatePageMarginLabels();
    updateAvatarControls();
    updateEditorOutline();
    updateFontStatus(preview.dataset.fontStatus ?? "ready");
    document.documentElement.classList.remove("i18n-pending");
    document.documentElement.style.removeProperty("visibility");
  }

  function updateFontStatus(status: string) {
    preview.dataset.fontStatus = status;
    fontStatus.textContent =
      status === "loading"
        ? message("fontLoading")
        : status === "error"
          ? message("fontError")
          : "";
  }

  function applyFont(id: string) {
    const font = resolveResumeFont(id);
    fontSelect.value = font.id;
    preview.style.setProperty("--resume-font", resumeFontStack(font.id));
  }

  function applyTheme(theme: string) {
    const validThemes = [
      "navy",
      "graphite",
      "slate",
      "forest",
      "burgundy",
      "amber",
    ];
    const nextTheme = validThemes.includes(theme) ? theme : "navy";
    preview.dataset.theme = nextTheme;
    themeButtons.forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.themeOption === nextTheme),
      );
    });
  }

  function applyBackground(background: string) {
    const validBackgrounds = ["paper", "mist", "linen"];
    const nextBackground = validBackgrounds.includes(background)
      ? background
      : "paper";
    preview.dataset.background = nextBackground;
    backgroundButtons.forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.backgroundOption === nextBackground),
      );
    });
  }

  let renderToken = 0;
  let currentPageTotal = 1;

  function px(value: string) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatCurrentDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatPageCount(count: number) {
    return message("pageCount").replace("{count}", String(count));
  }

  function clampPageMargin(value: number) {
    return Math.min(MAX_PAGE_MARGIN, Math.max(MIN_PAGE_MARGIN, value));
  }

  function updatePageMarginLabels() {
    const top = `${pageMarginTop} mm`;
    const bottom = `${pageMarginBottom} mm`;
    pageMarginTopInput.value = String(pageMarginTop);
    pageMarginBottomInput.value = String(pageMarginBottom);
    pageMarginTopValue.textContent = top;
    pageMarginBottomValue.textContent = bottom;
    pageMarginSummary.textContent = message("pageMargins")
      .replace("{top}", String(pageMarginTop))
      .replace("{bottom}", String(pageMarginBottom));
  }

  function applyPageMargins(
    top: number,
    bottom: number,
    persist = true,
    rerender = true,
  ) {
    pageMarginTop = clampPageMargin(top);
    pageMarginBottom = clampPageMargin(bottom);
    preview.style.setProperty("--resume-padding-top", `${pageMarginTop}mm`);
    preview.style.setProperty(
      "--resume-padding-bottom",
      `${pageMarginBottom}mm`,
    );
    updatePageMarginLabels();
    if (persist) {
      localStorage.setItem(
        PAGE_MARGINS_KEY,
        JSON.stringify({ top: pageMarginTop, bottom: pageMarginBottom }),
      );
    }
    if (rerender) render();
  }

  const spacerMirror = document.createElement("div");
  spacerMirror.className = "editor-caret-mirror";
  document.body.appendChild(spacerMirror);

  function clearSpacerMirror() {
    spacerMirror.replaceChildren();
  }

  function setSpacerTriggerVisible(visible: boolean) {
    spacerTrigger.hidden = !visible;
    spacerTrigger.classList.toggle("editor-spacer-trigger-visible", visible);
  }

  function setSpacerTriggerMode(removing: boolean) {
    spacerTrigger.dataset.mode = removing ? "remove" : "insert";
    spacerTrigger.textContent = removing ? "−" : "+";
    spacerTrigger.classList.toggle("editor-spacer-remove", removing);
    const labelKey = removing ? "removeSpacer" : "insertSpacer";
    const label = message(labelKey);
    spacerTrigger.setAttribute("aria-label", label);
    spacerTrigger.setAttribute("title", label);
  }

  function escapeHtml(value: string) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function measureEditorCaret(position: number) {
    const style = getComputedStyle(textarea);
    spacerMirror.style.width = `${textarea.clientWidth}px`;
    spacerMirror.style.font = style.font;
    spacerMirror.style.lineHeight = style.lineHeight;
    spacerMirror.style.letterSpacing = style.letterSpacing;
    spacerMirror.style.padding = style.padding;
    spacerMirror.style.border = style.border;
    spacerMirror.style.boxSizing = style.boxSizing;
    spacerMirror.style.whiteSpace = "pre-wrap";
    spacerMirror.style.overflowWrap = "break-word";
    spacerMirror.style.wordBreak = style.wordBreak;
    spacerMirror.innerHTML = `${escapeHtml(
      textarea.value.slice(0, position),
    ).replaceAll(
      "\n",
      "<br>",
    )}<span class="editor-caret-marker">&#8203;</span>`;

    const marker = spacerMirror.querySelector(
      ".editor-caret-marker",
    ) as HTMLElement;
    const mirrorRect = spacerMirror.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    const offset = markerRect.top - mirrorRect.top;
    const lineHeight = px(style.lineHeight) || px(style.fontSize) * 1.75;
    clearSpacerMirror();
    return { offset, lineHeight };
  }

  function updateEditorOutline() {
    const value = textarea.value;
    const lines = value.split(/\r?\n/);
    const headings: Array<{
      level: number;
      title: string;
      index: number;
      line: number;
      start: number;
      end: number;
    }> = [];
    let offset = 0;
    let inFence = false;

    lines.forEach((line, lineIndex) => {
      const trimmed = line.trim();
      if (/^(```|~~~)/.test(trimmed)) {
        inFence = !inFence;
      } else if (!inFence) {
        const match = line.match(/^\s*(#{1,5})[ \t]+(.+?)\s*$/);
        if (match) {
          const title = match[2].replace(/\s+#+\s*$/, "").trim();
          if (title) {
            headings.push({
              level: match[1].length,
              title,
              index: headings.length,
              line: lineIndex,
              start: offset,
              end: offset + line.length,
            });
          }
        }
      }

      if (lineIndex < lines.length - 1) {
        offset +=
          line.length + (value[offset + line.length] === "\r" ? 2 : 1);
      }
    });

    editorOutlineCount.textContent = String(headings.length);
    editorOutlineList.replaceChildren();

    if (headings.length === 0) {
      const empty = document.createElement("span");
      empty.className = "editor-outline-empty";
      empty.textContent = message("outlineEmpty");
      editorOutlineList.append(empty);
      return;
    }

    headings.forEach((heading) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "editor-outline-item";
      item.style.setProperty(
        "--outline-indent",
        `${0.35 + (heading.level - 1) * 0.7}rem`,
      );
      item.textContent = heading.title;
      item.title = heading.title;
      item.addEventListener("mousedown", (event) => {
        event.preventDefault();
      });
      item.addEventListener("click", () => {
        const previousScrollTop = textarea.scrollTop;
        textarea.focus({ preventScroll: true });
        textarea.setSelectionRange(heading.start, heading.end);
        textarea.scrollTop = previousScrollTop;
        requestAnimationFrame(() => {
          const caret = measureEditorCaret(heading.start);
          const targetScrollTop = Math.max(
            0,
            caret.offset - textarea.clientHeight * 0.08,
          );
          textarea.scrollTop = previousScrollTop;
          textarea.scrollTo({
            top: targetScrollTop,
            behavior: "smooth",
          });
          scrollPreviewToHeading(heading.index);
          updateSpacerTrigger();
        });
      });
      editorOutlineList.append(item);
    });
  }

  function scrollPreviewToHeading(index: number) {
    const target = pages.querySelector<HTMLElement>(
      `[data-outline-index="${index}"]`,
    );
    if (!target) return;

    const previewIsScrollable =
      previewScroll.scrollHeight > previewScroll.clientHeight + 1;
    if (!previewIsScrollable) return;

    const previewRect = previewScroll.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const targetTop =
      previewScroll.scrollTop +
      targetRect.top -
      previewRect.top -
      previewScroll.clientHeight * 0.08;
    previewScroll.scrollTo({
      top: Math.max(0, targetTop),
      behavior: "smooth",
    });
  }

  function updateSpacerTrigger() {
    if (document.activeElement !== textarea) {
      clearSpacerMirror();
      setSpacerTriggerMode(false);
      setSpacerTriggerVisible(false);
      return;
    }

    const value = textarea.value;
    const position = textarea.selectionStart;
    const lineStart = value.lastIndexOf("\n", position - 1) + 1;
    const nextLineBreak = value.indexOf("\n", position);
    const lineEnd = nextLineBreak === -1 ? value.length : nextLineBreak;
    const currentLine = value.slice(lineStart, lineEnd);
    const isSpacerLine = currentLine.trim() === "<!-- spacer -->";

    if (currentLine.trim() !== "" && !isSpacerLine) {
      clearSpacerMirror();
      setSpacerTriggerMode(false);
      setSpacerTriggerVisible(false);
      return;
    }

    setSpacerTriggerMode(isSpacerLine);

    const caret = measureEditorCaret(position);
    const triggerHeight =
      px(getComputedStyle(spacerTrigger).height) || 1.75 * 16;
    const top =
      caret.offset -
      textarea.scrollTop +
      (caret.lineHeight - triggerHeight) / 2;

    clearSpacerMirror();
    spacerTrigger.style.top = `${top}px`;
    setSpacerTriggerVisible(
      top + triggerHeight >= 0 && top <= textarea.clientHeight,
    );
  }

  function replaceEditorRange(
    start: number,
    end: number,
    replacement: string,
  ) {
    textarea.focus();
    textarea.setSelectionRange(start, end);

    // Native insertText creates a browser undo transaction. The fallback is
    // kept for browsers that do not expose execCommand for textareas.
    const inserted = document.execCommand("insertText", false, replacement);
    if (!inserted) {
      textarea.setRangeText(replacement, start, end, "end");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  function insertSpacer() {
    const value = textarea.value;
    const position = textarea.selectionStart;
    const lineStart = value.lastIndexOf("\n", position - 1) + 1;
    const nextLineBreak = value.indexOf("\n", position);
    const lineEnd = nextLineBreak === -1 ? value.length : nextLineBreak;
    const currentLine = value.slice(lineStart, lineEnd);

    if (currentLine.trim() !== "") return;

    const insertedSpacer = "\n<!-- spacer -->\n";
    replaceEditorRange(lineStart, lineEnd, insertedSpacer);
    updateSpacerTrigger();
  }

  function removeSpacer() {
    const value = textarea.value;
    const position = textarea.selectionStart;
    const lineStart = value.lastIndexOf("\n", position - 1) + 1;
    const nextLineBreak = value.indexOf("\n", position);
    const lineEnd = nextLineBreak === -1 ? value.length : nextLineBreak;
    const currentLine = value.slice(lineStart, lineEnd);

    if (currentLine.trim() !== "<!-- spacer -->") return;

    const hasBlankBefore = value.slice(0, lineStart).endsWith("\n\n");
    const hasBlankAfter = value.slice(lineEnd).startsWith("\n\n");
    const removeStart = hasBlankBefore ? lineStart - 1 : lineStart;
    const removeEnd = hasBlankAfter ? lineEnd + 1 : lineEnd;

    replaceEditorRange(removeStart, removeEnd, "");
    updateSpacerTrigger();
  }

  spacerTrigger.addEventListener("pointerdown", (event) => {
    event.preventDefault();
  });
  spacerTrigger.addEventListener("click", () => {
    if (spacerTrigger.dataset.mode === "remove") {
      removeSpacer();
    } else {
      insertSpacer();
    }
  });
  textarea.addEventListener("select", updateSpacerTrigger);
  textarea.addEventListener("keyup", updateSpacerTrigger);
  textarea.addEventListener("click", updateSpacerTrigger);
  textarea.addEventListener("focus", updateSpacerTrigger);
  textarea.addEventListener("blur", updateSpacerTrigger);
  textarea.addEventListener("scroll", updateSpacerTrigger);
  document.addEventListener("selectionchange", updateSpacerTrigger);
  window.addEventListener("resize", updateSpacerTrigger);
  new ResizeObserver(updateSpacerTrigger).observe(textarea);

  // The demo portrait belongs to the sample, so it must never carry over into
  // a resume once the sample's name has been replaced.
  function displayedAvatar() {
    const isDemoAvatar = avatarDataUrl === avatar512;
    const isSampleContent =
      sampleIdentityLine !== "" && textarea.value.includes(sampleIdentityLine);
    return isDemoAvatar && !isSampleContent ? "" : avatarDataUrl;
  }

  function updateAvatarControls(
    statusKey?: "avatarPending" | "avatarUploadFailed",
  ) {
    const avatar = displayedAvatar();
    avatarStatus.textContent = statusKey
      ? message(statusKey)
      : !avatar
        ? message("avatarUnset")
        : avatar === avatar512
          ? message("avatarSample")
          : message("avatarSet");
    editAvatarButton.disabled = !avatar;
    clearAvatarButton.disabled = !avatar;
  }

  function persistAvatarSettings() {
    localStorage.setItem(
      AVATAR_SETTINGS_KEY,
      JSON.stringify({
        zoom: avatarZoom,
        shape: avatarShape,
        x: avatarOffset.x,
        y: avatarOffset.y,
      }),
    );
  }

  function syncAvatarEditor() {
    if (!avatarEditor.open) return;
    avatarEditorCropWindow.dataset.shape = avatarDraftShape;
    const cropImageWidth = avatarEditorImage.clientWidth;
    const cropImageHeight = avatarEditorImage.clientHeight;
    const naturalWidth = avatarEditorImage.naturalWidth;
    const naturalHeight = avatarEditorImage.naturalHeight;
    const sourceImageWidth = avatarEditorSourceImage.clientWidth;
    const sourceImageHeight = avatarEditorSourceImage.clientHeight;
    const cropImageScale =
      naturalWidth > 0 && naturalHeight > 0
        ? Math.min(
            cropImageWidth / naturalWidth,
            cropImageHeight / naturalHeight,
          )
        : 0;
    const sourceImageScale =
      naturalWidth > 0 && naturalHeight > 0
        ? Math.min(
            sourceImageWidth / naturalWidth,
            sourceImageHeight / naturalHeight,
          )
        : 0;
    const sourceScaleRatio =
      cropImageScale > 0 && sourceImageScale > 0
        ? cropImageScale / sourceImageScale
        : avatarDraftShape === "rectangle"
          ? 0.75
          : 1;
    const offsetX =
      cropImageWidth > 0
        ? `${(avatarDraftOffset.x / 100) * cropImageWidth}px`
        : `${avatarDraftOffset.x}%`;
    const offsetY =
      cropImageHeight > 0
        ? `${(avatarDraftOffset.y / 100) * cropImageHeight}px`
        : `${avatarDraftOffset.y}%`;

    avatarEditorCropWindow.style.setProperty(
      "--avatar-zoom",
      String(avatarDraftZoom / 100),
    );
    avatarEditorCropWindow.style.setProperty("--avatar-offset-x", offsetX);
    avatarEditorCropWindow.style.setProperty("--avatar-offset-y", offsetY);
    avatarEditorSourceImage.style.setProperty(
      "--avatar-source-zoom",
      String((avatarDraftZoom / 100) * sourceScaleRatio),
    );
    avatarEditorSourceImage.style.setProperty("--avatar-offset-x", offsetX);
    avatarEditorSourceImage.style.setProperty("--avatar-offset-y", offsetY);
    avatarZoomInput.value = String(avatarDraftZoom);
    avatarZoomValue.value = `${avatarDraftZoom}%`;
    avatarShapeInputs.forEach((input) => {
      input.checked = input.value === avatarDraftShape;
    });
  }

  function setAvatarEditorOpen(
    isOpen: boolean,
    draftDataUrl = avatarDataUrl,
  ) {
    const shouldOpen = isOpen && Boolean(draftDataUrl);
    if (shouldOpen) {
      avatarDraftDataUrl = draftDataUrl;
      avatarDraftZoom = avatarZoom;
      avatarDraftShape = avatarShape;
      avatarDraftOffset = { ...avatarOffset };
      avatarEditorSourceImage.src = avatarDraftDataUrl;
      avatarEditorImage.src = avatarDraftDataUrl;
      if (!avatarEditor.open) avatarEditor.showModal();
      syncAvatarEditor();
    } else {
      if (avatarEditor.open) avatarEditor.close();
      avatarEditorSourceImage.removeAttribute("src");
      avatarEditorImage.removeAttribute("src");
      updateAvatarControls();
    }
  }

  function saveAvatarEditor() {
    if (!avatarDraftDataUrl) return;
    avatarDataUrl = avatarDraftDataUrl;
    avatarZoom = avatarDraftZoom;
    avatarShape = avatarDraftShape;
    avatarOffset = { ...avatarDraftOffset };
    localStorage.setItem(AVATAR_KEY, avatarDataUrl);
    localStorage.removeItem(AVATAR_DEFAULT_DISMISSED_KEY);
    persistAvatarSettings();
    setAvatarEditorOpen(false);
    updateAvatarControls();
    render();
  }

  function clampAvatarOffset(value: number) {
    return Math.min(100, Math.max(-100, value));
  }

  let avatarDragPointerId: number | null = null;
  let avatarDragStart = { x: 0, y: 0 };
  let avatarDragOrigin = { x: 0, y: 0 };

  function finishAvatarDrag(pointerId: number) {
    if (avatarDragPointerId !== pointerId) return;
    avatarDragPointerId = null;
    avatarEditorStage.classList.remove("is-dragging");
    if (avatarEditorStage.hasPointerCapture(pointerId)) {
      avatarEditorStage.releasePointerCapture(pointerId);
    }
  }

  avatarEditorStage.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    avatarDragPointerId = event.pointerId;
    avatarDragStart = { x: event.clientX, y: event.clientY };
    avatarDragOrigin = { ...avatarDraftOffset };
    avatarEditorStage.setPointerCapture(event.pointerId);
    avatarEditorStage.classList.add("is-dragging");
    event.preventDefault();
  });

  avatarEditorStage.addEventListener("pointermove", (event) => {
    if (avatarDragPointerId !== event.pointerId) return;
    const bounds = avatarEditorStage.getBoundingClientRect();
    avatarDraftOffset = {
      x: clampAvatarOffset(
        avatarDragOrigin.x +
          ((event.clientX - avatarDragStart.x) / bounds.width) * 100,
      ),
      y: clampAvatarOffset(
        avatarDragOrigin.y +
          ((event.clientY - avatarDragStart.y) / bounds.height) * 100,
      ),
    };
    syncAvatarEditor();
    event.preventDefault();
  });

  avatarEditorStage.addEventListener("pointerup", (event) => {
    finishAvatarDrag(event.pointerId);
  });

  avatarEditorStage.addEventListener("pointercancel", (event) => {
    finishAvatarDrag(event.pointerId);
  });

  avatarEditorStage.addEventListener(
    "wheel",
    (event) => {
      const nextZoom = avatarDraftZoom + (event.deltaY < 0 ? 5 : -5);
      avatarDraftZoom = Math.min(240, Math.max(100, nextZoom));
      syncAvatarEditor();
      event.preventDefault();
    },
    { passive: false },
  );

  async function optimizeAvatar(file: File) {
    const sourceUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("画像を読み込めませんでした"));
      reader.readAsDataURL(file);
    });

    return new Promise<string>((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        // Keep normal photos untouched. Only very large images are reduced,
        // and the editor itself handles the visual crop inside the avatar frame.
        const maxEdge = 1600;
        const longestEdge = Math.max(image.naturalWidth, image.naturalHeight);
        if (longestEdge <= maxEdge) {
          resolve(sourceUrl);
          return;
        }

        const scale = maxEdge / longestEdge;
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("画像を処理できませんでした"));
          return;
        }
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const outputType =
          file.type === "image/png" ? "image/png" : "image/jpeg";
        resolve(
          outputType === "image/png"
            ? canvas.toDataURL(outputType)
            : canvas.toDataURL(outputType, 0.96),
        );
      };
      image.onerror = () => reject(new Error("画像を読み込めませんでした"));
      image.src = sourceUrl;
    });
  }

  function isHeadingIdentity(paragraph: Element) {
    const significantNodes = Array.from(paragraph.childNodes).filter(
      (node) => node.nodeType !== 3 || Boolean(node.textContent?.trim()),
    );
    return (
      significantNodes.length > 0 &&
      significantNodes.every(
        (node) =>
          node.nodeType === 1 &&
          (node.nodeName === "STRONG" || node.nodeName === "BR"),
      )
    );
  }

  function decorateContactRow(identity: Element) {
    const contactParagraph = identity.nextElementSibling;
    const contactText = contactParagraph?.textContent?.trim() ?? "";
    const looksLikeContact =
      /@|linkedin|github|email|メール|電話|携帯|phone|tel|website|ポートフォリオ/i.test(
        contactText,
      );
    if (
      !contactParagraph ||
      contactParagraph.tagName !== "P" ||
      !contactText ||
      (!contactParagraph.querySelector("a") && !looksLikeContact)
    )
      return null;
    contactParagraph
      .querySelectorAll('a[href^="mailto:"]')
      .forEach((link) => {
        link.replaceWith(document.createTextNode(link.textContent ?? ""));
      });
    contactParagraph.querySelectorAll("a").forEach((link) => {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noreferrer");
    });
    contactParagraph.classList.add("resume-contact-row");
    return contactParagraph as HTMLElement;
  }

  function decorateAvatar(source: HTMLElement) {
    const titleHeading = source.querySelector("h1");
    const metaParagraph = titleHeading?.nextElementSibling;
    const parent = titleHeading?.parentElement;
    if (
      !titleHeading ||
      !metaParagraph ||
      metaParagraph.tagName !== "P" ||
      !parent
    )
      return;
    const headingIdentity = isHeadingIdentity(metaParagraph);
    if (headingIdentity)
      metaParagraph.classList.add("resume-heading-identity");
    const contactRow = headingIdentity
      ? decorateContactRow(metaParagraph)
      : null;
    const avatarToShow = displayedAvatar();
    if (!avatarToShow && !contactRow) return;

    const coverHeader = document.createElement("div");
    coverHeader.className = "resume-cover-header";

    const lineBreak = metaParagraph.querySelector("br");
    if (!headingIdentity && lineBreak) {
      const name = document.createElement("span");
      name.className = "resume-name";
      let node = lineBreak.nextSibling;
      while (node) {
        const nextNode = node.nextSibling;
        name.append(node);
        node = nextNode;
      }
      metaParagraph.append(name);
    } else if (!headingIdentity) {
      metaParagraph.classList.add("resume-name-only");
    }

    parent.insertBefore(coverHeader, titleHeading);
    coverHeader.append(titleHeading);
    if (contactRow) coverHeader.append(contactRow);

    if (avatarToShow) {
      const metaRow = document.createElement("div");
      metaRow.className = "resume-cover-meta";
      const avatarFrame = document.createElement("div");
      avatarFrame.className = "avatar-crop-frame resume-avatar-frame";
      avatarFrame.dataset.shape = avatarShape;
      avatarFrame.style.setProperty(
        "--avatar-zoom",
        String(avatarZoom / 100),
      );
      avatarFrame.style.setProperty(
        "--avatar-offset-x",
        `${avatarOffset.x}%`,
      );
      avatarFrame.style.setProperty(
        "--avatar-offset-y",
        `${avatarOffset.y}%`,
      );
      const avatar = document.createElement("img");
      avatar.className = "resume-avatar";
      avatar.src = avatarToShow;
      if (avatarToShow === avatar512) {
        avatar.srcset = `${avatar128} 128w, ${avatar256} 256w, ${avatar512} 512w`;
        // Include crop zoom so enlarged photos retain enough detail.
        avatar.sizes = `${Math.ceil((114 * avatarZoom) / 100)}px`;
      }
      avatar.width = 512;
      avatar.height = 512;
      avatar.decoding = "async";
      avatar.alt = message("resumePhotoAlt");
      avatarFrame.append(avatar);
      metaRow.append(metaParagraph, avatarFrame);
      coverHeader.append(metaRow);
    } else {
      coverHeader.append(metaParagraph);
    }
  }

  function paginate(source: HTMLElement, token: number) {
    if (token !== renderToken) return;

    const computed = getComputedStyle(source);
    const contentHeight =
      source.clientHeight -
      px(computed.paddingTop) -
      px(computed.paddingBottom);
    const contentTop =
      source.getBoundingClientRect().top + px(computed.paddingTop);
    type MeasuredItem = { element: HTMLElement; top: number; bottom: number };
    type MeasuredEntry = {
      child: HTMLElement;
      top: number;
      bottom: number;
      items?: MeasuredItem[];
    };
    const measuredChildren: MeasuredEntry[] = Array.from(source.children).map(
      (node) => {
        const child = node as HTMLElement;
        const rect = child.getBoundingClientRect();
        return {
          child,
          top: rect.top - contentTop,
          bottom: rect.bottom - contentTop,
        };
      },
    );

    // Keep headings with the beginning of their section. Major H2 sections
    // also keep the first H3 and its metadata together, so a section title
    // never lands alone at the bottom of a page.
    type MeasuredBlock = {
      entries: MeasuredEntry[];
      top: number;
      bottom: number;
      height: number;
    };
    const measuredBlocks: MeasuredBlock[] = [];

    for (let index = 0; index < measuredChildren.length; index += 1) {
      const current = measuredChildren[index];
      const isHeading = /^H[1-5]$/.test(current.child.tagName);
      const headingLevel = isHeading
        ? Number(current.child.tagName.slice(1))
        : 0;
      const entries = [current];

      const appendNext = () => {
        const next = measuredChildren[index + 1];
        if (!next) return false;
        entries.push(next);
        index += 1;
        return true;
      };

      if (
        headingLevel === 2 &&
        measuredChildren[index + 1]?.child.tagName === "H3"
      ) {
        appendNext();
        if (
          measuredChildren[index + 1] &&
          !/^H[1-5]$/.test(measuredChildren[index + 1].child.tagName)
        ) {
          appendNext();
        }
      } else if (isHeading) {
        const keepFollowing = headingLevel === 2 ? 3 : 1;
        while (
          entries.length <= keepFollowing &&
          measuredChildren[index + 1] &&
          !/^H[1-5]$/.test(measuredChildren[index + 1].child.tagName)
        ) {
          appendNext();
        }
      }

      const firstEntry = entries[0];
      const lastEntry = entries[entries.length - 1];
      const height = Math.max(0, lastEntry.bottom - firstEntry.top);
      measuredBlocks.push({
        entries,
        top: firstEntry.top,
        bottom: lastEntry.bottom,
        height,
      });
    }

    // Item geometry is only valid while the source is intact, so capture it for
    // anything that may need splitting before content moves onto pages.
    for (const block of measuredBlocks) {
      if (block.height <= contentHeight) continue;
      for (const entry of block.entries) {
        const elements = splittableItems(entry.child);
        if (elements.length < 2) continue;
        entry.items = elements.map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            element,
            top: rect.top - contentTop,
            bottom: rect.bottom - contentTop,
          };
        });
      }
    }

    pages.replaceChildren();

    let currentPage: HTMLElement | undefined;
    let usedHeight = 0;
    let totalPages = 0;
    let previousBlock: { bottom: number } | undefined;

    const addPage = () => {
      const page = document.createElement("section");
      const frame = document.createElement("div");
      frame.className = "resume-page-frame";
      page.className = "resume-page";
      page.setAttribute(
        "aria-label",
        message("pageAriaLabel").replace("{count}", String(totalPages + 1)),
      );
      frame.appendChild(page);
      pages.appendChild(frame);
      currentPage = page;
      usedHeight = 0;
      totalPages += 1;
    };

    // Lead-in headings stay with the first items, then the list or table
    // continues across as many pages as it needs.
    const placeSplitBlock = (block: MeasuredBlock, splitIndex: number) => {
      const entry = block.entries[splitIndex];
      const items = entry.items!;
      const leadEntries = block.entries.slice(0, splitIndex);
      const tailEntries = block.entries.slice(splitIndex + 1);
      const leadHeight = entry.top - block.top;
      const itemOffset = items[0].top - entry.top;
      const closingHeight = entry.bottom - items[items.length - 1].bottom;
      const firstItemHeight = items[0].bottom - items[0].top;
      const gap = previousBlock
        ? Math.max(0, block.top - previousBlock.bottom)
        : 0;

      if (
        !currentPage ||
        (usedHeight > 0 &&
          usedHeight + gap + leadHeight + itemOffset + firstItemHeight >
            contentHeight)
      ) {
        addPage();
      } else {
        usedHeight += gap;
      }
      for (const lead of leadEntries) currentPage?.appendChild(lead.child);
      usedHeight += leadHeight;

      let start = 0;
      while (start < items.length) {
        const available = contentHeight - usedHeight;
        const heightThrough = (index: number) =>
          itemOffset +
          items[index].bottom -
          items[start].top +
          (index === items.length - 1 ? closingHeight : 0);
        let end = start;
        while (
          end + 1 < items.length &&
          heightThrough(end + 1) <= available
        ) {
          end += 1;
        }
        currentPage?.appendChild(
          createSplitPart(entry.child, items.slice(start, end + 1), start),
        );
        usedHeight += heightThrough(end);
        start = end + 1;
        if (start < items.length) addPage();
      }
      previousBlock = { bottom: entry.bottom };

      if (tailEntries.length) {
        const top = tailEntries[0].top;
        const bottom = tailEntries[tailEntries.length - 1].bottom;
        placeBlock({ entries: tailEntries, top, bottom, height: bottom - top });
      }
    };

    const placeBlock = (block: MeasuredBlock) => {
      const splitIndex =
        block.height > contentHeight
          ? block.entries.findIndex((entry) => entry.items)
          : -1;
      if (splitIndex >= 0) {
        placeSplitBlock(block, splitIndex);
        return;
      }

      const gap = previousBlock
        ? Math.max(0, block.top - previousBlock.bottom)
        : 0;
      if (
        !currentPage ||
        (usedHeight > 0 && usedHeight + gap + block.height > contentHeight)
      ) {
        addPage();
        previousBlock = undefined;
      }

      for (const entry of block.entries) {
        currentPage?.appendChild(entry.child);
      }
      usedHeight += previousBlock ? gap : 0;
      usedHeight += block.height;
      previousBlock = block;
    };

    measuredBlocks.forEach(placeBlock);

    if (!measuredBlocks.length) addPage();

    source.remove();
    const firstPage = pages.querySelector(
      ".resume-page-frame > .resume-page",
    ) as HTMLElement | null;
    if (firstPage) {
      const date = formatCurrentDate();
      const dateElement = document.createElement("time");
      dateElement.className = "resume-date";
      dateElement.dateTime = date;
      dateElement.textContent = date;
      firstPage.appendChild(dateElement);
    }
    currentPageTotal = totalPages || 1;
    pageCount.textContent = formatPageCount(currentPageTotal);
    // A single paragraph or list item can still be taller than a page; pages
    // clip their overflow, so tell the author rather than losing text silently.
    overflowWarning.hidden = !hasClippedContent();
    syncPreviewPageScale();
  }

  function hasClippedContent() {
    return Array.from(
      pages.querySelectorAll<HTMLElement>(".resume-page-frame > .resume-page"),
    ).some((page) => {
      const paperBottom = page.getBoundingClientRect().bottom;
      return Array.from(page.children).some(
        (child) =>
          child.tagName !== "TIME" &&
          child.getBoundingClientRect().bottom > paperBottom + 1,
      );
    });
  }

  function splittableItems(element: HTMLElement) {
    if (element instanceof HTMLTableElement) {
      return Array.from(element.tBodies[0]?.rows ?? []) as HTMLElement[];
    }
    return element instanceof HTMLUListElement ||
      element instanceof HTMLOListElement
      ? (Array.from(element.children) as HTMLElement[])
      : [];
  }

  function createSplitPart(
    original: HTMLElement,
    items: Array<{ element: HTMLElement }>,
    startIndex: number,
  ) {
    const part = original.cloneNode(false) as HTMLElement;
    let container = part;
    if (original instanceof HTMLTableElement) {
      if (original.tHead) part.append(original.tHead.cloneNode(true));
      container = document.createElement("tbody");
      part.append(container);
    } else if (original instanceof HTMLOListElement) {
      part.setAttribute("start", String(original.start + startIndex));
    }
    items.forEach((item) => container.append(item.element));
    return part;
  }

  function syncPreviewPageScale() {
    if (root.hidden) return;
    const firstPage = pages.querySelector(
      ".resume-page-frame > .resume-page",
    ) as HTMLElement | null;
    if (!firstPage || !previewScroll) return;

    const scrollStyle = getComputedStyle(previewScroll);
    const availableWidth = Math.max(
      0,
      previewScroll.clientWidth -
        px(scrollStyle.paddingLeft) -
        px(scrollStyle.paddingRight),
    );
    if (availableWidth === 0) return;
    const scale = Math.min(1, availableWidth / firstPage.offsetWidth);

    // Complete all geometry reads before changing any frame's styles.
    const measurements = Array.from(
      pages.querySelectorAll<HTMLElement>(".resume-page-frame"),
      (frame) => {
        const page = frame.firstElementChild as HTMLElement | null;
        return {
          frame,
          page,
          width: page?.offsetWidth ?? 0,
          height: page?.offsetHeight ?? 0,
        };
      },
    );
    measurements.forEach(({ frame, page, width, height }) => {
      if (!page) return;

      if (scale < 1) {
        frame.style.width = `${width * scale}px`;
        frame.style.height = `${height * scale}px`;
        page.style.transform = `scale(${scale})`;
        page.style.transformOrigin = "top left";
      } else {
        frame.style.removeProperty("width");
        frame.style.removeProperty("height");
        page.style.removeProperty("transform");
        page.style.removeProperty("transform-origin");
      }
    });
  }

  function render() {
    if (root.hidden) { needsRender = true; return; }
    needsRender = false;
    const token = ++renderToken;
    const source = document.createElement("div");
    source.className = "resume-page resume-page-measure";
    source.innerHTML = renderMarkdown(textarea.value);
    source
      .querySelectorAll<HTMLHeadingElement>("h1, h2, h3, h4, h5")
      .forEach((heading, index) => {
        heading.dataset.outlineIndex = String(index);
      });
    decorateAvatar(source);
    updateAvatarControls();
    // Keep the current pages on screen until the new layout is ready, otherwise
    // the preview blanks whenever a new glyph subset has to load.
    pages.querySelector(":scope > .resume-page-measure")?.remove();
    pages.append(source);

    updateFontStatus("loading");
    const stack = resumeFontStack(fontSelect.value);
    const text = source.textContent || "Aa 日本語 中文";
    // Explicitly load both weights and the glyph subsets before measuring pages.
    pendingRender = (async () => {
      try {
        await loadResumeFont(fontSelect.value);
        await Promise.all(
          [400, 700].map((weight) =>
            document.fonts.load(`${weight} 16px ${stack}`, text),
          ),
        );
        await document.fonts.ready;
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        if (token !== renderToken) return false;
        if (root.hidden) { needsRender = true; return false; }
        paginate(source, token);
        updateFontStatus("ready");
        return true;
      } catch {
        if (token === renderToken) {
          paginate(source, token);
          updateFontStatus("error");
        }
        return false;
      }
    })();
  }

  const previewResizeObserver = new ResizeObserver(syncPreviewPageScale);
  previewResizeObserver.observe(previewScroll);
  window.addEventListener("resize", syncPreviewPageScale);

  function persist() {
    localStorage.setItem(STORAGE_KEY, textarea.value);
  }

  document.addEventListener("keydown", (event) => {
    if (root.hidden) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
    }
  });

  let debounceTimer: ReturnType<typeof setTimeout>;
  textarea.addEventListener("input", () => {
    updateEditorOutline();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      render();
      persist();
    }, 150);
  });

  const saved = localStorage.getItem(STORAGE_KEY);
  textarea.value = saved && saved.trim().length > 0 ? saved : sampleText;
  applyLocale(currentLocale);
  applyTheme(localStorage.getItem(THEME_KEY) ?? "navy");
  applyFont(localStorage.getItem(FONT_KEY) ?? "noto-sans-jp");
  applyBackground(localStorage.getItem(BACKGROUND_KEY) ?? "paper");
  applyPageMargins(pageMarginTop, pageMarginBottom, false, false);
  syncAvatarEditor();
  render();


  fontSelect.addEventListener("change", () => {
    applyFont(fontSelect.value);
    localStorage.setItem(FONT_KEY, fontSelect.value);
    render();
  });

  themeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextTheme = button.dataset.themeOption ?? "navy";
      applyTheme(nextTheme);
      localStorage.setItem(THEME_KEY, nextTheme);
    });
  });

  backgroundButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextBackground = button.dataset.backgroundOption ?? "paper";
      applyBackground(nextBackground);
      localStorage.setItem(BACKGROUND_KEY, nextBackground);
    });
  });

  pageMarginTopInput.addEventListener("input", () => {
    applyPageMargins(Number(pageMarginTopInput.value), pageMarginBottom);
  });
  pageMarginBottomInput.addEventListener("input", () => {
    applyPageMargins(pageMarginTop, Number(pageMarginBottomInput.value));
  });
  resetPageMarginsButton.addEventListener("click", () => {
    applyPageMargins(DEFAULT_PAGE_MARGIN, DEFAULT_PAGE_MARGIN);
  });

  document.getElementById("load-sample")?.addEventListener("click", () => {
    if (!confirm(message("loadSampleConfirm"))) return;
    textarea.value = sampleText;
    updateEditorOutline();
    render();
    persist();
  });

  document.getElementById("clear-editor")?.addEventListener("click", () => {
    if (!confirm(message("clearConfirm"))) return;
    textarea.value = "";
    updateEditorOutline();
    render();
    persist();
  });

  let printing = false;
  async function savePdf() {
    if (printing) return;
    printing = true;
    try {
      clearTimeout(debounceTimer);
      persist();
      render();
      let latest: Promise<boolean>;
      let ready: boolean;
      do {
        latest = pendingRender;
        ready = await latest;
      } while (latest !== pendingRender);
      if (root.hidden) return;
      if (ready) printDocument(pdfTitle());
      else alert(message("fontError"));
    } finally {
      printing = false;
    }
  }

  function pdfTitle() {
    const documentName =
      pages.querySelector("h1")?.textContent?.trim() ||
      message("careerDocument");
    const authorName = pages
      .querySelector(".resume-heading-identity")
      ?.textContent?.trim()
      .split(/\r?\n/)[0]
      ?.trim();
    return authorName ? `${documentName}_${authorName}` : documentName;
  }
  document.getElementById("save-pdf")?.addEventListener("click", savePdf);


  copyAiPromptButton.addEventListener("click", async () => {
    const prompt = message("aiPrompt");
    let copied = false;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(prompt);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) {
      const fallback = document.createElement("textarea");
      fallback.value = prompt;
      fallback.setAttribute("readonly", "");
      fallback.style.position = "fixed";
      fallback.style.opacity = "0";
      document.body.appendChild(fallback);
      fallback.select();
      copied = document.execCommand("copy");
      fallback.remove();
    }

    if (copied) {
      copyAiPromptButton.textContent = message("promptCopied");
      window.setTimeout(() => {
        copyAiPromptButton.textContent = message("copyPrompt");
      }, 1800);
    }
  });

  document.getElementById("save-md")?.addEventListener("click", () => {
    const blob = new Blob([textarea.value], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resume.md";
    a.click();
    URL.revokeObjectURL(url);
  });

  document
    .getElementById("download-sample")
    ?.addEventListener("click", () => {
      const blob = new Blob([sampleText], {
        type: "text/markdown;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sample-resume.md";
      a.click();
      URL.revokeObjectURL(url);
    });

  const fileInput = document.getElementById("file-input") as HTMLInputElement;
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const current = textarea.value.trim();
      if (
        current &&
        current !== sampleText.trim() &&
        !confirm(message("openFileConfirm"))
      ) {
        return;
      }
      textarea.value = String(reader.result ?? "");
      updateEditorOutline();
      render();
      persist();
    };
    reader.readAsText(file);
    fileInput.value = "";
  });

  avatarInput.addEventListener("change", async () => {
    const file = avatarInput.files?.[0];
    avatarInput.value = "";
    if (!file) return;
    try {
      const nextAvatar = await optimizeAvatar(file);
      setAvatarEditorOpen(true, nextAvatar);
      updateAvatarControls("avatarPending");
    } catch {
      updateAvatarControls("avatarUploadFailed");
    }
  });

  clearAvatarButton.addEventListener("click", () => {
    localStorage.removeItem(AVATAR_KEY);
    localStorage.setItem(AVATAR_DEFAULT_DISMISSED_KEY, "true");
    avatarDataUrl = "";
    setAvatarEditorOpen(false);
    updateAvatarControls();
    render();
  });

  editAvatarButton.addEventListener("click", () => {
    setAvatarEditorOpen(true);
  });

  closeAvatarEditorButton.addEventListener("click", () => {
    setAvatarEditorOpen(false);
  });

  cancelAvatarEditorButton.addEventListener("click", () => {
    setAvatarEditorOpen(false);
  });

  saveAvatarEditorButton.addEventListener("click", () => {
    saveAvatarEditor();
  });

  avatarEditor.addEventListener("click", (event) => {
    if (event.target === avatarEditor) setAvatarEditorOpen(false);
  });

  avatarEditor.addEventListener("cancel", (event) => {
    event.preventDefault();
    setAvatarEditorOpen(false);
  });

  avatarZoomInput.addEventListener("input", () => {
    avatarDraftZoom = Math.min(
      240,
      Math.max(100, Number(avatarZoomInput.value)),
    );
    syncAvatarEditor();
  });

  avatarEditorSourceImage.addEventListener("load", syncAvatarEditor);
  avatarEditorImage.addEventListener("load", syncAvatarEditor);

  avatarShapeInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (
        input.checked &&
        (input.value === "rectangle" || input.value === "circle")
      ) {
        avatarDraftShape = input.value;
        syncAvatarEditor();
      }
    });
  });

  return {
    activate() { if (needsRender) render(); else syncPreviewPageScale(); },
    deactivate() { persist(); },
    setLocale: applyLocale,
  };
}
