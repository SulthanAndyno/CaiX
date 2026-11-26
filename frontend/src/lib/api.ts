import {
  DEMO_CONCEPTS,
  DEMO_DOCUMENT,
  DEMO_DOCUMENT_ID,
  DEMO_QUIZ_QUESTIONS,
  DEMO_RELATIONS,
  getDemoPage,
} from "@/lib/demo-data";
import type {
  ConceptNode,
  ConceptRelation,
  DocumentSummary,
  GraphResponse,
  JobStatusResponse,
  PagePreviewResponse,
  QuizAnswerSubmission,
  QuizEvaluationItem,
  QuizQuestion,
  QuizStatusResponse,
  QuizSubmitResponse,
  ReviewTopicItem,
} from "@/types/caix";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";
export const isUsingMockApi = API_BASE.length === 0;

// --- Session helpers for active document & latest quiz result ---
const ACTIVE_DOC_KEY = "caix_active_doc_id";
const RESULT_KEY_PREFIX = "caix_quiz_result_";

export function setActiveDocumentId(docId: string | null) {
  if (typeof window === "undefined") return;
  if (docId) {
    window.sessionStorage.setItem(ACTIVE_DOC_KEY, docId);
  } else {
    window.sessionStorage.removeItem(ACTIVE_DOC_KEY);
  }
}

export function getActiveDocumentId(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(ACTIVE_DOC_KEY);
}

export function saveQuizResult(docId: string, result: QuizSubmitResponse) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    `${RESULT_KEY_PREFIX}${docId}`,
    JSON.stringify(result)
  );
}

export function loadQuizResult(docId: string): QuizSubmitResponse | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(`${RESULT_KEY_PREFIX}${docId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as QuizSubmitResponse;
  } catch {
    return null;
  }
}

export function clearQuizResult(docId: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(`${RESULT_KEY_PREFIX}${docId}`);
}

// --- In-memory mock store (backed by sessionStorage for custom uploads) ---
interface MockDocStore {
  document: DocumentSummary;
  concepts: ConceptNode[];
  relations: ConceptRelation[];
  pageTexts: Record<number, string>;
  questions: QuizQuestion[];
}

interface MockJobState {
  job: JobStatusResponse;
  createdAt: number;
  simulatePauseAtChunk: number | null;
  resumedAt: number | null;
}

interface MockQuizState {
  quiz: QuizStatusResponse;
  createdAt: number;
}

const mockDocs = new Map<string, MockDocStore>();
const mockJobs = new Map<string, MockJobState>();
const mockQuizzes = new Map<string, MockQuizState>();

function ensureDemoDoc(): MockDocStore {
  if (!mockDocs.has(DEMO_DOCUMENT_ID)) {
    mockDocs.set(DEMO_DOCUMENT_ID, {
      document: DEMO_DOCUMENT,
      concepts: DEMO_CONCEPTS,
      relations: DEMO_RELATIONS,
      pageTexts: {},
      questions: DEMO_QUIZ_QUESTIONS,
    });
  }
  return mockDocs.get(DEMO_DOCUMENT_ID)!;
}

function buildGraphFromUploadedPdf(
  docId: string,
  filename: string,
  fileSizeBytes: number,
  totalPages: number,
  skippedPages: number,
  pageTexts: Record<number, string>
): MockDocStore {
  const readablePages = Object.entries(pageTexts)
    .filter(([, text]) => text.length >= 25)
    .map(([p, text]) => ({ page: Number(p), text }));

  // Build deterministic concepts from headings / frequent capitalized terms in uploaded PDF
  const samplePages = readablePages.slice(0, 6);
  const concepts: ConceptNode[] = [];
  const basePositions = [
    { x: 200, y: 150 },
    { x: 75, y: 105 },
    { x: 325, y: 105 },
    { x: 65, y: 220 },
    { x: 185, y: 235 },
    { x: 315, y: 220 },
  ];

  const cleanTitle = filename.replace(/\.pdf$/i, "");
  const primaryPages = samplePages.slice(0, 3).map((s) => s.page);

  concepts.push({
    id: "topik-utama",
    name: cleanTitle.slice(0, 26),
    definition:
      samplePages[0]?.text.slice(0, 180) ||
      `Topik utama dari dokumen ${filename} (${totalPages} halaman).`,
    importance: "core",
    pages: primaryPages.length > 0 ? primaryPages : [1],
    position: basePositions[0],
  });

  const usedIds = new Set<string>(["topik-utama"]);
  samplePages.forEach((entry, idx) => {
    if (concepts.length >= 6) return;
    const words = entry.text
      .split(/\s+/)
      .filter((w) => /^[A-Za-z][A-Za-z0-9-]{3,}$/.test(w))
      .slice(0, 2);
    const label =
      words.length > 0 ? words.join(" ") : `Bagian Hlm. ${entry.page}`;
    const slug = `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${entry.page}`;
    if (usedIds.has(slug)) return;
    usedIds.add(slug);

    concepts.push({
      id: slug,
      name: label,
      definition: `${entry.text.slice(0, 160)}${entry.text.length > 160 ? "..." : ""}`,
      importance: idx < 3 ? "core" : "supporting",
      pages: [entry.page],
      position: basePositions[concepts.length] ?? { x: 140 + idx * 45, y: 180 },
    });
  });

  const relationTypes: ConceptRelation["type"][] = [
    "part_of",
    "prerequisite_of",
    "example_of",
    "contrasts_with",
    "related_to",
  ];
  const relations: ConceptRelation[] = concepts.slice(1).map((c, idx) => ({
    id: `rel-up-${idx + 1}`,
    source_id: c.id,
    target_id: concepts[0].id,
    type: relationTypes[idx % relationTypes.length],
    explanation: `Konsep ${c.name} dibahas pada halaman ${c.pages[0]} dan terhubung dengan ${concepts[0].name}.`,
    page: c.pages[0] ?? 1,
  }));

  const questions: QuizQuestion[] = concepts.slice(0, 5).map((c, idx) => ({
    id: `q-up-${idx + 1}`,
    question_order: idx + 1,
    question: `Berdasarkan ${filename} (hlm. ${c.pages[0] ?? 1}), pernyataan manakah yang paling sesuai tentang "${c.name}"?`,
    options: [
      c.definition.slice(0, 110),
      `Hanya berlaku sebagai dekorasi visual tanpa keterkaitan dengan ${concepts[0].name}.`,
      `Menggantikan seluruh fungsi dokumen ${cleanTitle}.`,
      `Tidak dijelaskan pada halaman ${c.pages[0] ?? 1} dalam materi.`,
    ],
    correct_index: 0,
    explanation: `Pada halaman ${c.pages[0] ?? 1}, materi menjelaskan bahwa ${c.name}: ${c.definition.slice(0, 120)}`,
    concept_ids: [c.id],
    uses_relation: idx % 2 === 0,
    source_page: c.pages[0] ?? 1,
    difficulty: idx < 2 ? "easy" : "medium",
  }));

  const doc: DocumentSummary = {
    id: docId,
    filename,
    file_size_bytes: fileSizeBytes,
    total_pages: totalPages,
    skipped_pages: skippedPages,
    is_demo: false,
  };

  const store: MockDocStore = {
    document: doc,
    concepts,
    relations,
    pageTexts,
    questions,
  };
  mockDocs.set(docId, store);

  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(`caix_doc_${docId}`, JSON.stringify(store));
    } catch {
      // Ignore quota errors for large PDFs
    }
  }
  return store;
}

function getMockDoc(docId: string): MockDocStore {
  if (docId === DEMO_DOCUMENT_ID) return ensureDemoDoc();
  const inMem = mockDocs.get(docId);
  if (inMem) return inMem;
  if (typeof window !== "undefined") {
    const raw = window.sessionStorage.getItem(`caix_doc_${docId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as MockDocStore;
      mockDocs.set(docId, parsed);
      return parsed;
    }
  }
  return ensureDemoDoc();
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, body || res.statusText);
  }
  return (await res.json()) as T;
}

// --- Public API Contract ---

export async function startDemoDocument(): Promise<{
  document_id: string;
  job_id: string;
}> {
  if (!isUsingMockApi) {
    return fetchJson("/api/documents/demo", { method: "POST" });
  }
  ensureDemoDoc();
  setActiveDocumentId(DEMO_DOCUMENT_ID);
  return {
    document_id: DEMO_DOCUMENT_ID,
    job_id: "demo-ready",
  };
}

export async function uploadPdfDocument(params: {
  file: File;
  totalPages: number;
  skippedPages: number;
  pageTexts: Record<number, string>;
  simulatePause?: boolean;
}): Promise<{ document_id: string; job_id: string }> {
  if (!isUsingMockApi) {
    const form = new FormData();
    form.append("file", params.file);
    return fetchJson("/api/documents/upload", {
      method: "POST",
      body: form,
    });
  }

  const docId = `doc-${Date.now()}`;
  const jobId = `job-${Date.now()}`;
  const chunkTotal = Math.max(1, Math.ceil(params.totalPages / 8));

  buildGraphFromUploadedPdf(
    docId,
    params.file.name,
    params.file.size,
    params.totalPages,
    params.skippedPages,
    params.pageTexts
  );

  mockJobs.set(jobId, {
    createdAt: Date.now(),
    simulatePauseAtChunk:
      params.simulatePause && chunkTotal >= 2 ? Math.min(3, chunkTotal) : null,
    resumedAt: null,
    job: {
      job_id: jobId,
      document_id: docId,
      filename: params.file.name,
      file_size_bytes: params.file.size,
      status: "processing",
      step: "reading_pdf",
      chunk_done: 0,
      chunk_total: chunkTotal,
      failed_chunk: null,
      total_pages: params.totalPages,
      skipped_pages: params.skippedPages,
      error_message: null,
    },
  });

  setActiveDocumentId(docId);
  return { document_id: docId, job_id: jobId };
}

export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  if (!isUsingMockApi) {
    return fetchJson(`/api/jobs/${jobId}`);
  }

  if (jobId === "demo-ready") {
    ensureDemoDoc();
    return {
      job_id: "demo-ready",
      document_id: DEMO_DOCUMENT_ID,
      filename: DEMO_DOCUMENT.filename,
      file_size_bytes: DEMO_DOCUMENT.file_size_bytes,
      status: "completed",
      step: "saving",
      chunk_done: 6,
      chunk_total: 6,
      failed_chunk: null,
      total_pages: DEMO_DOCUMENT.total_pages,
      skipped_pages: DEMO_DOCUMENT.skipped_pages,
      error_message: null,
    };
  }

  const entry = mockJobs.get(jobId);
  if (!entry) {
    return {
      job_id: jobId,
      document_id: DEMO_DOCUMENT_ID,
      filename: DEMO_DOCUMENT.filename,
      file_size_bytes: DEMO_DOCUMENT.file_size_bytes,
      status: "completed",
      step: "saving",
      chunk_done: 6,
      chunk_total: 6,
      failed_chunk: null,
      total_pages: DEMO_DOCUMENT.total_pages,
      skipped_pages: DEMO_DOCUMENT.skipped_pages,
      error_message: null,
    };
  }

  if (entry.job.status === "cancelled" || entry.job.status === "completed") {
    return entry.job;
  }

  const elapsedMs = Date.now() - (entry.resumedAt ?? entry.createdAt);
  const total = entry.job.chunk_total;

  if (entry.job.status === "paused") {
    return entry.job;
  }

  if (elapsedMs < 1100 && !entry.resumedAt) {
    entry.job = { ...entry.job, step: "reading_pdf", chunk_done: 0 };
    return entry.job;
  }

  const startChunk = entry.resumedAt ? Math.max(1, (entry.job.failed_chunk ?? 1) - 1) : 0;
  const chunksProgressed = Math.min(
    total,
    startChunk + Math.max(1, Math.floor((elapsedMs - (entry.resumedAt ? 0 : 1100)) / 900))
  );

  if (
    entry.simulatePauseAtChunk !== null &&
    chunksProgressed >= entry.simulatePauseAtChunk
  ) {
    entry.job = {
      ...entry.job,
      status: "paused",
      step: "extracting_concepts",
      chunk_done: entry.simulatePauseAtChunk - 1,
      failed_chunk: entry.simulatePauseAtChunk,
      error_message: `Server AI sedang sibuk. Hasil potongan 1 sampai ${entry.simulatePauseAtChunk - 1} sudah tersimpan, jadi tidak perlu mulai dari awal.`,
    };
    return entry.job;
  }

  if (chunksProgressed < total) {
    entry.job = {
      ...entry.job,
      status: "processing",
      step: "extracting_concepts",
      chunk_done: chunksProgressed,
    };
    return entry.job;
  }

  const afterExtractMs = elapsedMs - (total - startChunk) * 900 - (entry.resumedAt ? 0 : 1100);
  if (afterExtractMs < 1000) {
    entry.job = {
      ...entry.job,
      status: "processing",
      step: "merging_graph",
      chunk_done: total,
    };
    return entry.job;
  }

  if (afterExtractMs < 1900) {
    entry.job = {
      ...entry.job,
      status: "processing",
      step: "saving",
      chunk_done: total,
    };
    return entry.job;
  }

  entry.job = {
    ...entry.job,
    status: "completed",
    step: "saving",
    chunk_done: total,
    failed_chunk: null,
  };
  return entry.job;
}

export async function retryJob(jobId: string): Promise<JobStatusResponse> {
  if (!isUsingMockApi) {
    return fetchJson(`/api/jobs/${jobId}/retry`, { method: "POST" });
  }
  const entry = mockJobs.get(jobId);
  if (entry) {
    entry.simulatePauseAtChunk = null;
    entry.resumedAt = Date.now();
    entry.job = {
      ...entry.job,
      status: "processing",
      step: "extracting_concepts",
      error_message: null,
    };
    return entry.job;
  }
  return getJobStatus(jobId);
}

export async function cancelJob(jobId: string): Promise<{ ok: true }> {
  if (!isUsingMockApi) {
    return fetchJson(`/api/jobs/${jobId}/cancel`, { method: "POST" });
  }
  const entry = mockJobs.get(jobId);
  if (entry) {
    entry.job = { ...entry.job, status: "cancelled" };
  }
  return { ok: true };
}

export async function getDocumentGraph(docId: string): Promise<GraphResponse> {
  if (!isUsingMockApi) {
    return fetchJson(`/api/documents/${docId}/graph`);
  }
  const store = getMockDoc(docId);
  setActiveDocumentId(store.document.id);
  return {
    document: store.document,
    concepts: store.concepts,
    relations: store.relations,
  };
}

export async function getDocumentPagePreview(
  docId: string,
  pageNumber: number
): Promise<PagePreviewResponse> {
  if (!isUsingMockApi) {
    return fetchJson(`/api/documents/${docId}/pages/${pageNumber}`);
  }
  const store = getMockDoc(docId);
  if (store.document.id === DEMO_DOCUMENT_ID) {
    return getDemoPage(pageNumber);
  }
  const text =
    store.pageTexts[pageNumber] ||
    `Teks halaman ${pageNumber} dari ${store.document.filename}.`;
  return {
    page_number: pageNumber,
    total_pages: store.document.total_pages,
    filename: store.document.filename,
    title: `Halaman ${pageNumber}`,
    text,
    is_demo_preview: false,
  };
}

export async function createQuiz(docId: string): Promise<{ quiz_id: string }> {
  if (!isUsingMockApi) {
    return fetchJson(`/api/documents/${docId}/quiz`, { method: "POST" });
  }
  const store = getMockDoc(docId);
  const quizId = `quiz-${docId}-${Date.now()}`;
  mockQuizzes.set(quizId, {
    createdAt: Date.now(),
    quiz: {
      quiz_id: quizId,
      document_id: store.document.id,
      status: "preparing",
      prep_step: "picking_clusters",
      generated_count: 0,
      target_count: 5,
    },
  });
  return { quiz_id: quizId };
}

export async function getQuizStatus(
  quizId: string,
  docId: string
): Promise<QuizStatusResponse> {
  if (!isUsingMockApi) {
    return fetchJson(`/api/quizzes/${quizId}`);
  }
  const store = getMockDoc(docId);
  const entry = mockQuizzes.get(quizId);
  if (!entry) {
    return {
      quiz_id: quizId,
      document_id: store.document.id,
      status: "ready",
      prep_step: "ready",
      generated_count: 5,
      target_count: 5,
      questions: store.questions,
    };
  }

  const elapsed = Date.now() - entry.createdAt;
  if (elapsed < 700) {
    entry.quiz = {
      ...entry.quiz,
      status: "preparing",
      prep_step: "picking_clusters",
      generated_count: 0,
    };
    return entry.quiz;
  }
  if (elapsed < 2600) {
    const count = Math.min(5, Math.max(1, Math.floor((elapsed - 400) / 420)));
    entry.quiz = {
      ...entry.quiz,
      status: "preparing",
      prep_step: "generating_questions",
      generated_count: count,
    };
    return entry.quiz;
  }
  if (elapsed < 3400) {
    entry.quiz = {
      ...entry.quiz,
      status: "preparing",
      prep_step: "validating_options",
      generated_count: 5,
    };
    return entry.quiz;
  }

  entry.quiz = {
    ...entry.quiz,
    status: "ready",
    prep_step: "ready",
    generated_count: 5,
    questions: store.questions,
  };
  return entry.quiz;
}

export async function submitQuizAnswers(
  quizId: string,
  docId: string,
  answers: QuizAnswerSubmission[]
): Promise<QuizSubmitResponse> {
  if (!isUsingMockApi) {
    return fetchJson(`/api/quizzes/${quizId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
  }

  const store = getMockDoc(docId);
  const conceptMap = new Map(store.concepts.map((c) => [c.id, c]));
  const answerMap = new Map(
    answers.map((a) => [a.question_order, a.selected_index])
  );

  let score = 0;
  const items: QuizEvaluationItem[] = [];
  const reviewTopics: ReviewTopicItem[] = [];

  for (const q of store.questions) {
    const selected = answerMap.get(q.question_order) ?? null;
    const status: QuizEvaluationItem["status"] =
      selected === null
        ? "skipped"
        : selected === q.correct_index
          ? "correct"
          : "wrong";

    if (status === "correct") {
      score += 1;
    } else {
      const firstConceptId = q.concept_ids[0] ?? store.concepts[0]?.id ?? "";
      const concept = conceptMap.get(firstConceptId);
      reviewTopics.push({
        concept_id: firstConceptId,
        concept_name: concept?.name ?? firstConceptId,
        reason: status === "skipped" ? "Soal dilewati" : "Perlu diperkuat",
        source_page: q.source_page,
        question_order: q.question_order,
      });
    }

    items.push({
      question_order: q.question_order,
      question: q.question,
      options: q.options,
      selected_index: selected,
      correct_index: q.correct_index,
      status,
      explanation: q.explanation,
      concept_ids: q.concept_ids,
      source_page: q.source_page,
    });
  }

  const response: QuizSubmitResponse = {
    quiz_id: quizId,
    document_id: store.document.id,
    score,
    total: store.questions.length,
    items,
    review_topics: reviewTopics,
  };
  saveQuizResult(store.document.id, response);
  return response;
}

export async function deleteDocument(docId: string): Promise<{ ok: true }> {
  if (!isUsingMockApi) {
    await fetchJson(`/api/documents/${docId}`, { method: "DELETE" });
  }
  mockDocs.delete(docId);
  clearQuizResult(docId);
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(`caix_doc_${docId}`);
  }
  setActiveDocumentId(null);
  return { ok: true };
}
