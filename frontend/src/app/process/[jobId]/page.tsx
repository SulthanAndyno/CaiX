"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { cancelJob, getJobStatus, retryJob } from "@/lib/api";
import { formatMegabytes } from "@/lib/pdf-validator";
import type { JobStepValue } from "@/types/caix";

const STEP_ORDER: JobStepValue[] = [
  "reading_pdf",
  "extracting_concepts",
  "merging_graph",
  "saving",
];

function ProcessPageContent() {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const jobId = params.jobId;

  const [retrying, setRetrying] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const { data: job } = useQuery({
    queryKey: ["job-status", jobId],
    queryFn: () => getJobStatus(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (
        status === "completed" ||
        status === "paused" ||
        status === "failed" ||
        status === "cancelled"
      ) {
        return false;
      }
      return 1200;
    },
  });

  useEffect(() => {
    if (job?.status === "completed") {
      const timer = setTimeout(() => {
        router.replace(`/graph/${job.document_id}`);
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [job, router]);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const updated = await retryJob(jobId);
      queryClient.setQueryData(["job-status", jobId], updated);
    } finally {
      setRetrying(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await cancelJob(jobId);
      router.push("/");
    } finally {
      setCancelling(false);
    }
  };

  const isPaused = job?.status === "paused" || job?.status === "failed";
  const activeStepIndex = job ? STEP_ORDER.indexOf(job.step) : 0;
  const chunkDone = job?.chunk_done ?? 0;
  const chunkTotal = job?.chunk_total ?? 6;
  const failedChunk = job?.failed_chunk ?? chunkDone + 1;

  const stepMeta = [
    {
      num: 1,
      key: "reading_pdf" as const,
      title: "Baca PDF",
      desc: job
        ? `${job.total_pages} halaman diperiksa. ${job.skipped_pages} halaman gambar dilewati.`
        : "Memeriksa teks pada tiap halaman...",
    },
    {
      num: 2,
      key: "extracting_concepts" as const,
      title: isPaused
        ? `Ekstraksi berhenti di potongan ${failedChunk} dari ${chunkTotal}`
        : "Ekstraksi konsep",
      desc: isPaused
        ? "Coba lagi sekarang, atau tunggu beberapa menit kalau masih gagal."
        : `Potongan ${Math.min(chunkTotal, Math.max(1, chunkDone + 1))} dari ${chunkTotal} · 8 halaman per potongan.`,
    },
    {
      num: 3,
      key: "merging_graph" as const,
      title: "Gabung dan cek duplikat",
      desc: "Menyatukan konsep yang sama dan membuang relasi yang tidak valid.",
    },
    {
      num: 4,
      key: "saving" as const,
      title: "Simpan hasil",
      desc: "Graf langsung terbuka setelah tersimpan.",
    },
  ];

  const docSummary = job
    ? {
        id: job.document_id,
        filename: job.filename,
        file_size_bytes: job.file_size_bytes,
        total_pages: job.total_pages,
        skipped_pages: job.skipped_pages,
      }
    : null;

  return (
    <AppShell activeStep={1} document={docSummary}>
      <div className="mx-auto max-w-[600px] px-5 pt-7 pb-10">
        {job && (
          <p className="text-xs font-medium text-[#4A5B7D]">
            {job.filename}, {job.total_pages} halaman,{" "}
            {formatMegabytes(job.file_size_bytes)}
          </p>
        )}

        <h1 className="mt-1.5 font-display text-2xl font-bold text-[#0B1F4B]">
          {isPaused ? "Proses berhenti sementara" : "Menyusun peta konsep"}
        </h1>

        {isPaused ? (
          <div className="mt-3 rounded-xl border border-[#FECACA] bg-[#FEE2E2] px-4 py-3 text-sm text-[#0B1F4B]">
            {job?.error_message ??
              `Server AI sedang sibuk. Hasil potongan 1 sampai ${Math.max(1, failedChunk - 1)} sudah tersimpan, jadi tidak perlu mulai dari awal.`}
          </div>
        ) : (
          <p className="mt-2 text-sm text-[#4A5B7D]">
            Untuk {job?.total_pages ?? 45} halaman biasanya butuh 1 sampai 2
            menit. Status di bawah diperbarui otomatis.
          </p>
        )}

        {/* 4-Step Vertical Stepper */}
        <ol className="mt-6 space-y-3">
          {stepMeta.map((item, idx) => {
            const isCompleted =
              job?.status === "completed" ||
              (!isPaused && idx < activeStepIndex) ||
              (isPaused && idx < 1);
            const isFailedHere = isPaused && idx === 1;
            const isCurrent =
              !isPaused &&
              job?.status !== "completed" &&
              idx === activeStepIndex;

            return (
              <li
                key={item.key}
                className={`flex items-start gap-3.5 rounded-xl border p-4 transition-colors ${
                  isFailedHere
                    ? "border-[#B91C1C] bg-[#FEE2E2]/50"
                    : isCurrent
                      ? "border-[#15367A] bg-white shadow-xs"
                      : "border-[#DCE3F0] bg-white"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isFailedHere
                      ? "bg-[#B91C1C] text-white"
                      : isCompleted
                        ? "bg-[#15803D] text-white"
                        : isCurrent
                          ? "bg-[#15367A] text-white animate-pulse"
                          : "border border-[#DCE3F0] bg-[#F6F8FC] text-[#4A5B7D]"
                  }`}
                >
                  {isFailedHere ? "!" : isCompleted ? "✓" : item.num}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#0B1F4B]">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-[#4A5B7D]">
                    {item.desc}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>

        {!isPaused && chunkDone > 0 && (
          <p className="mt-4 text-xs text-[#4A5B7D]">
            Potongan 1{chunkDone > 1 ? `–${chunkDone}` : ""} tersimpan. Proses
            dapat dilanjutkan tanpa mengunggah ulang.
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3">
          {isPaused ? (
            <button
              type="button"
              disabled={retrying}
              onClick={handleRetry}
              className="min-h-[46px] w-full rounded-[10px] bg-[#15367A] px-5 text-[15px] font-bold text-white hover:bg-[#0B1F4B] disabled:opacity-60"
            >
              {retrying ? "Melanjutkan dari potongan tersimpan..." : "Coba lagi"}
            </button>
          ) : null}

          <button
            type="button"
            disabled={cancelling}
            onClick={handleCancel}
            className="min-h-[44px] w-full rounded-[10px] border border-[#DCE3F0] bg-white px-5 text-sm font-semibold text-[#4A5B7D] hover:bg-[#F6F8FC]"
          >
            {cancelling ? "Membatalkan..." : "Batalkan proses"}
          </button>
        </div>
      </div>
    </AppShell>
  );
}

export default function ProcessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F6F8FC] p-6 text-sm text-[#4A5B7D]">
          Memuat status pemrosesan...
        </div>
      }
    >
      <ProcessPageContent />
    </Suspense>
  );
}
