import { useEffect, useId, useRef, useState } from "react";
import { COLOR_OPTIONS } from "@shared/colors.ts";

interface ColorPickerProps {
  selected: string[];
  onChange: (ids: string[]) => void;
}

export function ColorPicker({ selected, onChange }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="menu" ref={rootRef}>
      <button
        type="button"
        className="menu-button"
        data-testid="colors"
        aria-label="Preferred colors"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected.length ? "Add another color" : "Choose a color"}</span>
        <span className="menu-caret" aria-hidden="true" />
      </button>
      {open ? (
        <ul className="menu-list" id={listId} role="listbox" aria-label="Preferred colors" aria-multiselectable="true">
          {COLOR_OPTIONS.map((color) => {
            const on = selected.includes(color.id);
            return (
              <li key={color.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  className={on ? "menu-option on" : "menu-option"}
                  data-testid={`color-${color.id}`}
                  onClick={() => onChange(on ? selected.filter((id) => id !== color.id) : [...selected, color.id])}
                >
                  <i className="color-dot" style={{ background: color.swatch }} />
                  <span>{color.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {selected.length ? (
        <ul className="chosen-colors">
          {selected.map((id) => {
            const color = COLOR_OPTIONS.find((item) => item.id === id);
            return (
              <li key={id}>
                <button type="button" onClick={() => onChange(selected.filter((item) => item !== id))}>
                  <i className="color-dot" style={{ background: color?.swatch ?? "#ccc" }} />
                  {color?.label ?? id}
                  <span aria-hidden="true"> ×</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
