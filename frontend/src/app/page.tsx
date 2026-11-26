"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type DragEvent } from "react";
import { AppShell } from "@/components/AppShell";
import {
  ApiError,
  isUsingMockApi,
  startDemoDocument,
  uploadPdfDocument,
} from "@/lib/api";
import { formatMegabytes, validatePdfFile } from "@/lib/pdf-validator";

type UploadScreenState =
  | { kind: "idle" }
  | {
      kind: "validating";
      filename: string;
      sizeBytes: number;
    }
  | {
      kind: "uploading";
      filename: string;
      sizeBytes: number;
      totalPages: number;
      progress: number;
    }
  | {
      kind: "error";
      title: string;
      message: string;
    }
  | {
      kind: "queue_busy";
      pendingFile: File;
    };

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  const [state, setState] = useState<UploadScreenState>({ kind: "idle" });
  const [isDragging, setIsDragging] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [simulateCheckpointPause, setSimulateCheckpointPause] = useState(false);

  const processSelectedFile = async (file: File) => {
    cancelRef.current = false;
    setState({
      kind: "validating",
      filename: file.name,
      sizeBytes: file.size,
    });

    try {
      const result = await validatePdfFile(file);
      if (cancelRef.current) {
        setState({ kind: "idle" });
        return;
      }

      if (!result.ok) {
        setState({
          kind: "error",
          title: result.title,
          message: result.message,
        });
        return;
      }

      // Show uploading progress & 4-item checklist matching Figma (HP / 1a Mengunggah)
      setState({
        kind: "uploading",
        filename: result.filename,
        sizeBytes: result.fileSizeBytes,
        totalPages: result.totalPages,
        progress: 24,
      });

      await new Promise((r) => setTimeout(r, 260));
      if (cancelRef.current) {
        setState({ kind: "idle" });
        return;
      }
      setState({
        kind: "uploading",
        filename: result.filename,
        sizeBytes: result.fileSizeBytes,
        totalPages: result.totalPages,
        progress: 62,
      });

      const uploaded = await uploadPdfDocument({
        file,
        totalPages: result.totalPages,
        skippedPages: result.skippedPages,
        pageTexts: result.pageTexts,
        simulatePause: simulateCheckpointPause,
      });

      if (cancelRef.current) {
        setState({ kind: "idle" });
        return;
      }

      setState({
        kind: "uploading",
        filename: result.filename,
        sizeBytes: result.fileSizeBytes,
        totalPages: result.totalPages,
        progress: 100,
      });
      await new Promise((r) => setTimeout(r, 180));
      router.push(`/process/${uploaded.job_id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setState({ kind: "queue_busy", pendingFile: file });
        return;
      }
      setState({
        kind: "error",
        title: "Gagal membaca file PDF",
        message:
          err instanceof Error
            ? err.message
            : "Pastikan file PDF valid dan tidak terkunci kata sandi.",
      });
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processSelectedFile(file);
    }
  };

  const handleLoadDemo = async () => {
    setLoadingDemo(true);
    try {
      const demo = await startDemoDocument();
      router.push(`/graph/${demo.document_id}`);
    } finally {
      setLoadingDemo(false);
    }
  };

  const handleCancelUpload = () => {
    cancelRef.current = true;
    setState({ kind: "idle" });
  };

  return (
    <AppShell activeStep={1}>
      <div className="mx-auto max-w-[1040px] px-5 pt-7 pb-10 lg:pt-12">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
          {/* Hero Copy */}
          <div className="lg:col-span-5 lg:pt-4">
            <h1 className="font-display text-[26px] leading-[1.25] font-bold text-[#0B1F4B] lg:text-[32px]">
              Peta konsep dan kuis dari satu PDF kuliah
            </h1>
            <p className="mt-3 text-sm leading-[1.55] text-[#4A5B7D] lg:text-base">
              Unggah slide atau modul. CaiX menarik konsep utamanya, menunjukkan
              hubungannya, lalu mengujimu dengan soal yang tertaut ke halaman
              sumber.
            </p>

            {/* Privacy note (desktop placement) */}
            <div className="mt-6 hidden lg:flex items-start gap-2.5 text-sm text-[#4A5B7D]">
              <svg
                className="mt-0.5 shrink-0"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <rect
                  x="3"
                  y="7"
                  width="10"
                  height="7"
                  rx="1.5"
                  stroke="#4A5B7D"
                  strokeWidth="1.5"
                />
                <path
                  d="M5 7V5a3 3 0 0 1 6 0v2"
                  stroke="#4A5B7D"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <span>
                File disimpan privat dan bisa kamu hapus kapan saja.
              </span>
            </div>
          </div>

          {/* Interactive Upload Area */}
          <div className="lg:col-span-7">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void processSelectedFile(file);
                }
                e.target.value = "";
              }}
            />

            {/* State: Idle or Validating */}
            {(state.kind === "idle" || state.kind === "validating") && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`rounded-2xl border-[1.5px] border-dashed px-5 py-7 text-center transition-colors ${
                  isDragging
                    ? "border-[#0369A1] bg-[#EEF3FC]"
                    : "border-[#15367A] bg-white"
                }`}
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF3FC] text-[#15367A]">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 16V5M12 5L7 10M12 5L17 10M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <p className="mt-4 text-[13px] text-[#4A5B7D]">
                  {state.kind === "validating"
                    ? `Memeriksa ${state.filename} (${formatMegabytes(state.sizeBytes)})...`
                    : "Satu PDF berteks, maks. 20 MB dan 60 halaman"}
                </p>

                <button
                  type="button"
                  disabled={state.kind === "validating"}
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 min-h-[46px] w-full max-w-[320px] rounded-[10px] bg-[#FF6B6B] px-6 text-[15px] font-bold text-[#0B1F4B] transition hover:brightness-95 disabled:opacity-60"
                >
                  {state.kind === "validating"
                    ? "Memeriksa teks PDF..."
                    : "Pilih file PDF"}
                </button>
              </div>
            )}

            {/* State: Uploading (progress % + 4-item checklist) */}
            {state.kind === "uploading" && (
              <div className="rounded-2xl border border-[#DCE3F0] bg-white p-5 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-display text-base font-bold text-[#0B1F4B]">
                      {state.filename}
                    </p>
                    <p className="mt-0.5 text-xs text-[#4A5B7D]">
                      {formatMegabytes(state.sizeBytes)} · {state.totalPages}{" "}
                      halaman · Mengunggah ke penyimpanan privat
                    </p>
                  </div>
                  <span className="shrink-0 font-display text-base font-bold text-[#15367A]">
                    {state.progress}%
                  </span>
                </div>

                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#EEF3FC]">
                  <div
                    className="h-full rounded-full bg-[#15367A] transition-all duration-300"
                    style={{ width: `${state.progress}%` }}
                  />
                </div>

                <ul className="mt-4 space-y-2 text-xs text-[#0B1F4B]">
                  <li className="flex items-center gap-2">
                    <span className="text-[#15803D] font-bold">✓</span>
                    <span>PDF memiliki teks yang dapat dibaca</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[#15803D] font-bold">✓</span>
                    <span>
                      {formatMegabytes(state.sizeBytes)} · di bawah batas 20 MB
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[#15803D] font-bold">✓</span>
                    <span>
                      {state.totalPages} halaman · di bawah batas 60 halaman
                    </span>
                  </li>
                  <li className="flex items-center gap-2 text-[#4A5B7D]">
                    <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-[#15367A]" />
                    <span>Menyimpan ke penyimpanan privat</span>
                  </li>
                </ul>

                <button
                  type="button"
                  onClick={handleCancelUpload}
                  className="mt-5 min-h-[44px] w-full rounded-[10px] border border-[#DCE3F0] bg-white px-4 text-sm font-semibold text-[#4A5B7D] hover:bg-[#F6F8FC]"
                >
                  Batalkan unggahan
                </button>
              </div>
            )}

            {/* State: Validation Error (Scan or Size/Page Limit) */}
            {state.kind === "error" && (
              <div className="rounded-2xl border-[1.5px] border-[#B91C1C] bg-[#FEE2E2] p-5">
                <h2 className="font-display text-base font-bold text-[#B91C1C]">
                  {state.title}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-[#0B1F4B]">
                  {state.message}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setState({ kind: "idle" });
                    fileInputRef.current?.click();
                  }}
                  className="mt-4 min-h-[44px] w-full rounded-[10px] bg-white border border-[#B91C1C] px-4 text-sm font-bold text-[#B91C1C] hover:bg-[#FEE2E2]/40"
                >
                  Pilih file lain
                </button>
              </div>
            )}

            {/* State: Queue Busy (HTTP 429) */}
            {state.kind === "queue_busy" && (
              <div className="rounded-2xl border-[1.5px] border-[#92400E] bg-[#FEF3C7] p-5">
                <h2 className="font-display text-base font-bold text-[#92400E]">
                  Antrean sedang penuh
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-[#0B1F4B]">
                  CaiX memproses satu dokumen dalam satu waktu. Coba lagi
                  sekitar 1 menit lagi.
                </p>
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => void processSelectedFile(state.pendingFile)}
                    className="min-h-[44px] flex-1 rounded-[10px] bg-[#15367A] px-4 text-sm font-bold text-white"
                  >
                    Coba lagi
                  </button>
                  <button
                    type="button"
                    onClick={() => setState({ kind: "idle" })}
                    className="min-h-[44px] rounded-[10px] border border-[#DCE3F0] bg-white px-4 text-sm font-semibold text-[#0B1F4B]"
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}

            {/* Sample Demo Card (01-unggah-materi-contoh.svg) */}
            <button
              type="button"
              disabled={loadingDemo}
              onClick={handleLoadDemo}
              className="mt-3.5 flex min-h-[52px] w-full items-center gap-3 rounded-xl border border-[#DCE3F0] bg-white px-3.5 py-2.5 text-left transition hover:border-[#0369A1] hover:bg-[#F8FAFF] disabled:opacity-60"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-[#F6F8FC] text-[#15367A]">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M4 2h5l3 3v9H4V2zm5 0v3h3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-xs text-[#4A5B7D]">
                  Belum siap PDF?
                </span>
                <span className="block truncate text-[13px] font-semibold text-[#0369A1]">
                  {loadingDemo
                    ? "Memuat materi contoh..."
                    : "Coba materi contoh (10 - MVC part 1.pdf)"}
                </span>
              </span>
              <svg
                className="shrink-0 text-[#0369A1]"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M6 3l5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {/* Optional checkpoint simulation switch in mock mode */}
            {isUsingMockApi && (
              <label className="mt-3 flex items-center gap-2 text-xs text-[#4A5B7D] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={simulateCheckpointPause}
                  onChange={(e) =>
                    setSimulateCheckpointPause(e.target.checked)
                  }
                  className="h-4 w-4 rounded border-[#DCE3F0] accent-[#15367A]"
                />
                <span>
                  Mode demo: simulasikan jeda server AI di tengah pemrosesan
                  PDF (&gt; 8 hlm) untuk uji checkpoint &amp; &ldquo;Coba
                  lagi&rdquo;
                </span>
              </label>
            )}

            {/* Mobile privacy note */}
            <div className="mt-5 flex items-start gap-2.5 text-[13px] text-[#4A5B7D] lg:hidden">
              <svg
                className="mt-0.5 shrink-0"
                width="15"
                height="15"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <rect
                  x="3"
                  y="7"
                  width="10"
                  height="7"
                  rx="1.5"
                  stroke="#4A5B7D"
                  strokeWidth="1.5"
                />
                <path
                  d="M5 7V5a3 3 0 0 1 6 0v2"
                  stroke="#4A5B7D"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <span>
                File disimpan privat dan bisa kamu hapus kapan saja.
              </span>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
