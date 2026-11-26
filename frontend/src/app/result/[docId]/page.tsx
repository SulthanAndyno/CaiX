"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PagePreviewModal } from "@/components/PagePreviewModal";
import { createQuiz, getDocumentGraph } from "@/lib/api";
import { useStoredQuizResult } from "@/lib/use-quiz-result";
import type { QuizEvaluationItem } from "@/types/caix";

const LETTERS = ["A", "B", "C", "D"] as const;

function ResultPageContent() {
  const params = useParams<{ docId: string }>();
  const router = useRouter();
  const docId = params.docId;

  const { data: graph } = useQuery({
    queryKey: ["graph", docId],
    queryFn: () => getDocumentGraph(docId),
  });

  const { result, hydrated: loaded } = useStoredQuizResult(docId);
  const [reviewItem, setReviewItem] = useState<QuizEvaluationItem | null>(null);
  const [previewPage, setPreviewPage] = useState<number | null>(null);
  const [previewConceptName, setPreviewConceptName] = useState<
    string | undefined
  >(undefined);
  const [retryingQuiz, setRetryingQuiz] = useState(false);

  const handleRepeatQuiz = async () => {
    setRetryingQuiz(true);
    try {
      const { quiz_id } = await createQuiz(docId);
      router.push(`/quiz/${docId}?quizId=${quiz_id}`);
    } finally {
      setRetryingQuiz(false);
    }
  };

  if (loaded && !result) {
    return (
      <AppShell activeStep={4} document={graph?.document ?? null}>
        <div className="mx-auto max-w-[540px] px-5 pt-10 text-center">
          <h1 className="font-display text-2xl font-bold text-[#0B1F4B]">
            Belum ada hasil kuis
          </h1>
          <p className="mt-2 text-sm text-[#4A5B7D]">
            Selesaikan lima soal terlebih dahulu untuk melihat skor dan meninjau
            jawabanmu.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              disabled={retryingQuiz}
              onClick={handleRepeatQuiz}
              className="min-h-[46px] w-full rounded-[10px] bg-[#15367A] px-5 text-[15px] font-bold text-white"
            >
              {retryingQuiz ? "Menyiapkan kuis..." : "Mulai kuis"}
            </button>
            <button
              type="button"
              onClick={() => router.push(`/graph/${docId}`)}
              className="min-h-[44px] w-full rounded-[10px] border border-[#DCE3F0] bg-white px-5 text-sm font-semibold text-[#0B1F4B]"
            >
              Kembali ke graf
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      activeStep={4}
      document={graph?.document ?? null}
      hasQuizResult={Boolean(result)}
    >
      <div className="mx-auto max-w-[720px] px-5 pt-6 pb-12">
        {/* Score Header Card */}
        <div className="rounded-2xl border border-[#DCE3F0] bg-white p-5 shadow-xs lg:p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-[#4A5B7D]">
            Kuis selesai
          </p>
          <p className="mt-0.5 text-sm font-medium text-[#4A5B7D]">
            {graph?.document.filename ?? "Dokumen aktif"}
          </p>

          <div className="mt-4 flex items-baseline gap-2">
            <span className="font-display text-5xl font-bold text-[#0B1F4B]">
              {result?.score ?? 0}
            </span>
            <span className="font-display text-2xl font-bold text-[#4A5B7D]">
              / {result?.total ?? 5}
            </span>
            <span className="ml-2 text-sm font-medium text-[#4A5B7D]">
              jawaban benar
            </span>
          </div>

          <p className="mt-3 text-xs text-[#4A5B7D]">
            Ketuk nomor soal untuk meninjau pembahasan dan rujukan halamannya.
          </p>

          {/* 5 Question Review Pills (1 ✓, 2 ✕, 3 —) */}
          <div className="mt-3.5 grid grid-cols-5 gap-2">
            {(result?.items ?? []).map((item) => {
              const style =
                item.status === "correct"
                  ? "border-[#15803D] bg-[#DCFCE7] text-[#15803D]"
                  : item.status === "wrong"
                    ? "border-[#B91C1C] bg-[#FEE2E2] text-[#B91C1C]"
                    : "border-[#DCE3F0] bg-[#F6F8FC] text-[#4A5B7D]";
              const symbol =
                item.status === "correct"
                  ? "✓"
                  : item.status === "wrong"
                    ? "✕"
                    : "—";

              return (
                <button
                  key={item.question_order}
                  type="button"
                  onClick={() => setReviewItem(item)}
                  className={`flex min-h-[44px] items-center justify-center gap-1 rounded-[10px] border text-sm font-bold transition hover:brightness-95 ${style}`}
                >
                  <span>{item.question_order}</span>
                  <span>{symbol}</span>
                </button>
              );
            })}
          </div>

          {/* Primary Actions */}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={retryingQuiz}
              onClick={handleRepeatQuiz}
              className="min-h-[46px] w-full rounded-[10px] bg-[#FF6B6B] px-5 text-[15px] font-bold text-[#0B1F4B] hover:brightness-95 disabled:opacity-60"
            >
              {retryingQuiz ? "Menyiapkan..." : "Ulangi kuis"}
            </button>
            <button
              type="button"
              onClick={() => router.push(`/graph/${docId}`)}
              className="min-h-[46px] w-full rounded-[10px] border border-[#15367A] bg-white px-5 text-sm font-bold text-[#15367A] hover:bg-[#EEF3FC]"
            >
              Kembali ke graf
            </button>
          </div>
        </div>

        {/* Review Topics Section */}
        <section className="mt-6">
          <h2 className="font-display text-lg font-bold text-[#0B1F4B]">
            Topik yang perlu diulang
          </h2>

          {result && result.review_topics.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-[#15803D]/30 bg-[#DCFCE7]/60 p-5">
              <p className="text-sm font-bold text-[#15803D]">
                Semua soal terjawab benar!
              </p>
              <p className="mt-1 text-xs text-[#0B1F4B]">
                Kamu menguasai seluruh konsep yang diujikan pada sesi ini. Kamu
                bisa mengulangi kuis untuk berlatih soal baru atau kembali
                menjelajahi graf.
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {(result?.review_topics ?? []).map((topic) => (
                <div
                  key={`${topic.question_order}-${topic.concept_id}`}
                  className="rounded-2xl border border-[#DCE3F0] bg-white p-4 shadow-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          topic.reason === "Soal dilewati"
                            ? "bg-[#FEF3C7] text-[#92400E]"
                            : "bg-[#FEE2E2] text-[#B91C1C]"
                        }`}
                      >
                        {topic.reason} · Soal {topic.question_order}
                      </span>
                      <h3 className="mt-1.5 font-display text-base font-bold text-[#0B1F4B]">
                        {topic.concept_name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewConceptName(topic.concept_name);
                          setPreviewPage(topic.source_page);
                        }}
                        className="min-h-[44px] rounded-full border-[1.5px] border-[#0369A1] bg-white px-4 text-xs font-semibold text-[#0B1F4B] hover:bg-[#E0F2FE]/50"
                      >
                        hlm. {topic.source_page}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            `/graph/${docId}?focus=${encodeURIComponent(
                              topic.concept_id
                            )}`
                          )
                        }
                        className="min-h-[44px] rounded-[10px] bg-[#15367A] px-3.5 text-xs font-bold text-white hover:bg-[#0B1F4B]"
                      >
                        Lihat di graf
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Review Question Detail Drawer (08-drawer-review-soal-hasil.svg) */}
      {reviewItem && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0B1F4B]/45 p-0 sm:p-4"
          onClick={() => setReviewItem(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-review-title"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-[460px] flex-col rounded-t-[20px] sm:rounded-[20px] border border-[#DCE3F0] bg-white shadow-xl overflow-hidden"
          >
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-[#DCE3F0] sm:hidden" />

            <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-2">
              <div className="flex items-center gap-2.5">
                <h2
                  id="drawer-review-title"
                  className="font-display text-lg font-bold text-[#0B1F4B]"
                >
                  Detail Soal {reviewItem.question_order} dari{" "}
                  {result?.total ?? 5}
                </h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    reviewItem.status === "correct"
                      ? "bg-[#DCFCE7] text-[#15803D]"
                      : reviewItem.status === "wrong"
                        ? "bg-[#FEE2E2] text-[#B91C1C]"
                        : "bg-[#FEF3C7] text-[#92400E]"
                  }`}
                >
                  {reviewItem.status === "correct"
                    ? "✓ Benar"
                    : reviewItem.status === "wrong"
                      ? "✕ Salah"
                      : "— Dilewati"}
                </span>
              </div>
              <button
                type="button"
                aria-label="Tutup review soal"
                onClick={() => setReviewItem(null)}
                className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-[#F6F8FC] text-[#0B1F4B]"
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

            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
              <p className="font-display text-base font-bold leading-snug text-[#0B1F4B]">
                {reviewItem.question}
              </p>

              {/* User's Answer */}
              <div
                className={`rounded-xl border-[1.5px] p-3.5 ${
                  reviewItem.status === "correct"
                    ? "border-[#15803D] bg-[#DCFCE7]"
                    : reviewItem.status === "wrong"
                      ? "border-[#B91C1C] bg-[#FEE2E2]"
                      : "border-[#DCE3F0] bg-[#F6F8FC]"
                }`}
              >
                <p
                  className={`text-xs font-bold ${
                    reviewItem.status === "correct"
                      ? "text-[#15803D]"
                      : reviewItem.status === "wrong"
                        ? "text-[#B91C1C]"
                        : "text-[#4A5B7D]"
                  }`}
                >
                  JAWABANMU{" "}
                  {reviewItem.selected_index !== null
                    ? `(${LETTERS[reviewItem.selected_index]})`
                    : ""}
                </p>
                <p className="mt-1 text-[13.5px] font-medium text-[#0B1F4B]">
                  {reviewItem.selected_index !== null
                    ? reviewItem.options[reviewItem.selected_index]
                    : "Soal dilewati (belum dijawab)"}
                </p>
              </div>

              {/* Correct Answer */}
              {reviewItem.status !== "correct" && (
                <div className="rounded-xl border-[1.5px] border-[#15803D] bg-[#DCFCE7] p-3.5">
                  <p className="text-xs font-bold text-[#15803D]">
                    KUNCI JAWABAN ({LETTERS[reviewItem.correct_index]})
                  </p>
                  <p className="mt-1 text-[13.5px] font-semibold text-[#0B1F4B]">
                    {reviewItem.options[reviewItem.correct_index]}
                  </p>
                </div>
              )}

              {/* Explanation */}
              <div className="pt-1">
                <p className="text-xs font-bold text-[#0B1F4B]">Penjelasan</p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-[#4A5B7D]">
                  {reviewItem.explanation}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewConceptName(undefined);
                    setPreviewPage(reviewItem.source_page);
                  }}
                  className="mt-3 min-h-[44px] rounded-full border-[1.5px] border-[#0369A1] bg-white px-4 text-[13px] font-semibold text-[#0369A1]"
                >
                  Lihat sumber: hlm. {reviewItem.source_page}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-[#DCE3F0] p-4">
              <button
                type="button"
                onClick={() => {
                  const cid = reviewItem.concept_ids[0] ?? "";
                  setReviewItem(null);
                  router.push(
                    `/graph/${docId}?focus=${encodeURIComponent(cid)}`
                  );
                }}
                className="min-h-[46px] rounded-[10px] border-[1.5px] border-[#15367A] bg-white px-4 text-sm font-bold text-[#0B1F4B]"
              >
                Lihat di graf
              </button>
              <button
                type="button"
                onClick={() => setReviewItem(null)}
                className="min-h-[46px] rounded-[10px] bg-[#15367A] px-4 text-sm font-bold text-white"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      <PagePreviewModal
        docId={docId}
        pageNumber={previewPage}
        conceptName={previewConceptName}
        onChangePage={(p) => setPreviewPage(p)}
        onClose={() => setPreviewPage(null)}
        onViewInGraph={() => {
          setPreviewPage(null);
          router.push(`/graph/${docId}`);
        }}
      />
    </AppShell>
  );
}

export default function ResultPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F6F8FC] p-6 text-sm text-[#4A5B7D]">
          Memuat hasil kuis...
        </div>
      }
    >
      <ResultPageContent />
    </Suspense>
  );
}
