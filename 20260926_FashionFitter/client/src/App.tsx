import { useEffect, useMemo, useState } from "react";
import { citiesByCountry, matchCityId } from "@shared/cities.ts";
import { estimateFitting } from "@shared/estimate.ts";
import { climateFromPlace, placeLine } from "@shared/place.ts";
import { MAX_MOOD_IMAGES, MAX_NOTE_LENGTH, MAX_PREVIEWS, MIN_PREVIEWS, MODEL_ID, MODEL_LABEL, PLACE_UNAVAILABLE, REGION_BLOCK_MESSAGE, type ActualUsage, type Outfit, type PlaceSnapshot, type Resolution, type TokenEstimate } from "@shared/types.ts";
import { ColorPicker } from "./components/ColorPicker";
import { DressCodePicker } from "./components/DressCodePicker";
import { MoodImages, type MoodImage } from "./components/MoodImages";
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

export function App({ onLogout }: { onLogout: () => void }) {
  const [dressCodeId, setDressCodeId] = useState("");
  const [count, setCount] = useState(3);
  const [note, setNote] = useState("");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [colors, setColors] = useState<string[]>([]);
  const [moodImages, setMoodImages] = useState<MoodImage[]>([]);
  const [moodError, setMoodError] = useState<string | null>(null);
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
  const [cityId, setCityId] = useState("");
  const [cityChosen, setCityChosen] = useState(false);
  const [cityPlace, setCityPlace] = useState<PlaceSnapshot | null>(null);
  const [cityFailed, setCityFailed] = useState(false);

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
          timezone: "",
          notice: PLACE_UNAVAILABLE,
        });
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!place?.ok || cityChosen) return;
    setCityId(matchCityId(place.label));
  }, [cityChosen, place]);

  useEffect(() => {
    if (!cityId) {
      setCityPlace(null);
      setCityFailed(false);
      return;
    }
    const controller = new AbortController();
    setCityFailed(false);
    fetch(`/api/climate?city=${encodeURIComponent(cityId)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as PlaceSnapshot;
        if (!response.ok || !payload.ok) throw new Error("The fitting place could not be read.");
        setCityPlace(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setCityPlace(null);
        setCityFailed(true);
      });
    return () => controller.abort();
  }, [cityId]);

  const fittingPlace = cityId ? cityPlace : place;
  const climate = fittingPlace ? climateFromPlace(fittingPlace) : null;
  const regionBlocked = place?.blocked === true;

  const localEstimate = useMemo(() => {
    if (!dressCodeId) return null;
    return estimateFitting({
      dressCodeId,
      count,
      note,
      resolution,
      age,
      height: /^\d+$/.test(height) ? `${Number(height)} cm` : "",
      weight: /^\d+$/.test(weight) ? `${Number(weight)} kg` : "",
      colors,
      referenceCount: moodImages.length,
      climate,
    });
  }, [age, climate, colors, count, dressCodeId, height, moodImages.length, note, resolution, weight]);

  const refineKey = `${dressCodeId}|${count}|${note}|${resolution}|${photoVersion}|${age}|${height}|${weight}|${colors.join(",")}|${moodImages.map((image) => image.id).join(",")}|${cityId}|${climate?.dateLabel ?? ""}|${climate?.temperatureC ?? ""}|${climate?.placeLabel ?? ""}`;
  const estimate = refined?.key === refineKey ? refined.estimate : localEstimate;
  const shownRefine: RefineState = refineStatus.key === refineKey ? refineStatus.state : "local";

  useEffect(() => {
    if (!photo || !dressCodeId || (!apiKey.trim() && !hasServerKey) || regionBlocked) {
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
          dressCode: dressCodeId,
          count,
          note,
          resolution,
          imageBase64: photo.base64,
          mimeType: photo.mimeType,
          age,
          height,
          weight,
          colors,
          city: cityId,
          references: moodImages.map((image) => ({
            imageBase64: image.base64,
            mimeType: image.mimeType,
          })),
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
  }, [age, apiKey, cityId, colors, count, dressCodeId, hasServerKey, height, moodImages, note, photo, refineKey, regionBlocked, resolution, weight]);

  async function onMoodFiles(files: File[]) {
    const room = MAX_MOOD_IMAGES - moodImages.length;
    if (room <= 0) {
      setMoodError("Add up to 3 dress-direction images.");
      return;
    }
    setMoodError(null);
    const next: MoodImage[] = [];
    for (const file of files.slice(0, room)) {
      try {
        const prepared = await preparePhoto(file);
        next.push({ ...prepared, id: `${Date.now()}-${next.length}-${file.name}` });
      } catch (error) {
        setMoodError(error instanceof Error ? error.message : "That image could not be read.");
      }
    }
    if (files.length > room) setMoodError("Add up to 3 dress-direction images.");
    if (next.length) setMoodImages((current) => [...current, ...next].slice(0, MAX_MOOD_IMAGES));
  }

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
    : !dressCodeId
    ? "Choose a dress code."
    : !photo
      ? "Add a photo that includes a face."
      : !apiKey.trim() && !hasServerKey
        ? "Add a Gemini API key."
        : null;

  async function generate() {
    if (!photo || !dressCodeId || blockReason || generating) return;
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
          dressCode: dressCodeId,
          count,
          note,
          resolution,
          imageBase64: photo.base64,
          mimeType: photo.mimeType,
          age,
          height,
          weight,
          colors,
          city: cityId,
          references: moodImages.map((image) => ({
            imageBase64: image.base64,
            mimeType: image.mimeType,
          })),
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
        <p className="eyebrow">Fashion Fitter</p>
        <div className="title-row">
          <h1>Fitting Studio</h1>
          <button type="button" className="sign-out" onClick={onLogout}>
            Sign out
          </button>
        </div>
        <p className="place" data-testid="fitting-place">
          <span className="place-kicker">Fitting place</span>
          {fittingPlace ? placeLine(fittingPlace) : cityFailed ? "The fitting place could not be read." : "Reading the fitting place…"}
        </p>
        <p className="place" data-testid="place-line">
          <span className="place-kicker">Your connection</span>
          {place ? placeLine(place) : "Reading your connection…"}
        </p>
        <label className="field">
          <span className="field-label">City, optional</span>
          <select
            data-testid="city"
            value={cityId}
            onChange={(event) => {
              setCityChosen(true);
              setCityId(event.target.value);
            }}
          >
            <option value="">Your location</option>
            {citiesByCountry().map((group) => (
              <optgroup key={group.country} label={group.country}>
                {group.cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.city}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="hint">Defaults to the East Asian city on this connection. Date, temperature, and timezone above follow this choice.</p>
        </label>
        {regionBlocked ? (
          <p className="banner" role="alert" data-testid="region-block">
            {REGION_BLOCK_MESSAGE}
          </p>
        ) : null}
        <p className="lede">
          A face, a dress code, and up to five previews. The token receipt is filled in before you generate.
        </p>
        <p className="limit">
          These are styling previews, not a tailor fit. The model keeps the face from your photo and invents a
          plausible dressed portrait. Add age, height, or weight only if you want them used. Gemini does not offer virtual try-on.
        </p>

        <div className="field">
          <span className="field-label">Reference</span>
          <PhotoDrop previewUrl={photo?.dataUrl ?? null} error={photoError} busy={preparing} onFile={onFile} />
          <p className="hint">The face is the identity anchor. Use a recent photo, a headshot, or an illustrated character.</p>
        </div>

        <div className="field">
          <span className="field-label">Character, optional</span>
          <div className="measures">
            <label>
              Age
              <input data-testid="age" inputMode="numeric" placeholder="Years" value={age} onChange={(event) => setAge(event.target.value)} />
            </label>
            <label>
              Height
              <span className="unit-field">
                <input
                  data-testid="height"
                  inputMode="numeric"
                  placeholder="170"
                  value={height}
                  onChange={(event) => setHeight(event.target.value.replace(/\D/g, "").slice(0, 3))}
                />
                <span>cm</span>
              </span>
            </label>
            <label>
              Weight
              <span className="unit-field">
                <input
                  data-testid="weight"
                  inputMode="numeric"
                  placeholder="65"
                  value={weight}
                  onChange={(event) => setWeight(event.target.value.replace(/\D/g, "").slice(0, 3))}
                />
                <span>kg</span>
              </span>
            </label>
          </div>
          <p className="hint">Type a whole number. Height is centimetres, from 50 to 250. Weight is kilograms, from 20 to 300.</p>
        </div>

        <div className="field">
          <span className="field-label">Colors, optional</span>
          <ColorPicker selected={colors} onChange={setColors} />
          <p className="hint">Choose a color to add it. You can add more than one.</p>
        </div>

        <div className="field">
          <span className="field-label">Dress code</span>
          <DressCodePicker value={dressCodeId} onChange={setDressCodeId} />
          <MoodImages
            images={moodImages}
            error={moodError}
            onAdd={(files) => void onMoodFiles(files)}
            onRemove={(id) => setMoodImages((current) => current.filter((image) => image.id !== id))}
          />
        </div>

        <label className="field">
          <span className="field-label">Note, optional</span>
          <textarea
            data-testid="note"
            maxLength={MAX_NOTE_LENGTH}
            rows={3}
            placeholder="Navy, no heels, keep it quiet."
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
          pendingReason="Choose a dress code to price this fitting."
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
        session={session}
        onDownloadZip={() => void downloadZip()}
        onReveal={() => void revealFolder()}
      />
    </main>
  );
}
