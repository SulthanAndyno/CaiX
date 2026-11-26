"use client";

import cytoscape, { type Core } from "cytoscape";
import { useEffect, useRef } from "react";
import { caixCytoscapeStylesheet } from "@/lib/cytoscape-style";
import type { ConceptNode, ConceptRelation } from "@/types/caix";

interface KnowledgeGraphCanvasProps {
  concepts: ConceptNode[];
  relations: ConceptRelation[];
  selectedConceptId: string | null;
  filterMode: "all" | "core";
  searchQuery: string;
  resetCounter: number;
  onSelectConcept: (conceptId: string | null) => void;
}

export default function KnowledgeGraphCanvas({
  concepts,
  relations,
  selectedConceptId,
  filterMode,
  searchQuery,
  resetCounter,
  onSelectConcept,
}: KnowledgeGraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const onSelectRef = useRef(onSelectConcept);

  useEffect(() => {
    onSelectRef.current = onSelectConcept;
  }, [onSelectConcept]);

  // Build / rebuild Cytoscape graph when concepts, relations, or filterMode change
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const visibleConcepts =
      filterMode === "core"
        ? concepts.filter((c) => c.importance === "core")
        : concepts;
    const visibleIds = new Set(visibleConcepts.map((c) => c.id));
    const visibleRelations = relations.filter(
      (r) => visibleIds.has(r.source_id) && visibleIds.has(r.target_id)
    );

    const hasPresetPositions = visibleConcepts.every((c) => Boolean(c.position));

    const cy = cytoscape({
      container,
      style: caixCytoscapeStylesheet,
      minZoom: 0.45,
      maxZoom: 2.2,
      wheelSensitivity: 0.25,
      elements: [
        ...visibleConcepts.map((c) => ({
          data: {
            id: c.id,
            name: c.name,
            importance: c.importance,
          },
          ...(c.position ? { position: c.position } : {}),
        })),
        ...visibleRelations.map((r) => ({
          data: {
            id: r.id,
            source: r.source_id,
            target: r.target_id,
            type: r.type,
          },
        })),
      ],
      layout: hasPresetPositions
        ? { name: "preset", fit: true, padding: 38 }
        : {
            name: "cose",
            animate: false,
            fit: true,
            padding: 40,
            nodeRepulsion: () => 5500,
            idealEdgeLength: () => 95,
          },
    });

    cy.on("tap", "node", (evt) => {
      onSelectRef.current(evt.target.id());
    });

    cy.on("tap", (evt) => {
      if (evt.target === cy) {
        onSelectRef.current(null);
      }
    });

    cyRef.current = cy;

    const observer = new ResizeObserver(() => {
      cy.resize();
      cy.fit(undefined, 36);
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      cy.destroy();
      cyRef.current = null;
    };
  }, [concepts, relations, filterMode]);

  // Sync selected concept & animate focus
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.nodes().unselect();
    if (!selectedConceptId) return;

    const node = cy.getElementById(selectedConceptId);
    if (node.nonempty()) {
      node.select();
      cy.animate({
        center: { eles: node },
        duration: 240,
      });
    }
  }, [selectedConceptId, filterMode]);

  // Sync search highlighting
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      cy.elements().removeClass("dimmed");
      return;
    }

    const matchingNodes = cy
      .nodes()
      .filter((n) => String(n.data("name")).toLowerCase().includes(q));
    const connected = matchingNodes.closedNeighborhood();

    cy.elements().addClass("dimmed");
    connected.removeClass("dimmed");
  }, [searchQuery, filterMode]);

  // Handle Reset View
  useEffect(() => {
    if (resetCounter === 0) return;
    const cy = cyRef.current;
    if (!cy) return;
    cy.animate({
      fit: { eles: cy.elements(), padding: 38 },
      duration: 260,
    });
  }, [resetCounter]);

  return (
    <div
      ref={containerRef}
      aria-label="Kanvas graf pengetahuan interaktif"
      className="h-full w-full bg-[#F8FAFF] touch-none select-none"
    />
  );
}
