import { MAX_MOOD_IMAGES } from "@shared/types.ts";
import type { PreparedPhoto } from "../lib/photo";

export interface MoodImage extends PreparedPhoto {
  id: string;
}

interface MoodImagesProps {
  images: MoodImage[];
  error: string | null;
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
}

export function MoodImages({ images, error, onAdd, onRemove }: MoodImagesProps) {
  return (
    <div className="field">
      <span className="field-label">Dress direction, optional</span>
      <label className="mood-add">
        <input
          data-testid="mood-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(event) => {
            const files = event.target.files ? Array.from(event.target.files) : [];
            if (files.length) onAdd(files);
            event.target.value = "";
          }}
        />
        Add images for symbols, icons, or color tone
      </label>
      <p className="hint">Up to {MAX_MOOD_IMAGES}. These steer the outfit. They are not a second face.</p>
      {images.length > 0 ? (
        <ul className="mood-row">
          {images.map((image, index) => (
            <li key={image.id}>
              <img src={image.dataUrl} alt={`Dress direction ${index + 1}`} />
              <button type="button" onClick={() => onRemove(image.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="drop-error static">{error}</p> : null}
    </div>
  );
}
