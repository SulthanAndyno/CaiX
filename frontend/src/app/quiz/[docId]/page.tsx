"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PagePreviewModal } from "@/components/PagePreviewModal";
import {
  createQuiz,
  getDocumentGraph,
  getQuizStatus,
  submitQuizAnswers,
} from "@/lib/api";
import { useStoredQuizResult } from "@/lib/use-quiz-result";
import type { QuizAnswerSubmission, QuizPrepStepValue } from "@/types/caix";

const LETTERS = ["A", "B", "C", "D"] as const;

const PREP_ORDER: QuizPrepStepValue[] = [
  "picking_clusters",
  "generating_questions",
  "validating_options",
  "ready",
];

type AnswerState = {
  selectedIndex: number | null;
  evaluated: boolean;
  skipped: boolean;
};

function QuizPageContent() {
  const params = useParams<{ docId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const docId = params.docId;

  const [quizId, setQuizId] = useState<string | null>(
    searchParams.get("quizId")
  );
  const [initError, setInitError] = useState<string | null>(null);

  const { data: graph } = useQuery({
    queryKey: ["graph", docId],
    queryFn: () => getDocumentGraph(docId),
  });

  // Auto-create quiz if user jumped straight to /quiz/[docId]
  useEffect(() => {
    if (quizId) return;
    let active = true;
    createQuiz(docId)
      .then((res) => {
        if (!active) return;
        setQuizId(res.quiz_id);
        router.replace(`/quiz/${docId}?quizId=${res.quiz_id}`);
      })
      .catch((err) => {
        if (!active) return;
        setInitError(
          err instanceof Error ? err.message : "Gagal menyiapkan kuis."
        );
      });
    return () => {
      active = false;
    };
  }, [docId, quizId, router]);

  const { data: quiz, refetch: refetchQuiz } = useQuery({
    queryKey: ["quiz-status", docId, quizId],
    queryFn: () => getQuizStatus(quizId!, docId),
    enabled: Boolean(quizId),
    refetchInterval: (query) => {
      const st = query.state.data?.status;
      if (st === "ready" || st === "failed") return false;
      return 600;
    },
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerState>>({});
  const [draftChoice, setDraftChoice] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [previewPage, setPreviewPage] = useState<number | null>(null);
  const [exitModalTarget, setExitModalTarget] = useState<string | null>(null);

  const questions = quiz?.questions ?? [];
  const currentQuestion = questions[currentIndex];
  const currentState = currentQuestion
    ? answers[currentQuestion.question_order]
    : undefined;

  const conceptMap = useMemo(
    () => new Map((graph?.concepts ?? []).map((c) => [c.id, c])),
    [graph]
  );

  const finishAndSubmitQuiz = async (
    finalAnswers: Record<number, AnswerState>
  ) => {
    if (!quizId) return;
    setSubmitting(true);
    try {
      const payload: QuizAnswerSubmission[] = questions.map((q) => ({
        question_order: q.question_order,
        selected_index: finalAnswers[q.question_order]?.selectedIndex ?? null,
      }));
      await submitQuizAnswers(quizId, docId, payload);
      router.push(`/result/${docId}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckAnswer = () => {
    if (!currentQuestion || draftChoice === null) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.question_order]: {
        selectedIndex: draftChoice,
        evaluated: true,
        skipped: false,
      },
    }));
  };

  const handleSkipQuestion = () => {
    if (!currentQuestion) return;
    const nextAnswers: Record<number, AnswerState> = {
      ...answers,
      [currentQuestion.question_order]: {
        selectedIndex: null,
        evaluated: true,
        skipped: true,
      },
    };
    setAnswers(nextAnswers);
    setDraftChoice(null);

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      void finishAndSubmitQuiz(nextAnswers);
    }
  };

  const handleNextQuestion = () => {
    setDraftChoice(null);
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      void finishAndSubmitQuiz(answers);
    }
  };

  const handleRetryCreateQuiz = async () => {
    setInitError(null);
    const res = await createQuiz(docId);
    setQuizId(res.quiz_id);
    router.replace(`/quiz/${docId}?quizId=${res.quiz_id}`);
    void refetchQuiz();
  };

  const { result: storedResult } = useStoredQuizResult(docId);
  const hasResult = Boolean(storedResult);
  const isInActiveQuiz = quiz?.status === "ready" && questions.length > 0;

  // --- Stage 4a: Error state ---
  if (initError || quiz?.status === "failed") {
    return (
      <AppShell
        activeStep={3}
        document={graph?.document ?? null}
        hasQuizResult={hasResult}
      >
        <div className="mx-auto max-w-[560px] px-5 pt-8">
          <h1 className="font-display text-2xl font-bold text-[#0B1F4B]">
            Kuis belum berhasil dibuat
          </h1>
          <p className="mt-1 text-sm text-[#4A5B7D]">
            PDF dan graf tetap tersedia.
          </p>
          <div className="mt-5 rounded-2xl border border-[#FECACA] bg-[#FEE2E2] p-5">
            <p className="font-display text-base font-bold text-[#B91C1C]">
              Server sedang sibuk
            </p>
            <p className="mt-1 text-sm text-[#0B1F4B]">
              {initError ??
                quiz?.error_message ??
                "Soal belum dapat disiapkan. Coba lagi beberapa saat lagi; kamu tidak perlu mengunggah ulang PDF."}
            </p>
          </div>
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={handleRetryCreateQuiz}
              className="min-h-[46px] w-full rounded-[10px] bg-[#15367A] px-4 text-[15px] font-bold text-white"
            >
              Coba buat kuis lagi
            </button>
            <button
              type="button"
              onClick={() => router.push(`/graph/${docId}`)}
              className="min-h-[44px] w-full rounded-[10px] border border-[#DCE3F0] bg-white px-4 text-sm font-semibold text-[#0B1F4B]"
            >
              Kembali ke graf
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  // --- Stage 4a: Preparing 5 questions (4-step stepper) ---
  if (!isInActiveQuiz) {
    const prepStep = quiz?.prep_step ?? "picking_clusters";
    const activePrepIdx = PREP_ORDER.indexOf(prepStep);
    const genCount = quiz?.generated_count ?? 0;
    const targetCount = quiz?.target_count ?? 5;

    const prepSteps = [
      {
        num: 1,
        title: "Pilih kelompok konsep",
        desc: "Lima kelompok konsep inti dan konsep terkait.",
      },
      {
        num: 2,
        title: `Buat ${targetCount} soal`,
        desc: `Soal ${Math.max(1, genCount)} dari ${targetCount} sedang disiapkan.`,
      },
      {
        num: 3,
        title: "Validasi dan acak opsi",
        desc: "Periksa kunci, opsi kembar, dan rujukan halaman.",
      },
      {
        num: 4,
        title: "Kuis siap",
        desc: "Soal pertama akan terbuka otomatis.",
      },
    ];

    return (
      <AppShell
        activeStep={3}
        document={graph?.document ?? null}
        hasQuizResult={hasResult}
      >
        <div className="mx-auto max-w-[580px] px-5 pt-7 pb-10">
          <h1 className="font-display text-2xl font-bold text-[#0B1F4B]">
            Menyiapkan {targetCount} soal
          </h1>
          <p className="mt-1 text-sm text-[#4A5B7D]">
            {graph?.document.filename ?? "Dokumen aktif"} · soal mengikuti
            bahasa materi
          </p>

          <ol className="mt-6 space-y-3">
            {prepSteps.map((s, idx) => {
              const done = idx < activePrepIdx;
              const current = idx === activePrepIdx;
              return (
                <li
                  key={s.num}
                  className={`flex items-start gap-3.5 rounded-xl border p-4 ${
                    current
                      ? "border-[#15367A] bg-white shadow-xs"
                      : "border-[#DCE3F0] bg-white"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      done
                        ? "bg-[#15803D] text-white"
                        : current
                          ? "bg-[#15367A] text-white animate-pulse"
                          : "border border-[#DCE3F0] bg-[#F6F8FC] text-[#4A5B7D]"
                    }`}
                  >
                    {done ? "✓" : s.num}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-[#0B1F4B]">
                      {s.title}
                    </p>
                    <p className="mt-0.5 text-xs text-[#4A5B7D]">{s.desc}</p>
                  </div>
                </li>
              );
            })}
          </ol>

          <p className="mt-4 text-xs text-[#4A5B7D]">
            Tahap {Math.max(1, activePrepIdx + 1)} dari 4
            {activePrepIdx === 1 ? ` · ${genCount} / ${targetCount} soal` : ""}
          </p>

          <button
            type="button"
            onClick={() => router.push(`/graph/${docId}`)}
            className="mt-6 min-h-[44px] w-full rounded-[10px] border border-[#DCE3F0] bg-white px-4 text-sm font-semibold text-[#0B1F4B] hover:bg-[#F6F8FC]"
          >
            Kembali ke graf
          </button>
        </div>
      </AppShell>
    );
  }

  // --- Stage 4b: Active Quiz (Soal 1..5) ---
  const conceptName =
    conceptMap.get(currentQuestion.concept_ids[0] ?? "")?.name ??
    currentQuestion.concept_ids[0] ??
    "Konsep";
  const isEvaluated = Boolean(currentState?.evaluated);
  const selectedIndex = currentState?.selectedIndex ?? null;
  const isCorrect =
    isEvaluated && selectedIndex === currentQuestion.correct_index;

  return (
    <AppShell
      activeStep={3}
      document={graph?.document ?? null}
      inQuiz
      hasQuizResult={hasResult}
      onRequestExitQuiz={(target) => setExitModalTarget(target)}
    >
      <div className="mx-auto max-w-[640px] px-5 pt-5 pb-10">
        {/* Progress bar row */}
        <div className="flex items-center gap-3">
          <span className="shrink-0 text-[13px] font-bold text-[#0B1F4B]">
            Soal {currentIndex + 1} dari {questions.length}
          </span>
          <div className="grid flex-1 grid-cols-5 gap-1.5">
            {questions.map((q, idx) => {
              const st = answers[q.question_order];
              let color = "bg-[#DCE3F0]";
              if (st?.evaluated) {
                if (st.skipped) color = "bg-[#92400E]";
                else if (st.selectedIndex === q.correct_index)
                  color = "bg-[#15803D]";
                else color = "bg-[#B91C1C]";
              } else if (idx === currentIndex) {
                color = "bg-[#15367A]";
              }
              return <div key={q.id} className={`h-1.5 rounded-full ${color}`} />;
            })}
          </div>
        </div>

        {/* Concept pill + Question */}
        <div className="mt-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#DCE3F0] bg-white px-3 py-1 text-xs font-semibold text-[#15367A]">
            <span className="h-2 w-2 rounded-full bg-[#FF6B6B]" />
            {conceptName}
          </span>
          <h1 className="mt-2.5 font-display text-[19px] leading-[1.35] font-bold text-[#0B1F4B] lg:text-[22px]">
            {currentQuestion.question}
          </h1>
        </div>

        {/* Options A-D (full text wrapping, never clipped) */}
        <div className="mt-5 space-y-2.5">
          {currentQuestion.options.map((optText, idx) => {
            const letter = LETTERS[idx];

            if (!isEvaluated) {
              const isSelected = draftChoice === idx;
              return (
                <button
                  key={letter}
                  type="button"
                  onClick={() => setDraftChoice(idx)}
                  className={`flex min-h-[68px] w-full items-center gap-3.5 rounded-xl border p-3.5 text-left transition-colors ${
                    isSelected
                      ? "border-2 border-[#15367A] bg-[#EEF3FC]"
                      : "border-[1.5px] border-[#DCE3F0] bg-white hover:border-[#0369A1]"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                      isSelected
                        ? "bg-[#15367A] text-white"
                        : "border border-[#DCE3F0] bg-[#F6F8FC] text-[#0B1F4B]"
                    }`}
                  >
                    {letter}
                  </span>
                  <span
                    className={`text-[13.5px] leading-[1.45] ${
                      isSelected
                        ? "font-semibold text-[#0B1F4B]"
                        : "font-normal text-[#0B1F4B]"
                    }`}
                  >
                    {optText}
                  </span>
                </button>
              );
            }

            // Evaluated Option Card (06-kuis-dinilai-fixed.svg)
            const isUserChoice = selectedIndex === idx;
            const isKey = currentQuestion.correct_index === idx;

            if (isKey) {
              return (
                <div
                  key={letter}
                  className="rounded-xl border-[1.5px] border-[#15803D] bg-[#DCFCE7] p-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-[#15803D] text-xs font-bold text-white">
                        {letter}
                      </span>
                      <span className="text-xs font-semibold text-[#15803D]">
                        {isUserChoice ? "Pilihanmu · Kunci" : "Kunci jawaban"}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-[#15803D]">
                      ✓ Benar
                    </span>
                  </div>
                  <p className="mt-2 text-[13.5px] leading-[1.45] font-semibold text-[#0B1F4B]">
                    {optText}
                  </p>
                </div>
              );
            }

            if (isUserChoice && !isKey) {
              return (
                <div
                  key={letter}
                  className="rounded-xl border-[1.5px] border-[#B91C1C] bg-[#FEE2E2] p-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-[#B91C1C] text-xs font-bold text-white">
                        {letter}
                      </span>
                      <span className="text-xs font-semibold text-[#B91C1C]">
                        Pilihanmu
                      </span>
                    </div>
                    <span className="text-xs font-bold text-[#B91C1C]">
                      ✕ Salah
                    </span>
                  </div>
                  <p className="mt-2 text-[13.5px] leading-[1.45] font-medium text-[#0B1F4B]">
                    {optText}
                  </p>
                </div>
              );
            }

            return (
              <div
                key={letter}
                className="flex items-center gap-3 rounded-xl border border-[#DCE3F0] bg-white px-3.5 py-3 text-[#4A5B7D]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] border border-[#DCE3F0] bg-[#F6F8FC] text-xs font-bold">
                  {letter}
                </span>
                <span className="text-[13px] leading-[1.4]">{optText}</span>
              </div>
            );
          })}
        </div>

        {/* Footer Actions: Unanswered vs Evaluated */}
        {!isEvaluated ? (
          <div className="mt-6 flex flex-col items-center gap-2.5">
            <button
              type="button"
              disabled={draftChoice === null}
              onClick={handleCheckAnswer}
              className={`min-h-[48px] w-full rounded-[10px] px-5 text-[15px] font-bold transition ${
                draftChoice !== null
                  ? "bg-[#FF6B6B] text-[#0B1F4B] hover:brightness-95"
                  : "cursor-not-allowed border border-[#DCE3F0] bg-[#EEF3FC] text-[#4A5B7D]"
              }`}
            >
              {draftChoice !== null
                ? "Periksa jawaban"
                : "Pilih satu jawaban dahulu"}
            </button>

            <button
              type="button"
              onClick={handleSkipQuestion}
              className="min-h-[44px] rounded-lg px-5 text-sm font-semibold text-[#0369A1] hover:bg-[#E0F2FE]/50"
            >
              Lewati soal ini
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {/* Explanation Card */}
            <div className="rounded-[14px] border border-[#DCE3F0] bg-white p-4">
              <p className="text-sm font-bold text-[#0B1F4B]">
                {isCorrect
                  ? `Tepat! Jawabannya ${LETTERS[currentQuestion.correct_index]}`
                  : selectedIndex !== null
                    ? `Jawabanmu ${LETTERS[selectedIndex]}, yang benar ${LETTERS[currentQuestion.correct_index]}`
                    : `Kunci jawaban: ${LETTERS[currentQuestion.correct_index]}`}
              </p>
              <p className="mt-1.5 text-[13.5px] leading-[1.5] text-[#4A5B7D]">
                {currentQuestion.explanation}
              </p>
              <button
                type="button"
                onClick={() => setPreviewPage(currentQuestion.source_page)}
                className="mt-3.5 min-h-[44px] rounded-full border-[1.5px] border-[#0369A1] bg-white px-4 text-[13px] font-semibold text-[#0369A1] hover:bg-[#E0F2FE]/50"
              >
                Lihat sumber: hlm. {currentQuestion.source_page}
              </button>
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={handleNextQuestion}
              className="min-h-[48px] w-full rounded-[10px] bg-[#15367A] px-5 text-[15px] font-bold text-white hover:bg-[#0B1F4B] disabled:opacity-60"
            >
              {submitting
                ? "Menghitung hasil..."
                : currentIndex + 1 < questions.length
                  ? "Soal berikutnya →"
                  : "Lihat hasil kuis"}
            </button>
          </div>
        )}
      </div>

      {/* Exit Quiz Confirmation Modal */}
      {exitModalTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1F4B]/45 p-4"
          onClick={() => setExitModalTarget(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[360px] rounded-2xl border border-[#DCE3F0] bg-white p-6 shadow-xl"
          >
            <h2 className="font-display text-lg font-bold text-[#0B1F4B]">
              Keluar dari kuis?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#4A5B7D]">
              Jawaban dan skor kuis ini akan direset jika kamu keluar. Pilih
              lanjutkan untuk tetap di soal ini.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setExitModalTarget(null)}
                className="min-h-[44px] rounded-[10px] border border-[#DCE3F0] bg-white px-3 text-sm font-semibold text-[#0B1F4B]"
              >
                Lanjutkan kuis
              </button>
              <button
                type="button"
                onClick={() => {
                  const dest = exitModalTarget;
                  setExitModalTarget(null);
                  router.push(dest);
                }}
                className="min-h-[44px] rounded-[10px] bg-[#15367A] px-3 text-sm font-bold text-white"
              >
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}

      <PagePreviewModal
        docId={docId}
        pageNumber={previewPage}
        conceptName={conceptName}
        onChangePage={(p) => setPreviewPage(p)}
        onClose={() => setPreviewPage(null)}
        onViewInGraph={() => {
          setPreviewPage(null);
          router.push(
            `/graph/${docId}?focus=${encodeURIComponent(
              currentQuestion.concept_ids[0] ?? ""
            )}`
          );
        }}
      />
    </AppShell>
  );
}

export default function QuizPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F6F8FC] p-6 text-sm text-[#4A5B7D]">
          Menyiapkan kuis...
        </div>
      }
    >
      <QuizPageContent />
    </Suspense>
  );
}
