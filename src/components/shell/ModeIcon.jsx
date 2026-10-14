// Shared leg mode icons (trip draft and share itinerary).
// Mode icons: simple 16 px strokes, currentColor.
export const MODE_ICON_PATHS = {
  fly: "M2 13l9-2 4-7 2 1-2 7 5 2-1 2-6-1-4 5-2-1 1-5-6-1z",
  drive: "M3 13l2-5h10l2 5v4h-2v-2H5v2H3zM6 12h2M14 12h2",
  train: "M6 3h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM4 9h12M7 18l-2 2M13 18l2 2",
  boat: "M3 14l2 4h10l2-4zM10 3v9M10 4l5 6h-5",
  cruise: "M2 14l3 4h10l3-4zM5 14V9h10v5M8 9V6h4v3",
  walk: "M11 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM9 7l-2 5 3 2v5M9 7l4 2 2 3M8 13l-3 6",
  other: "M5 10h.01M10 10h.01M15 10h.01",
};
export default function ModeIcon({ mode, size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={MODE_ICON_PATHS[mode] || MODE_ICON_PATHS.other} /></svg>;
}

