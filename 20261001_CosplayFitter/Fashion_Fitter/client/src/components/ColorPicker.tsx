import { COLOR_OPTIONS } from "@shared/colors.ts";

interface ColorPickerProps {
  selected: string[];
  onToggle: (id: string) => void;
}

export function ColorPicker({ selected, onToggle }: ColorPickerProps) {
  return (
    <div className="colors" role="group" aria-label="Preferred colors">
      {COLOR_OPTIONS.map((color) => {
        const on = selected.includes(color.id);
        return (
          <button
            key={color.id}
            type="button"
            className={on ? "swatch on" : "swatch"}
            aria-pressed={on}
            data-testid={`color-${color.id}`}
            onClick={() => onToggle(color.id)}
          >
            <i style={{ background: color.swatch }} />
            {color.label}
          </button>
        );
      })}
    </div>
  );
}
