import { useEffect, useRef, useState } from "react";
import { ACG_TOPICS } from "@shared/acg.ts";

interface CosplayPickerProps {
  topicId: string;
  characterId: string;
  onTopic: (id: string) => void;
  onCharacter: (id: string) => void;
  onPortraitReady: (ready: boolean) => void;
}

export function CosplayPicker({ topicId, characterId, onTopic, onCharacter, onPortraitReady }: CosplayPickerProps) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(new Set());
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const menuRef = useRef<HTMLDivElement>(null);
  const topic = ACG_TOPICS.find((item) => item.id === topicId);
  const selected = topic?.characters.find((character) => character.id === characterId);

  useEffect(() => {
    onPortraitReady(Boolean(characterId) && loaded.has(`${topicId}/${characterId}`));
  }, [characterId, loaded, onPortraitReady, topicId]);

  useEffect(() => {
    setOpen(false);
  }, [topicId]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
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

  function markLoaded(key: string) {
    setLoaded((current) => {
      if (current.has(key)) return current;
      const next = new Set(current);
      next.add(key);
      return next;
    });
  }

  function markFailed(key: string) {
    setFailed((current) => {
      if (current.has(key)) return current;
      const next = new Set(current);
      next.add(key);
      return next;
    });
  }

  return (
    <div className="field">
      <span className="field-label">ACG topic</span>
      <div className="pills" role="radiogroup" aria-label="ACG topic">
        {ACG_TOPICS.map((item) => {
          const chosen = topicId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={chosen}
              className={chosen ? "pill on" : "pill"}
              data-testid={`topic-${item.id}`}
              onClick={() => onTopic(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {topic ? (
        <div className="character-menu" ref={menuRef}>
          <span className="field-label character-label">ACG character</span>
          <button
            type="button"
            className={open ? "character-trigger open" : "character-trigger"}
            aria-haspopup="listbox"
            aria-expanded={open}
            data-testid="character-menu"
            onClick={() => setOpen((value) => !value)}
          >
            {selected ? (
              <CharacterFace topicId={topic.id} characterId={selected.id} name={selected.name} failed={failed.has(`${topic.id}/${selected.id}`)} onLoad={() => markLoaded(`${topic.id}/${selected.id}`)} onError={() => markFailed(`${topic.id}/${selected.id}`)} />
            ) : (
              <span className="character-fallback" aria-hidden="true">?</span>
            )}
            <span className="character-name">{selected ? selected.name : "Choose a character"}</span>
            <span className="character-chevron" aria-hidden="true">{open ? "▴" : "▾"}</span>
          </button>
          {open ? (
            <ul className="character-list" role="listbox" aria-label="ACG character">
              {topic.characters.map((character) => {
                const key = `${topic.id}/${character.id}`;
                const chosen = characterId === character.id;
                return (
                  <li key={character.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={chosen}
                      className={chosen ? "character on" : "character"}
                      data-testid={`character-${character.id}`}
                      onClick={() => {
                        onCharacter(character.id);
                        setOpen(false);
                      }}
                    >
                      <CharacterFace
                        topicId={topic.id}
                        characterId={character.id}
                        name={character.name}
                        failed={failed.has(key)}
                        onLoad={() => markLoaded(key)}
                        onError={() => markFailed(key)}
                      />
                      <span className="character-name">{character.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="hint">Choose a topic to see characters.</p>
      )}
    </div>
  );
}

function CharacterFace({
  topicId,
  characterId,
  name,
  failed,
  onLoad,
  onError,
}: {
  topicId: string;
  characterId: string;
  name: string;
  failed: boolean;
  onLoad: () => void;
  onError: () => void;
}) {
  if (failed) {
    return (
      <span className="character-fallback" aria-hidden="true">
        {name.slice(0, 1)}
      </span>
    );
  }
  return (
    <img
      src={`/api/acg/${topicId}/${characterId}/image`}
      alt=""
      onLoad={onLoad}
      onError={onError}
    />
  );
}
