"use client";

import { useQuery } from "@tanstack/react-query";
import { getDocumentPagePreview } from "@/lib/api";

interface PagePreviewModalProps {
  docId: string;
  pageNumber: number | null;
  conceptName?: string;
  onChangePage: (nextPage: number) => void;
  onClose: () => void;
  onViewInGraph?: () => void;
}

export function PagePreviewModal({
  docId,
  pageNumber,
  conceptName,
  onChangePage,
  onClose,
  onViewInGraph,
}: PagePreviewModalProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["page-preview", docId, pageNumber],
    queryFn: () => getDocumentPagePreview(docId, pageNumber!),
    enabled: pageNumber !== null && pageNumber > 0,
  });

  if (pageNumber === null) return null;

  const isUnlinked = pageNumber <= 0;
  const totalPages = data?.total_pages ?? 45;
  const prevPage = pageNumber > 1 ? pageNumber - 1 : null;
  const nextPage = pageNumber < totalPages ? pageNumber + 1 : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0B1F4B]/45 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-page-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-[540px] flex-col rounded-t-[20px] sm:rounded-[20px] bg-white shadow-xl border border-[#DCE3F0] overflow-hidden"
      >
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-[#DCE3F0] sm:hidden" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
          <div>
            <h2
              id="preview-page-title"
              className="font-display text-lg font-bold text-[#0B1F4B]"
            >
              {isUnlinked
                ? "Sumber PDF"
                : `Halaman ${pageNumber} dari ${totalPages}`}
            </h2>
            <p className="text-xs text-[#4A5B7D]">
              {data?.filename ?? "Dokumen aktif"}
            </p>
          </div>
          <button
            type="button"
            aria-label="Tutup preview halaman"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-[#F6F8FC] text-[#0B1F4B] hover:bg-[#EEF3FC]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 3L13 13M13 3L3 13"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Navigation strip */}
        {!isUnlinked && (
          <div className="flex items-center justify-between gap-2 border-y border-[#DCE3F0] bg-[#F6F8FC] px-4 py-2">
            <button
              type="button"
              disabled={!prevPage}
              onClick={() => prevPage && onChangePage(prevPage)}
              className="min-h-[40px] rounded-lg border border-[#DCE3F0] bg-white px-3 text-xs font-semibold text-[#0B1F4B] disabled:opacity-40"
            >
              &lt; {prevPage ? `Hlm. ${prevPage}` : "Awal"}
            </button>

            {conceptName && (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#DCE3F0] bg-white px-3 py-1 text-xs font-semibold text-[#0B1F4B] max-w-[180px] truncate">
                <span className="h-2 w-2 rounded-full bg-[#FF6B6B] shrink-0" />
                <span className="truncate">Konsep: {conceptName}</span>
              </div>
            )}

            <button
              type="button"
              disabled={!nextPage}
              onClick={() => nextPage && onChangePage(nextPage)}
              className="min-h-[40px] rounded-lg border border-[#DCE3F0] bg-white px-3 text-xs font-semibold text-[#0B1F4B] disabled:opacity-40"
            >
              {nextPage ? `Hlm. ${nextPage}` : "Akhir"} &gt;
            </button>
          </div>
        )}

        {/* Viewport */}
        <div className="flex-1 overflow-y-auto p-4">
          {isUnlinked ? (
            <div className="rounded-xl border border-[#DCE3F0] bg-[#F8FAFF] p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-[#92400E]">
                Halaman belum ditautkan
              </p>
              <h3 className="mt-1 font-display text-base font-bold text-[#0B1F4B]">
                Nomor halaman belum diverifikasi
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#4A5B7D]">
                Konsep ini belum memiliki nomor halaman terverifikasi pada sesi
                contoh. Unggah PDF kuliahmu untuk melihat isi halaman sumber
                secara langsung.
              </p>
            </div>
          ) : isLoading ? (
            <div className="rounded-xl border border-[#DCE3F0] bg-[#F8FAFF] p-6 animate-pulse">
              <div className="h-4 w-1/2 rounded bg-[#DCE3F0]" />
              <div className="mt-4 h-24 w-full rounded bg-[#DCE3F0]" />
            </div>
          ) : (
            <div className="rounded-xl border border-[#DCE3F0] bg-[#F8FAFF] p-3">
              <div className="rounded-lg border border-[#DCE3F0] bg-white p-5 shadow-xs">
                {data?.eyebrow && (
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#4A5B7D]">
                    {data.eyebrow}
                  </p>
                )}
                <h3 className="mt-1 font-display text-lg font-bold text-[#0B1F4B]">
                  {data?.title ?? `Halaman ${pageNumber}`}
                </h3>
                <hr className="my-3 border-[#DCE3F0]" />

                {data?.highlight_quote && (
                  <div className="mb-3 rounded-md bg-[#FEF3C7] px-3 py-2.5 text-sm font-semibold text-[#0B1F4B]">
                    {data.highlight_quote}
                  </div>
                )}

                <p className="whitespace-pre-line text-sm leading-relaxed text-[#0B1F4B]">
                  {data?.text}
                </p>

                {data?.is_demo_preview && pageNumber === 4 && (
                  <div className="mt-4 rounded-[10px] border border-[#DCE3F0] bg-[#F8FAFF] p-4">
                    <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[#0B1F4B]">
                      <span className="rounded-lg border border-[#0369A1] bg-white px-3 py-2">
                        View
                      </span>
                      <span className="text-[#15367A]">↔</span>
                      <span className="rounded-lg border border-[#15367A] bg-[#FF6B6B] px-3 py-2 font-bold">
                        Controller
                      </span>
                      <span className="text-[#15367A]">↔</span>
                      <span className="rounded-lg border border-[#0369A1] bg-white px-3 py-2">
                        Model
                      </span>
                    </div>
                  </div>
                )}

                <p className="mt-4 text-right text-[11px] font-medium text-[#4A5B7D]">
                  Slide {pageNumber}
                </p>
              </div>
              {data?.is_demo_preview && (
                <p className="mt-2 px-1 text-[11px] text-[#4A5B7D]">
                  Pratinjau materi contoh · 10 - MVC part 1.pdf
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="grid grid-cols-2 gap-3 border-t border-[#DCE3F0] bg-white p-4">
          <button
            type="button"
            onClick={() => {
              onClose();
              onViewInGraph?.();
            }}
            className="min-h-[46px] rounded-[10px] border-[1.5px] border-[#15367A] bg-white px-4 text-sm font-bold text-[#0B1F4B] hover:bg-[#EEF3FC]"
          >
            Lihat di graf
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[46px] rounded-[10px] bg-[#15367A] px-4 text-sm font-bold text-white hover:bg-[#0B1F4B]"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
