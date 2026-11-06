// Browsers suggest the document title as the PDF file name, so use the resume's
// own name for the duration of the print dialog.
export function printDocument(title: string) {
  const previousTitle = document.title;
  window.addEventListener(
    "afterprint",
    () => {
      document.title = previousTitle;
    },
    { once: true },
  );
  document.title = title;
  window.print();
}
