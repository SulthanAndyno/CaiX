"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ConceptDetailPanel } from "@/components/ConceptDetailPanel";
import { LegendModal } from "@/components/LegendModal";
import { PagePreviewModal } from "@/components/PagePreviewModal";
import { createQuiz, getDocumentGraph } from "@/lib/api";
import { useStoredQuizResult } from "@/lib/use-quiz-result";

const KnowledgeGraphCanvas = dynamic(
  () => import("@/components/KnowledgeGraphCanvas"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-[#F8FAFF] text-sm text-[#4A5B7D]">
        Memuat kanvas graf pengetahuan...
      </div>
    ),
  }
);

function GraphPageContent() {
  const params = useParams<{ docId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const docId = params.docId;

  const { data: graph, isLoading } = useQuery({
    queryKey: ["graph", docId],
    queryFn: () => getDocumentGraph(docId),
  });

  const focusParam = searchParams.get("focus");
  const [manualSelectedId, setManualSelectedId] = useState<
    string | null | undefined
  >(undefined);
  const [filterMode, setFilterMode] = useState<"all" | "core">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [previewPage, setPreviewPage] = useState<number | null>(null);
  const [resetCounter, setResetCounter] = useState(0);
  const [startingQuiz, setStartingQuiz] = useState(false);

  const selectedId = useMemo(() => {
    if (manualSelectedId !== undefined) return manualSelectedId;
    if (!graph?.concepts.length) return null;
    if (focusParam && graph.concepts.some((c) => c.id === focusParam)) {
      return focusParam;
    }
    return graph.concepts[0].id;
  }, [manualSelectedId, graph, focusParam]);

  const setSelectedId = (id: string | null) => setManualSelectedId(id);

  const selectedConcept = useMemo(
    () => graph?.concepts.find((c) => c.id === selectedId) ?? null,
    [graph, selectedId]
  );

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || !graph) return [];
    return graph.concepts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.definition.toLowerCase().includes(q)
    );
  }, [graph, searchQuery]);

  // Unique sorted pages across graph for Desktop right-edge vertical strip
  const allReferencedPages = useMemo(() => {
    if (!graph) return [];
    const set = new Set<number>();
    graph.concepts.forEach((c) => c.pages.forEach((p) => set.add(p)));
    return Array.from(set).sort((a, b) => a - b);
  }, [graph]);

  const handleStartQuiz = async () => {
    setStartingQuiz(true);
    try {
      const { quiz_id } = await createQuiz(docId);
      router.push(`/quiz/${docId}?quizId=${quiz_id}`);
    } finally {
      setStartingQuiz(false);
    }
  };

  const { result: storedResult } = useStoredQuizResult(docId);
  const hasResult = Boolean(storedResult);

  return (
    <AppShell
      activeStep={2}
      document={graph?.document ?? null}
      hasQuizResult={hasResult}
    >
      <div className="mx-auto max-w-[1440px] px-4 pt-3 pb-4 lg:px-8 lg:pt-5">
        {/* Graph Toolbar */}
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          {/* Search Input */}
          <div className="relative flex-1 lg:max-w-[380px]">
            <div className="flex h-[44px] items-center gap-2.5 rounded-[10px] border border-[#DCE3F0] bg-white px-3.5 focus-within:border-[#15367A]">
              <svg
                className="shrink-0 text-[#4A5B7D]"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="7"
                  cy="7"
                  r="5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="M11 11l3.5 3.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setSearchOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchOpen(true);
                }}
                placeholder="Cari konsep"
                aria-label="Cari konsep"
                className="w-full bg-transparent text-sm text-[#0B1F4B] placeholder:text-[#4A5B7D] focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Hapus pencarian"
                  onClick={() => {
                    setSearchQuery("");
                    setSearchOpen(false);
                  }}
                  className="text-xs font-semibold text-[#0369A1]"
                >
                  Hapus
                </button>
              )}
            </div>

            {/* Search Dropdown Results / Empty State */}
            {searchOpen && searchQuery.trim().length > 0 && (
              <div className="absolute left-0 right-0 top-[48px] z-20 rounded-xl border border-[#DCE3F0] bg-white p-2 shadow-lg">
                {searchMatches.length > 0 ? (
                  <ul className="max-h-60 overflow-y-auto divide-y divide-[#DCE3F0]/60">
                    {searchMatches.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              filterMode === "core" &&
                              c.importance !== "core"
                            ) {
                              setFilterMode("all");
                            }
                            setSelectedId(c.id);
                            setSearchOpen(false);
                          }}
                          className="flex min-h-[44px] w-full flex-col justify-center rounded-lg px-3 py-2 text-left hover:bg-[#F6F8FC]"
                        >
                          <span className="text-xs font-bold uppercase tracking-wide text-[#0369A1]">
                            {c.importance === "core"
                              ? "Konsep inti"
                              : "Konsep pendukung"}
                          </span>
                          <span className="text-sm font-bold text-[#0B1F4B]">
                            {c.name}
                          </span>
                          <span className="line-clamp-1 text-xs text-[#4A5B7D]">
                            {c.definition}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-3 text-center">
                    <p className="text-sm font-bold text-[#0B1F4B]">
                      Konsep tidak ditemukan
                    </p>
                    <p className="mt-1 text-xs text-[#4A5B7D]">
                      Tidak ada konsep yang cocok dengan &ldquo;{searchQuery}
                      &rdquo;. Coba kata yang lebih singkat atau pilih dari graf.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Controls: Keterangan, Semua/Inti saja, Reset View */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLegendOpen(true)}
              className="flex min-h-[44px] items-center gap-2 rounded-[10px] border border-[#DCE3F0] bg-white px-3.5 text-[13px] font-semibold text-[#0B1F4B] hover:bg-[#F6F8FC]"
            >
              <svg
                width="15"
                height="12"
                viewBox="0 0 15 12"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M1 2h13M1 6h13M1 10h13"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              <span>Keterangan</span>
            </button>

            <div className="flex h-[44px] flex-1 lg:flex-initial items-center rounded-[10px] border border-[#DCE3F0] bg-white p-0.5">
              <button
                type="button"
                onClick={() => setFilterMode("all")}
                className={`h-full flex-1 lg:px-4 rounded-lg text-[13px] font-semibold transition-colors ${
                  filterMode === "all"
                    ? "bg-[#15367A] text-white"
                    : "text-[#4A5B7D] hover:text-[#0B1F4B]"
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("core")}
                className={`h-full flex-1 lg:px-4 rounded-lg text-[13px] font-semibold transition-colors ${
                  filterMode === "core"
                    ? "bg-[#15367A] text-white"
                    : "text-[#4A5B7D] hover:text-[#0B1F4B]"
                }`}
              >
                Inti saja
              </button>
            </div>

            <button
              type="button"
              aria-label="Reset tampilan graf"
              title="Reset tampilan graf"
              onClick={() => setResetCounter((c) => c + 1)}
              className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[10px] border border-[#DCE3F0] bg-white text-[#0B1F4B] hover:bg-[#F6F8FC]"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Main Graph + Detail Split View */}
        {isLoading || !graph ? (
          <div className="mt-4 h-[420px] rounded-2xl border border-[#DCE3F0] bg-[#F8FAFF] animate-pulse" />
        ) : (
          <div className="mt-3 grid gap-4 lg:grid-cols-12 lg:items-stretch">
            {/* Cytoscape Canvas */}
            <div
              className={`relative lg:col-span-7 xl:col-span-7 overflow-hidden rounded-2xl border border-[#DCE3F0] bg-[#F8FAFF] transition-[height] duration-200 ${
                selectedConcept
                  ? "h-[240px] sm:h-[320px] lg:h-[calc(100vh-165px)]"
                  : "h-[430px] sm:h-[480px] lg:h-[calc(100vh-165px)]"
              } min-h-[240px]`}
            >
              <KnowledgeGraphCanvas
                concepts={graph.concepts}
                relations={graph.relations}
                selectedConceptId={selectedId}
                filterMode={filterMode}
                searchQuery={searchQuery}
                resetCounter={resetCounter}
                onSelectConcept={(id) => {
                  setSelectedId(id);
                  setSearchOpen(false);
                }}
              />
            </div>

            {/* Concept Detail Panel (Bottom Sheet look on mobile, Side Panel on desktop) */}
            <div className="lg:col-span-4 xl:col-span-4">
              <ConceptDetailPanel
                concept={selectedConcept}
                allConcepts={graph.concepts}
                relations={graph.relations}
                startingQuiz={startingQuiz}
                onClose={() => setSelectedId(null)}
                onSelectRelatedConcept={(targetId) => {
                  const target = graph.concepts.find((c) => c.id === targetId);
                  if (
                    target &&
                    filterMode === "core" &&
                    target.importance !== "core"
                  ) {
                    setFilterMode("all");
                  }
                  setSelectedId(targetId);
                }}
                onOpenPage={(p) => setPreviewPage(p)}
                onStartQuiz={handleStartQuiz}
              />
            </div>

            {/* Desktop Vertical Page Strip (1440px spec) */}
            <aside
              aria-label="Daftar cepat halaman sumber"
              className="hidden lg:flex lg:col-span-1 flex-col items-center gap-2 rounded-2xl border border-[#DCE3F0] bg-white py-3 px-1.5 max-h-[calc(100vh-165px)] overflow-y-auto"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#4A5B7D]">
                Hlm
              </span>
              {allReferencedPages.map((p) => {
                const activeForConcept = selectedConcept?.pages.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPreviewPage(p)}
                    className={`min-h-[38px] w-full rounded-lg text-xs font-semibold transition-colors ${
                      activeForConcept
                        ? "border border-[#0369A1] bg-[#E0F2FE] text-[#0B1F4B]"
                        : "border border-transparent bg-[#F6F8FC] text-[#4A5B7D] hover:border-[#DCE3F0] hover:text-[#0B1F4B]"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </aside>
          </div>
        )}
      </div>

      <LegendModal open={legendOpen} onClose={() => setLegendOpen(false)} />
      <PagePreviewModal
        docId={docId}
        pageNumber={previewPage}
        conceptName={selectedConcept?.name}
        onChangePage={(p) => setPreviewPage(p)}
        onClose={() => setPreviewPage(null)}
        onViewInGraph={() => setPreviewPage(null)}
      />
    </AppShell>
  );
}

export default function GraphPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F6F8FC] p-6 text-sm text-[#4A5B7D]">
          Memuat peta konsep...
        </div>
      }
    >
      <GraphPageContent />
    </Suspense>
  );
}
