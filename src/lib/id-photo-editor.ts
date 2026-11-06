export type IdPhotoCrop = { src: string; zoom: number; x: number; y: number; position: number };

export function initIdPhotoEditor(onSave: (photo: IdPhotoCrop) => void, onError: () => void) {
  const dialog = document.getElementById("r-avatar-editor") as HTMLDialogElement;
  const stage = document.getElementById("r-avatar-editor-stage")!;
  const crop = document.getElementById("r-avatar-editor-crop-window")!;
  const image = document.getElementById("r-avatar-editor-image") as HTMLImageElement;
  const source = document.getElementById("r-avatar-editor-source-image") as HTMLImageElement;
  const zoom = document.getElementById("r-avatar-zoom") as HTMLInputElement;
  const zoomValue = document.getElementById("r-avatar-zoom-value") as HTMLOutputElement;
  const save = document.getElementById("save-r-avatar-editor") as HTMLButtonElement;
  let draft: IdPhotoCrop = { src: "", zoom: 100, x: 0, y: 0, position: 50 };
  let pointer: number | null = null;
  let dragStart = { x: 0, y: 0, offsetX: 0, offsetY: 0 };
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  function sync() {
    if (!dialog.open) return;
    const width = crop.clientWidth, height = crop.clientHeight;
    const factor = draft.zoom / 100;
    const x = draft.x / 100 * width, y = draft.y / 100 * height;
    crop.style.setProperty("--avatar-offset-x", `${x}px`);
    crop.style.setProperty("--avatar-offset-y", `${y}px`);
    crop.style.setProperty("--avatar-zoom", String(factor));
    image.style.objectFit = "cover";
    image.style.objectPosition = `50% ${draft.position}%`;
    if (image.naturalWidth && image.naturalHeight) {
      const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
      const fullWidth = image.naturalWidth * scale, fullHeight = image.naturalHeight * scale;
      // Match the uncropped, dimmed image to the crop, including old vertical-position settings.
      source.style.width = `${fullWidth}px`;
      source.style.height = `${fullHeight}px`;
      source.style.setProperty("--avatar-offset-x", `${x}px`);
      source.style.setProperty("--avatar-offset-y", `${y + (draft.position / 100 - .5) * (height - fullHeight) * factor}px`);
      source.style.setProperty("--avatar-source-zoom", String(factor));
    }
    zoom.value = String(draft.zoom);
    zoomValue.value = `${draft.zoom}%`;
    save.disabled = !image.complete || !image.naturalWidth;
  }
  function finishDrag() {
    if (pointer !== null && stage.hasPointerCapture(pointer)) stage.releasePointerCapture(pointer);
    pointer = null; stage.classList.remove("is-dragging");
  }
  function close() { finishDrag(); if (dialog.open) dialog.close(); }
  function open(photo: IdPhotoCrop) {
    draft = { ...photo };
    save.disabled = true;
    image.src = photo.src; source.src = photo.src;
    if (!dialog.open) dialog.showModal();
    sync();
    stage.focus();
  }
  image.addEventListener("load", sync);
  image.addEventListener("error", () => { close(); onError(); });
  dialog.addEventListener("close", () => { finishDrag(); image.removeAttribute("src"); source.removeAttribute("src"); });
  dialog.addEventListener("cancel", event => { event.preventDefault(); close(); });
  dialog.addEventListener("click", event => { if (event.target === dialog) close(); });
  document.getElementById("close-r-avatar-editor")!.addEventListener("click", close);
  document.getElementById("cancel-r-avatar-editor")!.addEventListener("click", close);
  save.addEventListener("click", () => { if (save.disabled) return; onSave({ ...draft }); close(); });
  zoom.addEventListener("input", () => { draft.zoom = clamp(Number(zoom.value), 100, 240); sync(); });
  stage.addEventListener("pointerdown", event => {
    if (event.button !== 0 || pointer !== null) return;
    pointer = event.pointerId;
    dragStart = { x: event.clientX, y: event.clientY, offsetX: draft.x, offsetY: draft.y };
    stage.setPointerCapture(pointer); stage.classList.add("is-dragging"); event.preventDefault();
  });
  stage.addEventListener("pointermove", event => {
    if (pointer !== event.pointerId) return;
    const bounds = crop.getBoundingClientRect();
    draft.x = clamp(dragStart.offsetX + (event.clientX - dragStart.x) / bounds.width * 100, -100, 100);
    draft.y = clamp(dragStart.offsetY + (event.clientY - dragStart.y) / bounds.height * 100, -100, 100);
    sync(); event.preventDefault();
  });
  stage.addEventListener("pointerup", finishDrag);
  stage.addEventListener("pointercancel", finishDrag);
  stage.addEventListener("wheel", event => {
    draft.zoom = clamp(draft.zoom + (event.deltaY < 0 ? 5 : -5), 100, 240);
    sync(); event.preventDefault();
  }, { passive: false });
  stage.addEventListener("keydown", event => {
    const step = event.shiftKey ? 5 : 1;
    if (event.key === "ArrowLeft") draft.x = clamp(draft.x - step, -100, 100);
    else if (event.key === "ArrowRight") draft.x = clamp(draft.x + step, -100, 100);
    else if (event.key === "ArrowUp") draft.y = clamp(draft.y - step, -100, 100);
    else if (event.key === "ArrowDown") draft.y = clamp(draft.y + step, -100, 100);
    else if (["+", "="].includes(event.key)) draft.zoom = clamp(draft.zoom + 5, 100, 240);
    else if (event.key === "-") draft.zoom = clamp(draft.zoom - 5, 100, 240);
    else return;
    sync(); event.preventDefault();
  });
  new ResizeObserver(sync).observe(stage);
  return { open, close };
}
