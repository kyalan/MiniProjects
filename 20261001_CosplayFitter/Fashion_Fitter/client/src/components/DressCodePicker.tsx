import { DRESS_CODES } from "@shared/dressCodes.ts";

interface DressCodePickerProps {
  value: string;
  onChange: (id: string) => void;
}

export function DressCodePicker({ value, onChange }: DressCodePickerProps) {
  return (
    <div className="codes" role="radiogroup" aria-label="Dress code">
      {DRESS_CODES.map((code) => {
        const selected = value === code.id;
        return (
          <button
            key={code.id}
            type="button"
            role="radio"
            aria-checked={selected}
            className={selected ? "code on" : "code"}
            data-testid={`dress-${code.id}`}
            onClick={() => onChange(code.id)}
          >
            <span className="code-label">{code.label}</span>
            <span className="code-summary">{code.summary}</span>
          </button>
        );
      })}
    </div>
  );
}
