"use client";

export const MAX_PDF_BYTES = 20 * 1024 * 1024;
export const MAX_PDF_PAGES = 60;
export const MIN_MEANINGFUL_CHARS = 25;

export interface PdfValidationSuccess {
  ok: true;
  filename: string;
  fileSizeBytes: number;
  totalPages: number;
  skippedPages: number;
  pageTexts: Record<number, string>;
}

export interface PdfValidationFailure {
  ok: false;
  errorType: "invalid_type" | "size_limit" | "page_limit" | "scan_pdf";
  title: string;
  message: string;
}

export type PdfValidationResult = PdfValidationSuccess | PdfValidationFailure;

export function formatMegabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1).replace(".", ",")} MB`;
}

export async function validatePdfFile(file: File): Promise<PdfValidationResult> {
  const isPdf =
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf");

  if (!isPdf) {
    return {
      ok: false,
      errorType: "invalid_type",
      title: "Format file harus PDF",
      message:
        "Pilih satu file .pdf berteks (maks. 20 MB dan 60 halaman) dari slide atau modul kuliah.",
    };
  }

  if (file.size > MAX_PDF_BYTES) {
    return {
      ok: false,
      errorType: "size_limit",
      title: `File terlalu besar: ${formatMegabytes(file.size)}`,
      message:
        "Batasnya 20 MB dan 60 halaman. Pisahkan per bab atau kompres PDF-nya, lalu unggah lagi.",
    };
  }

  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }

  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;

  if (totalPages > MAX_PDF_PAGES) {
    return {
      ok: false,
      errorType: "page_limit",
      title: `Terlalu banyak halaman: ${totalPages} halaman`,
      message:
        "Batasnya 20 MB dan 60 halaman. Pisahkan per bab atau pilih bagian materinya saja, lalu unggah lagi.",
    };
  }

  const pageTexts: Record<number, string> = {};
  let readablePages = 0;
  let skippedPages = 0;

  for (let pageNum = 1; pageNum <= totalPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    pageTexts[pageNum] = text;
    if (text.length >= MIN_MEANINGFUL_CHARS) {
      readablePages += 1;
    } else {
      skippedPages += 1;
    }
  }

  if (readablePages === 0) {
    return {
      ok: false,
      errorType: "scan_pdf",
      title: "PDF ini tidak punya teks yang bisa dibaca",
      message:
        "Kemungkinan hasil scan atau foto. Ekspor ulang slide sebagai PDF dari PowerPoint atau Google Slides, lalu unggah lagi.",
    };
  }

  return {
    ok: true,
    filename: file.name,
    fileSizeBytes: file.size,
    totalPages,
    skippedPages,
    pageTexts,
  };
}
