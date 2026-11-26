import type { StylesheetJson } from "cytoscape";
import type { RelationType } from "@/types/caix";

export const caixCytoscapeStylesheet: StylesheetJson = [
  {
    selector: "node",
    style: {
      label: "data(name)",
      "font-family": "Inter, sans-serif",
      "font-size": "12px",
      "font-weight": 600,
      color: "#0B1F4B",
      "text-valign": "bottom",
      "text-halign": "center",
      "text-margin-y": 6,
      "text-wrap": "wrap",
      "text-max-width": "110px",
      "text-background-color": "#F8FAFF",
      "text-background-opacity": 0.92,
      "text-background-padding": "3px",
      "text-background-shape": "roundrectangle",
    },
  },
  {
    selector: 'node[importance = "core"]',
    style: {
      width: 44,
      height: 44,
      "background-color": "#FF6B6B",
      "border-width": 2.5,
      "border-color": "#15367A",
    },
  },
  {
    selector: 'node[importance = "supporting"]',
    style: {
      width: 28,
      height: 28,
      "background-color": "#7DD3FC",
      "border-width": 1.5,
      "border-color": "#0369A1",
      color: "#4A5B7D",
    },
  },
  {
    selector: "node:selected",
    style: {
      "border-width": 4,
      "border-color": "#0B1F4B",
      "overlay-color": "#15367A",
      "overlay-padding": 6,
      "overlay-opacity": 0.12,
    },
  },
  {
    selector: "node.dimmed",
    style: {
      opacity: 0.22,
    },
  },
  {
    selector: "edge",
    style: {
      "curve-style": "bezier",
      width: 2,
      "arrow-scale": 1.1,
    },
  },
  {
    selector: 'edge[type = "prerequisite_of"]',
    style: {
      "line-color": "#E04848",
      "target-arrow-color": "#E04848",
      "target-arrow-shape": "triangle",
      "line-style": "solid",
      width: 2.5,
    },
  },
  {
    selector: 'edge[type = "part_of"]',
    style: {
      "line-color": "#0369A1",
      "target-arrow-shape": "none",
      "line-style": "solid",
      width: 2.5,
    },
  },
  {
    selector: 'edge[type = "example_of"]',
    style: {
      "line-color": "#6366F1",
      "target-arrow-shape": "none",
      "line-style": "dashed",
      "line-dash-pattern": [6, 4],
      width: 2,
    },
  },
  {
    selector: 'edge[type = "contrasts_with"]',
    style: {
      "line-color": "#B45309",
      "target-arrow-shape": "none",
      "line-style": "dotted",
      "line-dash-pattern": [2, 4],
      width: 2,
    },
  },
  {
    selector: 'edge[type = "related_to"]',
    style: {
      "line-color": "#4F7BD9",
      "target-arrow-shape": "none",
      "line-style": "solid",
      width: 1.25,
      opacity: 0.75,
    },
  },
  {
    selector: "edge.dimmed",
    style: {
      opacity: 0.15,
    },
  },
];

export const RELATION_META: Record<
  RelationType,
  {
    label: string;
    shortDesc: string;
    badgeBg: string;
    badgeText: string;
    strokeColor: string;
  }
> = {
  prerequisite_of: {
    label: "Prasyarat untuk",
    shortDesc: "Konsep asal harus dipahami lebih dulu",
    badgeBg: "#FEE2E2",
    badgeText: "#B91C1C",
    strokeColor: "#E04848",
  },
  part_of: {
    label: "Bagian dari",
    shortDesc: "Komponen penyusun konsep induk",
    badgeBg: "#E0F2FE",
    badgeText: "#0369A1",
    strokeColor: "#0369A1",
  },
  example_of: {
    label: "Contoh dari",
    shortDesc: "Implementasi spesifik dari konsep umum",
    badgeBg: "#EEF2FF",
    badgeText: "#4338CA",
    strokeColor: "#6366F1",
  },
  contrasts_with: {
    label: "Berbeda dengan",
    shortDesc: "Konsep yang dibandingkan di materi",
    badgeBg: "#FEF3C7",
    badgeText: "#92400E",
    strokeColor: "#B45309",
  },
  related_to: {
    label: "Terkait dengan",
    shortDesc: "Hubungan umum antar konsep",
    badgeBg: "#EEF3FC",
    badgeText: "#15367A",
    strokeColor: "#4F7BD9",
  },
};
