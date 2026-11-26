import type {
  ConceptNode,
  ConceptRelation,
  DocumentSummary,
  PagePreviewResponse,
  QuizQuestion,
} from "@/types/caix";

export const DEMO_DOCUMENT_ID = "demo-mvc-part-1";

export const DEMO_DOCUMENT: DocumentSummary = {
  id: DEMO_DOCUMENT_ID,
  filename: "10 - MVC part 1.pdf",
  file_size_bytes: 1_153_434, // ~1,1 MB
  total_pages: 45,
  skipped_pages: 12,
  is_demo: true,
};

export const DEMO_CONCEPTS: ConceptNode[] = [
  {
    id: "controller",
    name: "Controller",
    definition:
      "The mediator component between the View and the Model that communicates with the Model and delivers model objects to the View.",
    importance: "core",
    pages: [4, 5, 19, 21, 24, 28, 31, 35],
    position: { x: 200, y: 150 },
  },
  {
    id: "mvc",
    name: "MVC",
    definition:
      "Pola arsitektur yang memisahkan tanggung jawab aplikasi menjadi Model, View, dan Controller agar kode terstruktur dan mudah dirawat.",
    importance: "core",
    pages: [2, 3, 4],
    position: { x: 60, y: 105 },
  },
  {
    id: "controller-class",
    name: "Controller Class",
    definition:
      "Kelas yang menerapkan peran Controller pada struktur aplikasi MVC untuk menangani request pengguna.",
    importance: "core",
    pages: [19, 20, 21],
    position: { x: 335, y: 95 },
  },
  {
    id: "model",
    name: "Model",
    definition:
      "Model mengelola logika bisnis, persistensi, dan perilaku data aplikasi secara independen dari antarmuka.",
    importance: "core",
    pages: [5, 7, 11],
    position: { x: 55, y: 215 },
  },
  {
    id: "view",
    name: "View",
    definition:
      "Komponen yang menangani logika presentasi dan tampilan antarmuka pengguna berdasarkan data dari Model.",
    importance: "core",
    pages: [6, 8, 14],
    position: { x: 155, y: 230 },
  },
  {
    id: "mvc-flow",
    name: "MVC Flow",
    definition:
      "Alur komunikasi antara View, Controller, dan Model saat memproses aksi pengguna hingga merender tampilan baru.",
    importance: "core",
    pages: [12, 15, 16],
    position: { x: 285, y: 230 },
  },
  {
    id: "pojo-class",
    name: "POJO Class",
    definition:
      "Plain Old Java Object: kelas Java biasa yang dapat dipakai untuk merepresentasikan objek data pada lapisan Model.",
    importance: "supporting",
    pages: [9, 10],
    position: { x: 210, y: 70 },
  },
  {
    id: "one-view-one-ctrl",
    name: "1 View, 1 Ctrl",
    definition:
      "Contoh pembagian satu View dengan satu Controller dalam implementasi materi MVC untuk menjaga kohesi modul.",
    importance: "supporting",
    pages: [22, 23],
    position: { x: 350, y: 165 },
  },
];

export const DEMO_RELATIONS: ConceptRelation[] = [
  {
    id: "rel-1",
    source_id: "controller",
    target_id: "controller-class",
    type: "prerequisite_of",
    explanation:
      "Memahami peran konseptual Controller diperlukan sebelum mengimplementasikan Controller Class.",
    page: 19,
  },
  {
    id: "rel-2",
    source_id: "controller",
    target_id: "mvc",
    type: "part_of",
    explanation:
      "Controller adalah salah satu dari tiga komponen utama penyusun arsitektur MVC.",
    page: 4,
  },
  {
    id: "rel-3",
    source_id: "model",
    target_id: "mvc",
    type: "part_of",
    explanation:
      "Model merupakan komponen penyusun MVC yang memegang data dan logika bisnis.",
    page: 5,
  },
  {
    id: "rel-4",
    source_id: "view",
    target_id: "mvc",
    type: "part_of",
    explanation:
      "View merupakan komponen penyusun MVC yang bertanggung jawab atas presentasi.",
    page: 6,
  },
  {
    id: "rel-5",
    source_id: "controller",
    target_id: "mvc-flow",
    type: "part_of",
    explanation:
      "Controller mengorkestrasi alur komunikasi antar komponen dalam MVC Flow.",
    page: 12,
  },
  {
    id: "rel-6",
    source_id: "pojo-class",
    target_id: "model",
    type: "example_of",
    explanation:
      "POJO Class adalah contoh implementasi objek data yang digunakan di lapisan Model.",
    page: 9,
  },
  {
    id: "rel-7",
    source_id: "model",
    target_id: "view",
    type: "contrasts_with",
    explanation:
      "Model memisahkan logika bisnis & data, sedangkan View fokus eksklusif pada logika presentasi UI.",
    page: 6,
  },
  {
    id: "rel-8",
    source_id: "one-view-one-ctrl",
    target_id: "controller",
    type: "related_to",
    explanation:
      "Pola 1 View, 1 Controller menggambarkan pemetaan praktis komponen Controller terhadap View.",
    page: 22,
  },
];

export const DEMO_QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "q-mvc-1",
    question_order: 1,
    question: "What is the role of the Controller in an MVC application?",
    options: [
      "Storing application data and business rules.",
      "Mediating between the View and the Model.",
      "Rendering the user interface only.",
      "Replacing both the Model and the View.",
    ],
    correct_index: 1,
    explanation:
      "The Controller mediates between the View and the Model. It communicates with the Model and supplies model objects to the View.",
    concept_ids: ["controller"],
    uses_relation: true,
    source_page: 4,
    difficulty: "easy",
  },
  {
    id: "q-mvc-2",
    question_order: 2,
    question:
      "What primary responsibility belongs to the Model component in an MVC application?",
    options: [
      "Acting as an event handler that directly delivers graphical objects to the view.",
      "Containing presentation logic exclusively to render user interface elements.",
      "Encapsulating business logic, persistent data, and data behavior across the application.",
      "Functioning as a structural container where business process functions reside.",
    ],
    correct_index: 2,
    explanation:
      "Model bertanggung jawab mengelola data, persistensi, dan logika bisnis, sedangkan logika tampilan (UI) adalah tugas komponen View (lihat halaman 5).",
    concept_ids: ["model"],
    uses_relation: false,
    source_page: 5,
    difficulty: "medium",
  },
  {
    id: "q-mvc-3",
    question_order: 3,
    question: "Which MVC component is responsible for presentation logic?",
    options: [
      "The View.",
      "The Model.",
      "The data storage layer.",
      "All components perform the same role.",
    ],
    correct_index: 0,
    explanation:
      "The View handles presentation and the user interface. The Model focuses on data and business logic; the Controller mediates between them.",
    concept_ids: ["view"],
    uses_relation: false,
    source_page: 6,
    difficulty: "easy",
  },
  {
    id: "q-mvc-4",
    question_order: 4,
    question: "Which statement correctly separates responsibilities in MVC?",
    options: [
      "The View stores business rules; the Model renders the interface.",
      "The Controller replaces the need for a Model.",
      "All components contain presentation logic only.",
      "The Model manages data; the View handles presentation.",
    ],
    correct_index: 3,
    explanation:
      "MVC separates responsibilities: the Model manages data and business logic, the View handles presentation, and the Controller connects them.",
    concept_ids: ["mvc", "model", "view"],
    uses_relation: true,
    source_page: 3,
    difficulty: "medium",
  },
  {
    id: "q-mvc-5",
    question_order: 5,
    question:
      "Which component talks to the Model and delivers model objects to the View?",
    options: [
      "The View.",
      "The Controller.",
      "The presentation template only.",
      "The data object itself.",
    ],
    correct_index: 1,
    explanation:
      "The Controller communicates with the Model and supplies model objects to the View, connecting the two components.",
    concept_ids: ["mvc-flow", "controller"],
    uses_relation: true,
    source_page: 4,
    difficulty: "medium",
  },
];

export const DEMO_PAGES: Record<number, Omit<PagePreviewResponse, "page_number" | "total_pages" | "filename">> = {
  2: {
    eyebrow: "WEEK 10 • SOFTWARE ARCHITECTURE",
    title: "Introduction to MVC Pattern",
    text: "Model-View-Controller (MVC) is an architectural pattern that separates an application into three interconnected components to decouple internal representations from presentation.",
    highlight_quote:
      "Separates an application into three interconnected components: Model, View, and Controller.",
    is_demo_preview: true,
  },
  3: {
    eyebrow: "WEEK 10 • SOFTWARE ARCHITECTURE",
    title: "Separation of Concerns in MVC",
    text: "The Model manages data and business logic, the View handles presentation logic, and the Controller connects user interactions to application updates.",
    highlight_quote:
      "The Model manages data; the View handles presentation; the Controller connects them.",
    is_demo_preview: true,
  },
  4: {
    eyebrow: "WEEK 10 • SOFTWARE ARCHITECTURE",
    title: "The Controller Component",
    text: "Acts as the mediator component between the View and the Model. Receives user input events from the presentation layer (View). Talks to the Model and delivers model objects back to the View.",
    highlight_quote:
      "Acts as the mediator component between the View and the Model.",
    is_demo_preview: true,
  },
  5: {
    eyebrow: "WEEK 10 • SOFTWARE ARCHITECTURE",
    title: "The Model Component",
    text: "Encapsulates business logic, persistence code, and application data behavior. Independent from any specific View or graphical output format.",
    highlight_quote:
      "Encapsulates business logic, persistence code, and application data behavior.",
    is_demo_preview: true,
  },
  6: {
    eyebrow: "WEEK 10 • SOFTWARE ARCHITECTURE",
    title: "The View Component",
    text: "Responsible exclusively for presentation logic and rendering user interface elements using model objects delivered by the Controller.",
    highlight_quote:
      "Responsible exclusively for presentation logic and rendering user interface elements.",
    is_demo_preview: true,
  },
  19: {
    eyebrow: "WEEK 10 • IMPLEMENTATION",
    title: "Implementing Controller Class",
    text: "A Controller Class translates incoming user actions into commands for the Model and selects the next View to render.",
    highlight_quote:
      "Controller Class translates incoming user actions into commands for the Model.",
    is_demo_preview: true,
  },
};

export function getDemoPage(pageNumber: number): PagePreviewResponse {
  const found = DEMO_PAGES[pageNumber];
  if (found) {
    return {
      page_number: pageNumber,
      total_pages: DEMO_DOCUMENT.total_pages,
      filename: DEMO_DOCUMENT.filename,
      ...found,
    };
  }
  return {
    page_number: pageNumber,
    total_pages: DEMO_DOCUMENT.total_pages,
    filename: DEMO_DOCUMENT.filename,
    eyebrow: "WEEK 10 • SOFTWARE ARCHITECTURE",
    title: `Slide ${pageNumber} — Materi MVC`,
    text: `Ringkasan materi pada halaman ${pageNumber} dari dokumen ${DEMO_DOCUMENT.filename}. Menjelaskan keterkaitan antar komponen Model, View, dan Controller pada alur permintaan aplikasi.`,
    is_demo_preview: true,
  };
}
