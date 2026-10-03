import { useEffect, useId, useRef, useState } from "react";
import { DRESS_CODES, getDressCode } from "@shared/dressCodes.ts";

interface DressCodePickerProps {
  value: string;
  onChange: (id: string) => void;
}

export function DressCodePicker({ value, onChange }: DressCodePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const chosen = getDressCode(value);

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
        data-testid="dress-code"
        aria-label="Dress code"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{chosen?.label ?? "Choose a dress code"}</span>
        <span className="menu-caret" aria-hidden="true" />
      </button>
      {open ? (
        <ul className="menu-list" id={listId} role="listbox" aria-label="Dress code">
          {DRESS_CODES.map((code) => {
            const on = value === code.id;
            return (
              <li key={code.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  className={on ? "menu-option stack on" : "menu-option stack"}
                  data-testid={`dress-${code.id}`}
                  title={code.summary}
                  onClick={() => {
                    onChange(code.id);
                    setOpen(false);
                  }}
                >
                  <span className="menu-label">{code.label}</span>
                  <span className="menu-summary">{code.summary}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
