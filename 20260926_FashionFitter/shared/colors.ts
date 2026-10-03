export const COLOR_OPTIONS = [
  { id: "black", label: "Black", swatch: "#1c1915" },
  { id: "white", label: "White", swatch: "#f4f1ea" },
  { id: "ivory", label: "Ivory", swatch: "#f3e6cf" },
  { id: "grey", label: "Grey", swatch: "#8d8680" },
  { id: "navy", label: "Navy", swatch: "#1e3a5f" },
  { id: "blue", label: "Blue", swatch: "#3d6f9a" },
  { id: "brown", label: "Brown", swatch: "#6b4a32" },
  { id: "beige", label: "Beige", swatch: "#d9c7a6" },
  { id: "green", label: "Green", swatch: "#3f6b4e" },
  { id: "red", label: "Red", swatch: "#8c3a32" },
  { id: "pink", label: "Pink", swatch: "#d7a3ae" },
  { id: "yellow", label: "Yellow", swatch: "#e2c15a" },
  { id: "purple", label: "Purple", swatch: "#5c4a72" },
  { id: "orange", label: "Orange", swatch: "#d08a45" },
] as const;

export type ColorId = (typeof COLOR_OPTIONS)[number]["id"];

const COLOR_IDS = new Set<string>(COLOR_OPTIONS.map((color) => color.id));

export function isColorId(value: string): value is ColorId {
  return COLOR_IDS.has(value);
}

export function colorLabel(id: string): string {
  return COLOR_OPTIONS.find((color) => color.id === id)?.label ?? id;
}
