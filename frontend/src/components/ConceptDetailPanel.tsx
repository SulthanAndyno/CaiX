"use client";

import { useState } from "react";
import { RELATION_META } from "@/lib/cytoscape-style";
import type { ConceptNode, ConceptRelation } from "@/types/caix";

interface ConceptDetailPanelProps {
  concept: ConceptNode | null;
  allConcepts: ConceptNode[];
  relations: ConceptRelation[];
  startingQuiz: boolean;
  onClose?: () => void;
  onSelectRelatedConcept: (conceptId: string) => void;
  onOpenPage: (pageNumber: number) => void;
  onStartQuiz: () => void;
}

export function ConceptDetailPanel({
  concept,
  allConcepts,
  relations,
  startingQuiz,
  onClose,
  onSelectRelatedConcept,
  onOpenPage,
  onStartQuiz,
}: ConceptDetailPanelProps) {
  const [showAllPages, setShowAllPages] = useState(false);

  if (!concept) {
    return (
      <div className="flex flex-col justify-between rounded-2xl border border-[#DCE3F0] bg-white p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#4A5B7D]">
            Detail Konsep
          </p>
          <h2 className="mt-1 font-display text-lg font-bold text-[#0B1F4B]">
            Pilih salah satu simpul di graf
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#4A5B7D]">
            Ketuk konsep mana saja di kanvas untuk melihat definisi, tautan
            halaman sumber PDF, dan hubungannya dengan konsep lain.
          </p>
        </div>

        <button
          type="button"
          disabled={startingQuiz}
          onClick={onStartQuiz}
          className="mt-6 min-h-[46px] w-full rounded-[10px] bg-[#15367A] px-4 text-[15px] font-bold text-white hover:bg-[#0B1F4B] disabled:opacity-60"
        >
          {startingQuiz ? "Memulai kuis..." : "Mulai kuis (5 soal)"}
        </button>
      </div>
    );
  }

  const conceptMap = new Map(allConcepts.map((c) => [c.id, c]));
  const connectedRelations = relations.filter(
    (r) => r.source_id === concept.id || r.target_id === concept.id
  );

  const pages = concept.pages ?? [];
  const visiblePages = showAllPages ? pages : pages.slice(0, 3);
  const hiddenCount = pages.length - visiblePages.length;

  return (
    <div className="flex flex-col rounded-t-[20px] lg:rounded-2xl border border-[#DCE3F0] bg-white p-5 shadow-sm">
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#DCE3F0] lg:hidden" />

      {/* Importance Badge & Close */}
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#F6F8FC] px-3 py-1 text-xs font-semibold text-[#0B1F4B]">
          <span
            className={`h-2 w-2 rounded-full ${
              concept.importance === "core" ? "bg-[#FF6B6B]" : "bg-[#7DD3FC]"
            }`}
          />
          {concept.importance === "core" ? "Konsep inti" : "Konsep pendukung"}
        </span>

        {onClose && (
          <button
            type="button"
            aria-label="Tutup detail konsep"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#4A5B7D] hover:bg-[#F6F8FC] lg:hidden"
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
        )}
      </div>

      {/* Title & Definition */}
      <h2 className="mt-3 font-display text-[22px] leading-tight font-bold text-[#0B1F4B]">
        {concept.name}
      </h2>
      <p className="mt-2 text-[13.5px] leading-[1.45] text-[#0B1F4B]">
        {concept.definition}
      </p>

      {/* Page Chips (min height 44px tap target) */}
      <div className="mt-4">
        <p className="text-xs font-semibold text-[#4A5B7D]">
          {pages.length > 0
            ? `Dibahas di ${pages.length} halaman`
            : "Sumber PDF · halaman belum ditautkan"}
        </p>

        {pages.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {visiblePages.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onOpenPage(p)}
                className="min-h-[44px] rounded-full border-[1.5px] border-[#0369A1] bg-white px-4 text-[13px] font-semibold text-[#0B1F4B] hover:bg-[#E0F2FE]/50"
              >
                hlm. {p}
              </button>
            ))}
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAllPages(true)}
                className="min-h-[44px] rounded-full border-[1.5px] border-[#0369A1] bg-white px-4 text-[13px] font-semibold text-[#0369A1] hover:bg-[#E0F2FE]/50"
              >
                +{hiddenCount} lainnya
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onOpenPage(0)}
            className="mt-2 min-h-[44px] rounded-full border border-[#DCE3F0] bg-[#F6F8FC] px-4 text-xs font-semibold text-[#4A5B7D]"
          >
            Lihat status rujukan
          </button>
        )}
      </div>

      {/* Connected Relations (02-graf-hubungan-dan-fix-label.svg) */}
      {connectedRelations.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-[#4A5B7D]">
            Terhubung dengan ({connectedRelations.length} konsep)
          </p>
          <div className="mt-2 space-y-2 max-h-[168px] overflow-y-auto pr-0.5">
            {connectedRelations.map((rel) => {
              const targetId =
                rel.source_id === concept.id ? rel.target_id : rel.source_id;
              const targetConcept = conceptMap.get(targetId);
              if (!targetConcept) return null;
              const meta = RELATION_META[rel.type];

              return (
                <button
                  key={rel.id}
                  type="button"
                  onClick={() => onSelectRelatedConcept(targetId)}
                  className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-[10px] border border-[#DCE3F0] bg-[#F6F8FC] px-2.5 py-1.5 text-left hover:border-[#0369A1] hover:bg-[#EEF3FC]"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold"
                      style={{
                        backgroundColor: meta.badgeBg,
                        color: meta.badgeText,
                      }}
                    >
                      {meta.label}
                    </span>
                    <span className="truncate text-[13px] font-semibold text-[#0B1F4B]">
                      {targetConcept.name}
                    </span>
                  </div>
                  <svg
                    className="shrink-0 text-[#4A5B7D]"
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M6 3l5 5-5 5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Primary Action: Mulai kuis (5 soal) in Navy */}
      <button
        type="button"
        disabled={startingQuiz}
        onClick={onStartQuiz}
        className="mt-4 min-h-[46px] w-full rounded-[10px] bg-[#15367A] px-4 text-[15px] font-bold text-white hover:bg-[#0B1F4B] disabled:opacity-60"
      >
        {startingQuiz ? "Menyiapkan kuis..." : "Mulai kuis (5 soal)"}
      </button>
    </div>
  );
}
