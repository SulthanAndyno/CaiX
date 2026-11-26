export type ConceptImportance = "core" | "supporting";

export type RelationType =
  | "prerequisite_of"
  | "part_of"
  | "example_of"
  | "contrasts_with"
  | "related_to";

export type JobStatusValue =
  | "queued"
  | "processing"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type JobStepValue =
  | "reading_pdf"
  | "extracting_concepts"
  | "merging_graph"
  | "saving";

export type QuizStatusValue = "preparing" | "ready" | "failed";

export type QuizPrepStepValue =
  | "picking_clusters"
  | "generating_questions"
  | "validating_options"
  | "ready";

export interface DocumentSummary {
  id: string;
  filename: string;
  file_size_bytes: number;
  total_pages: number;
  skipped_pages: number;
  is_demo?: boolean;
}

export interface JobStatusResponse {
  job_id: string;
  document_id: string;
  filename: string;
  file_size_bytes: number;
  status: JobStatusValue;
  step: JobStepValue;
  chunk_done: number;
  chunk_total: number;
  failed_chunk: number | null;
  total_pages: number;
  skipped_pages: number;
  error_message: string | null;
}

export interface ConceptNode {
  id: string;
  name: string;
  definition: string;
  importance: ConceptImportance;
  pages: number[];
  position?: { x: number; y: number };
}

export interface ConceptRelation {
  id: string;
  source_id: string;
  target_id: string;
  type: RelationType;
  explanation: string;
  page: number;
}

export interface GraphResponse {
  document: DocumentSummary;
  concepts: ConceptNode[];
  relations: ConceptRelation[];
}

export interface PagePreviewResponse {
  page_number: number;
  total_pages: number;
  filename: string;
  eyebrow?: string;
  title?: string;
  text: string;
  highlight_quote?: string;
  pdf_signed_url?: string | null;
  is_demo_preview?: boolean;
}

export interface QuizQuestion {
  id: string;
  question_order: number;
  question: string;
  options: [string, string, string, string];
  correct_index: number;
  explanation: string;
  concept_ids: string[];
  uses_relation: boolean;
  source_page: number;
  difficulty: "easy" | "medium" | "hard";
}

export interface QuizStatusResponse {
  quiz_id: string;
  document_id: string;
  status: QuizStatusValue;
  prep_step: QuizPrepStepValue;
  generated_count: number;
  target_count: number;
  error_message?: string | null;
  questions?: QuizQuestion[];
}

export interface QuizAnswerSubmission {
  question_order: number;
  selected_index: number | null;
}

export interface QuizEvaluationItem {
  question_order: number;
  question: string;
  options: [string, string, string, string];
  selected_index: number | null;
  correct_index: number;
  status: "correct" | "wrong" | "skipped";
  explanation: string;
  concept_ids: string[];
  source_page: number;
}

export interface ReviewTopicItem {
  concept_id: string;
  concept_name: string;
  reason: "Soal dilewati" | "Perlu diperkuat";
  source_page: number;
  question_order: number;
}

export interface QuizSubmitResponse {
  quiz_id: string;
  document_id: string;
  score: number;
  total: number;
  items: QuizEvaluationItem[];
  review_topics: ReviewTopicItem[];
}
