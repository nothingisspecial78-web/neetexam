// Browser-only: reads txt/md directly, text PDFs with pdf.js (loaded on demand).
import { normalizePdfText } from "./pdf-text";
export async function extractText(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "txt" || ext === "md") return file.text();
  if (ext !== "pdf") throw new Error("نوع الملف غير مدعوم");

  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
  const doc = await loadingTask.promise;
  let text = "";
  try {
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if ("str" in item) text += item.str + (item.hasEOL ? "\n" : " ");
    }
    text += "\n";
  }
  } finally { await loadingTask.destroy(); }
  if (!text.trim()) throw new Error("هذا الملف لا يحتوي على نص، ارفع ملف PDF نصيًا");
  return normalizePdfText(text);
}
