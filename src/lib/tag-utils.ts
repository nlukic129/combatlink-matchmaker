const TAG_PALETTE = [
  { bg: "oklch(0.55 0.24 25 / 0.14)", text: "oklch(0.80 0.14 25)", border: "oklch(0.55 0.24 25 / 0.28)" },
  { bg: "oklch(0.65 0.18 280 / 0.12)", text: "oklch(0.78 0.16 280)", border: "oklch(0.65 0.18 280 / 0.26)" },
  { bg: "oklch(0.72 0.19 150 / 0.12)", text: "oklch(0.65 0.17 150)", border: "oklch(0.72 0.19 150 / 0.26)" },
  { bg: "oklch(0.82 0.16 80 / 0.12)", text: "oklch(0.72 0.14 80)", border: "oklch(0.82 0.16 80 / 0.26)" },
  { bg: "oklch(0.65 0.17 240 / 0.12)", text: "oklch(0.75 0.15 240)", border: "oklch(0.65 0.17 240 / 0.26)" },
  { bg: "oklch(0.65 0.19 330 / 0.12)", text: "oklch(0.75 0.17 330)", border: "oklch(0.65 0.19 330 / 0.26)" },
  { bg: "oklch(0.65 0.17 190 / 0.12)", text: "oklch(0.70 0.15 190)", border: "oklch(0.65 0.17 190 / 0.26)" },
  { bg: "oklch(0.65 0.16 60 / 0.12)", text: "oklch(0.68 0.14 60)", border: "oklch(0.65 0.16 60 / 0.26)" },
];

export function tagColor(tag: string) {
  const idx = tag.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % TAG_PALETTE.length;
  return TAG_PALETTE[idx];
}
