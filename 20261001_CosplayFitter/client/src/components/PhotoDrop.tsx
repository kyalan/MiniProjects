interface PhotoDropProps {
  previewUrl: string | null;
  error: string | null;
  busy: boolean;
  onFile: (file: File) => void;
}

export function PhotoDrop({ previewUrl, error, busy, onFile }: PhotoDropProps) {
  return (
    <label
      className={previewUrl ? "drop has-photo" : "drop"}
      data-testid="photo-drop"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        if (file) onFile(file);
      }}
    >
      <input
        data-testid="photo-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = "";
        }}
      />
      {previewUrl ? (
        <img src={previewUrl} alt="Reference photo for the fitting" />
      ) : (
        <span className="drop-copy">
          <strong>{busy ? "Reading the photo…" : "Drop a face photo"}</strong>
          <span>JPEG, PNG, or WebP. A drawing of a character works too.</span>
        </span>
      )}
      {error ? <span className="drop-error">{error}</span> : null}
    </label>
  );
}
