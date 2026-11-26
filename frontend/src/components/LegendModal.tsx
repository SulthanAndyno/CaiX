"use client";

import { RELATION_META } from "@/lib/cytoscape-style";
import type { RelationType } from "@/types/caix";

interface LegendModalProps {
  open: boolean;
  onClose: () => void;
}

const RELATION_ORDER: { type: RelationType; title: string }[] = [
  { type: "prerequisite_of", title: "Prasyarat (prerequisite_of)" },
  { type: "part_of", title: "Bagian dari (part_of)" },
  { type: "example_of", title: "Contoh dari (example_of)" },
  { type: "contrasts_with", title: "Berbeda dengan (contrasts_with)" },
  { type: "related_to", title: "Terkait dengan (related_to)" },
];

export function LegendModal({ open, onClose }: LegendModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0B1F4B]/45 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="legend-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-[440px] overflow-y-auto rounded-t-[20px] sm:rounded-[20px] bg-white p-5 shadow-xl border border-[#DCE3F0]"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#DCE3F0] sm:hidden" />

        <div className="flex items-center justify-between gap-3">
          <h2
            id="legend-modal-title"
            className="font-display text-xl font-bold text-[#0B1F4B]"
          >
            Keterangan Graf
          </h2>
          <button
            type="button"
            aria-label="Tutup keterangan"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-[#F6F8FC] text-[#4A5B7D] hover:text-[#0B1F4B]"
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

        {/* Node Legend */}
        <div className="mt-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#4A5B7D]">
            JENIS KONSEP (SIMPUL)
          </p>
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-3.5">
              <span className="h-7 w-7 shrink-0 rounded-full bg-[#FF6B6B] border-2 border-[#15367A]" />
              <div>
                <p className="text-sm font-bold text-[#0B1F4B]">Konsep inti</p>
                <p className="text-xs text-[#4A5B7D]">
                  Ide utama materi yang wajib dikuasai
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3.5">
              <span className="ml-0.5 h-5.5 w-5.5 shrink-0 rounded-full bg-[#7DD3FC] border-[1.5px] border-[#0369A1]" />
              <div>
                <p className="text-sm font-bold text-[#0B1F4B]">
                  Konsep pendukung
                </p>
                <p className="text-xs text-[#4A5B7D]">
                  Rincian, contoh kelas, atau istilah bantu
                </p>
              </div>
            </div>
          </div>
        </div>

        <hr className="my-4 border-[#DCE3F0]" />

        {/* Edge Legend */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#4A5B7D]">
            JENIS HUBUNGAN (GARIS &amp; PANAH)
          </p>
          <div className="mt-3 space-y-3.5">
            {RELATION_ORDER.map(({ type, title }) => {
              const meta = RELATION_META[type];
              return (
                <div key={type} className="flex items-center gap-3.5">
                  <svg
                    width="54"
                    height="14"
                    viewBox="0 0 54 14"
                    className="shrink-0"
                    aria-hidden="true"
                  >
                    {type === "prerequisite_of" ? (
                      <>
                        <line
                          x1="2"
                          y1="7"
                          x2="45"
                          y2="7"
                          stroke={meta.strokeColor}
                          strokeWidth="2.5"
                        />
                        <polygon
                          points="52,7 43,2 43,12"
                          fill={meta.strokeColor}
                        />
                      </>
                    ) : (
                      <line
                        x1="2"
                        y1="7"
                        x2="52"
                        y2="7"
                        stroke={meta.strokeColor}
                        strokeWidth={type === "related_to" ? "1.5" : "2.5"}
                        strokeDasharray={
                          type === "example_of"
                            ? "6 4"
                            : type === "contrasts_with"
                              ? "2 4"
                              : undefined
                        }
                      />
                    )}
                  </svg>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#0B1F4B]">{title}</p>
                    <p className="text-xs text-[#4A5B7D]">{meta.shortDesc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 min-h-[46px] w-full rounded-[10px] bg-[#15367A] px-4 text-[15px] font-bold text-white hover:bg-[#0B1F4B]"
        >
          Tutup keterangan
        </button>
      </div>
    </div>
  );
}
