import { useState } from "react";
import { shopItems, type ShopLink } from "@shared/shops.ts";
import type { Outfit } from "@shared/types.ts";
import { downloadUrl, slugify } from "../lib/stream.ts";

export interface PreviewCardModel {
  index: number;
  outfit: Outfit;
  status: "waiting" | "ready" | "error";
  imageUrl?: string;
  mimeType?: string;
  error?: string;
}

interface PreviewWallProps {
  cards: PreviewCardModel[];
  phase: "idle" | "styling" | "rendering" | "done";
  characterName: string;
  admin: boolean;
  session: { id: string; path: string } | null;
  onDownloadZip: () => void;
  onReveal: () => void;
}

export function PreviewWall({ cards, phase, characterName, admin, session, onDownloadZip, onReveal }: PreviewWallProps) {
  const ready = cards.filter((card) => card.status === "ready").length;
  const sessionTools = admin ? session : null;
  return (
    <section className="wall">
      <header className="wall-head">
        <div>
          <p className="eyebrow">Preview wall</p>
          <h2>{characterName ? `Looks for ${characterName}` : "Looks"}</h2>
        </div>
        {sessionTools ? (
          <div className="wall-actions">
            <button type="button" data-testid="download-zip" onClick={onDownloadZip}>
              Download backup
            </button>
            <button type="button" className="ghost" data-testid="reveal-folder" onClick={onReveal}>
              Open folder
            </button>
          </div>
        ) : null}
      </header>
      {sessionTools ? (
        <p className="session-path" data-testid="session-path">
          {sessionTools.path}
        </p>
      ) : null}
      {phase === "styling" ? <p className="phase">Reading the photo and choosing outfits…</p> : null}
      {phase === "rendering" && cards.length > 0 ? (
        <p className="phase">
          {ready} of {cards.length} previews ready
        </p>
      ) : null}
      {cards.length === 0 ? (
        <div className="empty-wall">
          <p>Previews line up here.</p>
          <span>Each one keeps the face from your photo and tries a different version of this character's costume.</span>
        </div>
      ) : (
        <div className="cards">
          {cards.map((card) => (
            <article key={card.index} className="look" data-testid="preview-card">
              <div className="look-frame">
                {card.imageUrl ? (
                  <img src={card.imageUrl} alt={card.outfit.name} />
                ) : (
                  <div className={card.status === "error" ? "look-hold is-error" : "look-hold"}>
                    {card.status === "error" ? "This preview did not come back." : "Developing the preview…"}
                  </div>
                )}
              </div>
              <div className="look-copy">
                <p className="look-index">Look {card.index}</p>
                <h3>{card.outfit.name}</h3>
                <p>{card.outfit.why}</p>
                <ul className="garments">
                  {card.outfit.garments.map((garment) => (
                    <li key={garment}>{garment}</li>
                  ))}
                </ul>
                <ShopAdvice characterName={characterName} outfit={card.outfit} />
                {card.error ? <p className="look-error">{card.error}</p> : null}
                {card.imageUrl ? (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      downloadUrl(
                        card.imageUrl!,
                        `look-${String(card.index).padStart(2, "0")}-${slugify(card.outfit.name)}.${card.mimeType === "image/jpeg" ? "jpg" : "png"}`,
                      )
                    }
                  >
                    Download this look
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ShopLinkChip({ link }: { link: ShopLink }) {
  const [picture, setPicture] = useState(true);
  const src = `/api/shop-preview?shop=${encodeURIComponent(link.id)}&q=${encodeURIComponent(link.query)}`;
  return (
    <a href={link.href} target="_blank" rel="noopener noreferrer" title={link.query}>
      {picture ? <img src={src} alt="" onError={() => setPicture(false)} /> : null}
      {link.name}
    </a>
  );
}

function ShopAdvice({ characterName, outfit }: { characterName: string; outfit: Outfit }) {
  const items = shopItems(characterName, outfit);
  if (items.length === 0) return null;
  return (
    <div className="shop-advice">
      <p className="shop-label">Shop this look</p>
      <p className="shop-note">
        Each piece has its own purchase search. Taobao and AliExpress use simplified Chinese.
      </p>
      <ul className="shop-items">
        {items.map((item) => (
          <li key={item.garment}>
            <p className="shop-item-name">{item.garment}</p>
            <ul className="shop-links" data-testid="shop-links">
              {item.links.map((link) => (
                <li key={link.id}>
                  <ShopLinkChip link={link} />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
