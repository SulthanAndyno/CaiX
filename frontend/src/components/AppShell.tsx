"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { deleteDocument } from "@/lib/api";
import type { DocumentSummary } from "@/types/caix";

export type AppStep = 1 | 2 | 3 | 4;

interface AppShellProps {
  activeStep: AppStep;
  document?: DocumentSummary | null;
  inQuiz?: boolean;
  hasQuizResult?: boolean;
  onRequestExitQuiz?: (targetHref: string) => void;
  children: ReactNode;
}

const STEPS: { step: AppStep; label: string }[] = [
  { step: 1, label: "Unggah" },
  { step: 2, label: "Graf" },
  { step: 3, label: "Kuis" },
  { step: 4, label: "Hasil" },
];

export function AppShell({
  activeStep,
  document,
  inQuiz = false,
  hasQuizResult = false,
  onRequestExitQuiz,
  children,
}: AppShellProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [replaceWarningOpen, setReplaceWarningOpen] = useState(false);

  const docId = document?.id;

  const getStepHref = (step: AppStep): string | null => {
    if (step === 1) return "/";
    if (!docId) return null;
    if (step === 2) return `/graph/${docId}`;
    if (step === 3) return `/quiz/${docId}`;
    if (step === 4) return `/result/${docId}`;
    return null;
  };

  const handleNavigate = (href: string | null) => {
    if (!href) return;
    if (inQuiz && onRequestExitQuiz) {
      onRequestExitQuiz(href);
      return;
    }
    router.push(href);
  };

  const handleConfirmDelete = async () => {
    if (!docId) return;
    setDeleting(true);
    try {
      await deleteDocument(docId);
      setConfirmDeleteOpen(false);
      setMenuOpen(false);
      router.push("/");
    } finally {
      setDeleting(false);
    }
  };

  const handleReplacePdf = () => {
    setMenuOpen(false);
    if (inQuiz) {
      setReplaceWarningOpen(true);
      return;
    }
    router.push("/");
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F8FC] text-[#0B1F4B]">
      {/* Top Header (56px) */}
      <header className="sticky top-0 z-30 h-14 bg-white border-b border-[#DCE3F0]">
        <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              onClick={(e) => {
                if (inQuiz && onRequestExitQuiz) {
                  e.preventDefault();
                  onRequestExitQuiz("/");
                }
              }}
              className="font-display text-xl font-bold tracking-tight text-[#15367A]"
            >
              CaiX
            </Link>

            {document && (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-[#F6F8FC] border border-[#DCE3F0] px-3 py-1 text-xs font-medium text-[#4A5B7D] max-w-[260px] truncate">
                <span className="h-2 w-2 rounded-full bg-[#15803D] shrink-0" />
                <span className="truncate">{document.filename}</span>
              </span>
            )}
          </div>

          {/* Desktop Stepper (1440px) — replaces bottom nav on desktop */}
          <nav
            aria-label="Tahapan belajar"
            className="hidden lg:flex items-center gap-2"
          >
            {STEPS.map(({ step, label }, index) => {
              const isDone = step < activeStep || (step === 4 && hasQuizResult && activeStep === 4);
              const isCurrent = step === activeStep;
              const href = getStepHref(step);
              const disabled = !href;

              return (
                <div key={step} className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => handleNavigate(href)}
                    className={`min-h-[44px] inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                      isCurrent
                        ? "bg-[#EEF3FC] font-bold text-[#0B1F4B]"
                        : disabled
                          ? "cursor-not-allowed text-[#4A5B7D]/60"
                          : "font-medium text-[#4A5B7D] hover:bg-[#F6F8FC] hover:text-[#0B1F4B]"
                    }`}
                  >
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        isCurrent || isDone
                          ? "bg-[#15367A] text-white"
                          : "border border-[#DCE3F0] bg-white text-[#4A5B7D]"
                      }`}
                    >
                      {step < activeStep ? "✓" : step}
                    </span>
                    <span>{label}</span>
                  </button>
                  {index < STEPS.length - 1 && (
                    <span className="h-px w-5 bg-[#DCE3F0]" aria-hidden="true" />
                  )}
                </div>
              );
            })}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-1">
            {inQuiz && docId && (
              <button
                type="button"
                onClick={() => handleNavigate(`/graph/${docId}`)}
                className="min-h-[44px] rounded-lg px-3 text-sm font-semibold text-[#0369A1] hover:bg-[#F6F8FC]"
              >
                Keluar
              </button>
            )}
            {document && (
              <button
                type="button"
                aria-label="Menu dokumen"
                onClick={() => setMenuOpen(true)}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-[#0B1F4B] hover:bg-[#F6F8FC]"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <circle cx="10" cy="4" r="1.8" />
                  <circle cx="10" cy="10" r="1.8" />
                  <circle cx="10" cy="16" r="1.8" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 pb-20 lg:pb-6">{children}</main>

      {/* Mobile Bottom Navigation (390px) */}
      <nav
        aria-label="Navigasi langkah"
        className="fixed bottom-0 inset-x-0 z-30 h-[72px] bg-white border-t border-[#DCE3F0] lg:hidden"
      >
        <div className="mx-auto grid h-full max-w-[480px] grid-cols-4">
          {STEPS.map(({ step, label }) => {
            const isCompleted = step < activeStep;
            const isCurrent = step === activeStep;
            const href = getStepHref(step);
            const disabled = !href;

            return (
              <button
                key={step}
                type="button"
                disabled={disabled}
                onClick={() => handleNavigate(href)}
                className="flex flex-col items-center justify-center gap-1 min-h-[44px] px-1 disabled:opacity-60"
              >
                <span
                  className={`flex h-[26px] w-[26px] items-center justify-center rounded-full text-xs font-bold ${
                    isCurrent || isCompleted
                      ? "bg-[#15367A] text-white"
                      : "border-[1.5px] border-[#DCE3F0] bg-white text-[#4A5B7D]"
                  }`}
                >
                  {isCompleted ? (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M2.5 6L5 8.5L9.5 3.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    step
                  )}
                </span>
                <span
                  className={`text-xs ${
                    isCurrent
                      ? "font-bold text-[#0B1F4B]"
                      : "font-medium text-[#4A5B7D]"
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Document Bottom Sheet / Modal Menu (⋮) */}
      {menuOpen && document && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0B1F4B]/45 p-0 sm:p-4"
          onClick={() => setMenuOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="doc-menu-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[420px] rounded-t-[20px] sm:rounded-[20px] bg-white p-5 shadow-xl border border-[#DCE3F0]"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#DCE3F0] sm:hidden" />
            <p className="text-xs font-semibold uppercase tracking-wide text-[#4A5B7D]">
              Dokumen aktif
            </p>
            <h2
              id="doc-menu-title"
              className="mt-1 font-display text-lg font-bold text-[#0B1F4B] break-words"
            >
              {document.filename}
            </h2>
            <p className="mt-0.5 text-sm text-[#4A5B7D]">
              {inQuiz
                ? "Jawaban aman selama menu terbuka."
                : `${document.total_pages} halaman · sesi satu PDF`}
            </p>

            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleReplacePdf}
                className="min-h-[46px] w-full rounded-[10px] border border-[#DCE3F0] bg-[#F6F8FC] px-4 text-left text-sm font-semibold text-[#0B1F4B] hover:bg-[#EEF3FC]"
              >
                Ganti PDF
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setConfirmDeleteOpen(true);
                }}
                className="min-h-[46px] w-full rounded-[10px] border border-[#FECACA] bg-[#FEE2E2] px-4 text-left text-sm font-semibold text-[#B91C1C] hover:bg-[#FECACA]/60"
              >
                Hapus dokumen
              </button>
              {inQuiz && docId && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    handleNavigate(`/graph/${docId}`);
                  }}
                  className="min-h-[46px] w-full rounded-[10px] border border-[#DCE3F0] bg-white px-4 text-left text-sm font-semibold text-[#0B1F4B] hover:bg-[#F6F8FC]"
                >
                  Kembali ke graf
                </button>
              )}
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="min-h-[46px] w-full rounded-[10px] bg-[#15367A] px-4 text-center text-sm font-bold text-white hover:bg-[#0B1F4B]"
              >
                {inQuiz ? "Lanjutkan kuis" : "Kembali ke layar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Ganti PDF Saat Kuis */}
      {replaceWarningOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1F4B]/45 p-4"
          onClick={() => setReplaceWarningOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[360px] rounded-2xl bg-white p-6 shadow-xl border border-[#DCE3F0]"
          >
            <h3 className="font-display text-lg font-bold text-[#0B1F4B]">
              Ganti PDF sekarang?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#4A5B7D]">
              Mengganti PDF akan mengakhiri kuis dan mereset jawaban sesi ini.
              Kamu perlu memulai kuis baru.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setReplaceWarningOpen(false)}
                className="min-h-[44px] rounded-[10px] border border-[#DCE3F0] bg-white px-3 text-sm font-semibold text-[#0B1F4B]"
              >
                Lanjutkan kuis
              </button>
              <button
                type="button"
                onClick={() => {
                  setReplaceWarningOpen(false);
                  router.push("/");
                }}
                className="min-h-[44px] rounded-[10px] bg-[#15367A] px-3 text-sm font-bold text-white"
              >
                Ya, ganti PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Permanen (07-modal-konfirmasi-hapus) */}
      {confirmDeleteOpen && document && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1F4B]/45 p-4"
          onClick={() => !deleting && setConfirmDeleteOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[360px] rounded-2xl bg-white p-6 shadow-xl border border-[#DCE3F0]"
          >
            <h3 className="font-display text-lg font-bold text-[#0B1F4B]">
              Hapus dokumen ini?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#4A5B7D]">
              File <strong className="text-[#0B1F4B]">{document.filename}</strong>{" "}
              beserta peta konsep dan riwayat kuisnya akan dihapus permanen dan
              tidak bisa dikembalikan.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDeleteOpen(false)}
                className="min-h-[44px] rounded-[10px] border border-[#DCE3F0] bg-white px-4 text-sm font-semibold text-[#0B1F4B] hover:bg-[#F6F8FC]"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="min-h-[44px] rounded-[10px] bg-[#B91C1C] px-4 text-sm font-bold text-white hover:bg-[#991B1B] disabled:opacity-60"
              >
                {deleting ? "Menghapus..." : "Ya, hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
