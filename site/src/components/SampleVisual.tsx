import { useState } from "react";
import type { ComponentType } from "react";

import { AppsRegular } from "@fluentui/react-icons/svg/apps";
import { CartRegular } from "@fluentui/react-icons/svg/cart";
import { DesktopRegular } from "@fluentui/react-icons/svg/desktop";
import { DocumentRegular } from "@fluentui/react-icons/svg/document";
import { GlobeRegular } from "@fluentui/react-icons/svg/globe";
import { LocationRegular } from "@fluentui/react-icons/svg/location";
import { ShieldRegular } from "@fluentui/react-icons/svg/shield";
import { VideoRegular } from "@fluentui/react-icons/svg/video";
import { WindowRegular } from "@fluentui/react-icons/svg/window";

import { fallbackVisualIndex } from "../lib/visuals";

interface IconProps {
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}

const categoryIcons: Record<string, ComponentType<IconProps>> = {
  "app-fundamentals": AppsRegular,
  "devices-and-sensors": DesktopRegular,
  "files-and-data": DocumentRegular,
  location: LocationRegular,
  media: VideoRegular,
  networking: GlobeRegular,
  "retail-and-industry": CartRegular,
  "security-and-identity": ShieldRegular,
  "ui-and-input": WindowRegular,
};

interface SampleVisualProps {
  categoryId: string;
  categoryLabel: string;
  heroUrl?: string;
  heroAlt?: string;
  eager?: boolean;
}

export function SampleVisual({
  categoryId,
  categoryLabel,
  heroUrl,
  heroAlt,
  eager = false,
}: SampleVisualProps) {
  const [imageAvailable, setImageAvailable] = useState(Boolean(heroUrl));
  const Icon = categoryIcons[categoryId] ?? AppsRegular;

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
      aria-label={`${categoryLabel} sample illustration`}
    >
      <span className="sample-visual-grid" aria-hidden="true"></span>
      <Icon aria-hidden="true" className="sample-visual-icon" />
      <span className="sample-visual-label">{categoryLabel}</span>
    </div>
  );
}
