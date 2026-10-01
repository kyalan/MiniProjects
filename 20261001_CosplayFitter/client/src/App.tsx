import { useEffect, useMemo, useState } from "react";
import { getCharacter } from "@shared/acg.ts";
import { estimateFitting } from "@shared/estimate.ts";
import { climateFromPlace, placeLine } from "@shared/place.ts";
import { MAX_NOTE_LENGTH, MAX_PREVIEWS, MIN_PREVIEWS, MODEL_ID, MODEL_LABEL, PLACE_UNAVAILABLE, REGION_BLOCK_MESSAGE, type ActualUsage, type Outfit, type PlaceSnapshot, type Resolution, type TokenEstimate } from "@shared/types.ts";
import { CosplayPicker } from "./components/CosplayPicker";
import { PhotoDrop } from "./components/PhotoDrop";
import { PreviewWall, type PreviewCardModel } from "./components/PreviewWall";
import { TokenReceipt } from "./components/TokenReceipt";
import { preparePhoto, type PreparedPhoto } from "./lib/photo";
import { downloadUrl, readNdjson } from "./lib/stream";

type RefineState = "local" | "loading" | "refined" | "failed";
type Phase = "idle" | "styling" | "rendering" | "done";

function isOutfit(value: unknown): value is Outfit {
  if (!value || typeof value !== "object") return false;
  const outfit = value as Outfit;
  return typeof outfit.name === "string" && typeof outfit.why === "string" && Array.isArray(outfit.garments);
}

export function App({ onSignOut }: { onSignOut?: () => void }) {
  const [topicId, setTopicId] = useState("");
  const [characterId, setCharacterId] = useState("");
  const [portraitReady, setPortraitReady] = useState(false);
  const [count, setCount] = useState(3);
  const [note, setNote] = useState("");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [resolution, setResolution] = useState<Resolution>("1K");
  const [apiKey, setApiKey] = useState("");
  const [hasServerKey, setHasServerKey] = useState(false);
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [photoVersion, setPhotoVersion] = useState(0);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [refined, setRefined] = useState<{ key: string; estimate: TokenEstimate } | null>(null);
  const [refineStatus, setRefineStatus] = useState<{ key: string; state: RefineState }>({
    key: "",
    state: "local",
  });
  const [generating, setGenerating] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [cards, setCards] = useState<PreviewCardModel[]>([]);
  const [runError, setRunError] = useState<string | null>(null);
  const [session, setSession] = useState<{ id: string; path: string } | null>(null);
  const [actual, setActual] = useState<ActualUsage | null>(null);
  const [place, setPlace] = useState<PlaceSnapshot | null>(null);

  const character = topicId && characterId ? getCharacter(topicId, characterId) : undefined;

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/config", { signal: controller.signal })
      .then((response) => response.json())
      .then((payload: { hasServerKey?: boolean }) => setHasServerKey(Boolean(payload.hasServerKey)))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setHasServerKey(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/place", { signal: controller.signal })
      .then((response) => response.json())
      .then((payload: PlaceSnapshot) => setPlace(payload))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPlace({
          ok: false,
          blocked: false,
          label: "",
          dateLabel: "",
          temperatureC: null,
          notice: PLACE_UNAVAILABLE,
        });
      });
    return () => controller.abort();
  }, []);

  const climate = place ? climateFromPlace(place) : null;
  const regionBlocked = place?.blocked === true;
  const referenceCount = portraitReady ? 1 : 0;

  const localEstimate = useMemo(() => {
    if (!topicId || !characterId) return null;
    return estimateFitting({
      topicId,
      characterId,
      count,
      note,
      resolution,
      age,
      height,
      weight,
      referenceCount,
      climate,
    });
  }, [age, characterId, climate, count, height, note, referenceCount, resolution, topicId, weight]);

  const refineKey = `${topicId}|${characterId}|${count}|${note}|${resolution}|${photoVersion}|${age}|${height}|${weight}|${referenceCount}|${climate?.dateLabel ?? ""}|${climate?.temperatureC ?? ""}|${climate?.placeLabel ?? ""}`;
  const estimate = refined?.key === refineKey ? refined.estimate : localEstimate;
  const shownRefine: RefineState = refineStatus.key === refineKey ? refineStatus.state : "local";

  useEffect(() => {
    if (!photo || !topicId || !characterId || (!apiKey.trim() && !hasServerKey) || regionBlocked) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setRefineStatus({ key: refineKey, state: "loading" });
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (apiKey.trim()) headers["x-gemini-key"] = apiKey.trim();
      fetch("/api/estimate", {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          topic: topicId,
          character: characterId,
          count,
          note,
          resolution,
          imageBase64: photo.base64,
          mimeType: photo.mimeType,
          age,
          height,
          weight,
        }),
      })
        .then(async (response) => {
          const payload = (await response.json()) as { estimate?: TokenEstimate; error?: string };
          if (!response.ok || !payload.estimate) {
            throw new Error(payload.error || "Gemini could not count tokens.");
          }
          setRefined({ key: refineKey, estimate: payload.estimate });
          setRefineStatus({ key: refineKey, state: "refined" });
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setRefineStatus({ key: refineKey, state: "failed" });
        });
    }, 400);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [age, apiKey, characterId, count, hasServerKey, height, note, photo, refineKey, regionBlocked, resolution, topicId, weight]);

  async function onFile(file: File) {
    setPreparing(true);
    setPhotoError(null);
    try {
      const next = await preparePhoto(file);
      setPhoto(next);
      setPhotoVersion((version) => version + 1);
    } catch (error) {
      setPhoto(null);
      setPhotoError(error instanceof Error ? error.message : "The photo could not be read.");
    } finally {
      setPreparing(false);
    }
  }

  const blockReason = regionBlocked
    ? REGION_BLOCK_MESSAGE
    : !topicId
    ? "Choose a topic."
    : !characterId
      ? "Choose a character."
      : !photo
        ? "Add a photo that includes a face."
        : !apiKey.trim() && !hasServerKey
          ? "Add a Gemini API key."
          : null;

  async function generate() {
    if (!photo || !topicId || !characterId || blockReason || generating) return;
    setGenerating(true);
    setPhase("styling");
    setCards([]);
    setActual(null);
    setSession(null);
    setRunError(null);
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (apiKey.trim()) headers["x-gemini-key"] = apiKey.trim();
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers,
        body: JSON.stringify({
          topic: topicId,
          character: characterId,
          count,
          note,
          resolution,
          imageBase64: photo.base64,
          mimeType: photo.mimeType,
          age,
          height,
          weight,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "The fitting could not be started.");
      }
      await readNdjson(response, (event) => {
        if (event.type === "stylist" && Array.isArray(event.outfits)) {
          const outfits = event.outfits.filter(isOutfit);
          setCards(
            outfits.map((outfit, index) => ({
              index: index + 1,
              outfit,
              status: "waiting",
            })),
          );
          setPhase("rendering");
        }
        if (event.type === "preview" && typeof event.index === "number" && isOutfit(event.outfit)) {
          const mimeType = typeof event.mimeType === "string" ? event.mimeType : "image/png";
          const imageBase64 = typeof event.imageBase64 === "string" ? event.imageBase64 : "";
          setCards((current) =>
            current.map((card) =>
              card.index === event.index
                ? {
                    ...card,
                    status: "ready",
                    outfit: event.outfit as Outfit,
                    mimeType,
                    imageUrl: `data:${mimeType};base64,${imageBase64}`,
                  }
                : card,
            ),
          );
        }
        if (event.type === "preview-error" && typeof event.index === "number") {
          setCards((current) =>
            current.map((card) =>
              card.index === event.index
                ? { ...card, status: "error", error: typeof event.message === "string" ? event.message : "This preview failed." }
                : card,
            ),
          );
        }
        if (event.type === "done" || event.type === "error") {
          if (typeof event.sessionId === "string" && typeof event.sessionPath === "string") {
            setSession({ id: event.sessionId, path: event.sessionPath });
          }
        }
        if (event.type === "done" && event.actual && typeof event.actual === "object") {
          const usage = event.actual as ActualUsage;
          setActual(usage);
          setPhase("done");
        }
        if (event.type === "error") {
          setRunError(typeof event.message === "string" ? event.message : "The fitting could not be finished.");
          setPhase("done");
        }
      });
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "The fitting could not be finished.");
      setPhase("done");
    } finally {
      setGenerating(false);
    }
  }

  async function downloadZip() {
    if (!session) return;
    const response = await fetch(`/api/sessions/${session.id}/zip`);
    if (!response.ok) {
      setRunError("The session backup could not be downloaded.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    downloadUrl(url, `${session.id}.zip`);
    URL.revokeObjectURL(url);
  }

  async function revealFolder() {
    if (!session) return;
    const response = await fetch(`/api/sessions/${session.id}/reveal`, { method: "POST" });
    if (!response.ok) {
      setRunError("The session folder could not be opened.");
    }
  }

  return (
    <main className="studio">
      <section className="brief">
        <div className="title-row">
          <div>
            <p className="eyebrow">Cosplay Fitter</p>
            <h1>Cosplay Studio</h1>
          </div>
          {onSignOut ? (
            <button type="button" className="text-button sign-out" data-testid="sign-out" onClick={onSignOut}>
              Sign out
            </button>
          ) : null}
        </div>
        <p className="place" data-testid="place-line">
          {place ? placeLine(place) : "Reading your connection…"}
        </p>
        {regionBlocked ? (
          <p className="banner" role="alert" data-testid="region-block">
            {REGION_BLOCK_MESSAGE}
          </p>
        ) : null}
        <p className="lede">
          A face, a character, and up to five previews. The token receipt is filled in before you generate.
        </p>
        <p className="limit">
          These are cosplay previews, not a tailor fit. The model keeps the face from your photo and shows them
          in costume as a real photograph, not an anime drawing. Add age, height, or weight only if you want them used. Gemini does not offer virtual try-on.
        </p>

        <div className="field">
          <span className="field-label">Reference</span>
          <PhotoDrop previewUrl={photo?.dataUrl ?? null} error={photoError} busy={preparing} onFile={onFile} />
          <p className="hint">The whole photo is shown, scaled to fit. The face is the identity anchor.</p>
        </div>

        <div className="field">
          <span className="field-label">Body, optional</span>
          <div className="measures">
            <label>
              Age
              <input data-testid="age" inputMode="numeric" placeholder="Years" value={age} onChange={(event) => setAge(event.target.value)} />
            </label>
            <label>
              Height
              <input data-testid="height" placeholder="170 cm" value={height} maxLength={40} onChange={(event) => setHeight(event.target.value)} />
            </label>
            <label>
              Weight
              <input data-testid="weight" placeholder="65 kg" value={weight} maxLength={40} onChange={(event) => setWeight(event.target.value)} />
            </label>
          </div>
        </div>

        <CosplayPicker
          topicId={topicId}
          characterId={characterId}
          onTopic={(id) => {
            setTopicId(id);
            setCharacterId("");
            setPortraitReady(false);
          }}
          onCharacter={setCharacterId}
          onPortraitReady={setPortraitReady}
        />

        <label className="field">
          <span className="field-label">Note, optional</span>
          <textarea
            data-testid="note"
            maxLength={MAX_NOTE_LENGTH}
            rows={3}
            placeholder="Keep the straw hat. No heels."
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>

        <div className="split">
          <div className="field">
            <span className="field-label">Previews</span>
            <div className="stepper">
              <button type="button" data-testid="count-dec" onClick={() => setCount((value) => Math.max(MIN_PREVIEWS, value - 1))} disabled={count <= MIN_PREVIEWS}>
                −
              </button>
              <strong data-testid="preview-count">{count}</strong>
              <button type="button" data-testid="count-inc" onClick={() => setCount((value) => Math.min(MAX_PREVIEWS, value + 1))} disabled={count >= MAX_PREVIEWS}>
                +
              </button>
            </div>
          </div>
          <div className="field">
            <span className="field-label">Resolution</span>
            <div className="pills" role="radiogroup" aria-label="Resolution">
              {(["1K", "2K"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={resolution === option}
                  className={resolution === option ? "pill on" : "pill"}
                  data-testid={`resolution-${option}`}
                  onClick={() => setResolution(option)}
                >
                  {option === "1K" ? "1K standard" : "2K finer"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="model-chip" aria-label={`Model ${MODEL_LABEL}, locked`}>
          <span>Model</span>
          <strong>{MODEL_LABEL}</strong>
          <code>{MODEL_ID}</code>
        </div>

        <label className="field">
          <span className="field-label">Gemini API key</span>
          <input
            data-testid="api-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={hasServerKey ? "Using the server key" : "Paste a Gemini API key"}
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
          />
          <p className="hint">
            Sent only to this local server, then to Google. It is not written into the session backup.
            {hasServerKey ? " Leave this blank to keep the key already on the server." : ""}
          </p>
        </label>

        <TokenReceipt
          estimate={estimate}
          refineState={photo && (apiKey.trim() || hasServerKey) ? shownRefine : "local"}
          pendingReason="Choose a character to price this fitting."
          actual={actual}
        />

        {runError ? (
          <p className="banner" role="alert" data-testid="run-error">
            {runError}
          </p>
        ) : null}

        <button
          type="button"
          className="generate"
          data-testid="generate"
          disabled={Boolean(blockReason) || generating || preparing}
          onClick={() => void generate()}
        >
          {generating ? "Fitting…" : "Generate"}
        </button>
        {blockReason && !generating && !regionBlocked ? <p className="hint center">{blockReason}</p> : null}
      </section>
      <PreviewWall
        cards={cards}
        phase={phase}
        characterName={character?.name ?? ""}
        session={session}
        onDownloadZip={() => void downloadZip()}
        onReveal={() => void revealFolder()}
      />
    </main>
  );
}
