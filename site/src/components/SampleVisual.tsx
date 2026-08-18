import { useState } from "react";

import { fallbackVisualIndex } from "../lib/visuals";

interface SampleVisualProps {
  categoryId: string;
  categoryLabel: string;
  visualLabel: string;
  heroUrl?: string;
  heroAlt?: string;
  eager?: boolean;
}

export function SampleVisual({
  categoryId,
  categoryLabel,
  visualLabel,
  heroUrl,
  heroAlt,
  eager = false,
}: SampleVisualProps) {
  const [imageAvailable, setImageAvailable] = useState(Boolean(heroUrl));

  if (heroUrl && imageAvailable) {
    return (
      <img
        alt={heroAlt ?? ""}
        className="sample-visual-image"
        decoding="async"
        fetchPriority={eager ? "high" : "auto"}
        loading={eager ? "eager" : "lazy"}
        onError={() => setImageAvailable(false)}
        src={heroUrl}
      />
    );
  }

  return (
    <div
      className={`sample-visual-fallback visual-theme-${fallbackVisualIndex(
        categoryId,
      )}`}
      role="img"
      aria-label={`${categoryLabel} example preview`}
    >
      <span className="sample-visual-grid" aria-hidden="true"></span>
      <span className="sample-visual-window" aria-hidden="true">
        <span className="sample-visual-titlebar"></span>
        <span className="sample-visual-nav"></span>
        <span className="sample-visual-content">
          <span></span><span></span><span></span>
        </span>
      </span>
      <span className="sample-visual-label">{visualLabel}</span>
    </div>
  );
}
