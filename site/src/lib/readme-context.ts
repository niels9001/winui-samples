import {
  lstat,
  readFile,
  realpath,
  stat,
} from "node:fs/promises";
import path from "node:path";

import type { CatalogSample } from "./catalog";
import {
  isPathInside,
  repositoryRoot,
  sampleDirectory,
} from "./repository-files";

const readmeSizeLimit = 256 * 1024;

export interface ReadmeContext {
  limitations?: string;
}

function cleanMarkdownText(value: string): string {
  const cleaned = value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*~]/g, "")
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, "\n\n")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\r/g, "");

  return cleaned
    .split(/\n{2,}/)
    .map((block) => block.replace(/\n+/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

export function extractReadmeSection(
  markdown: string,
  heading: string,
): string | undefined {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const normalizedHeading = heading.trim().toLocaleLowerCase("en-US");
  const start = lines.findIndex((line) => {
    const match = /^##\s+(.+?)\s*$/.exec(line);
    return (
      match?.[1]?.trim().toLocaleLowerCase("en-US") === normalizedHeading
    );
  });
  if (start < 0) {
    return undefined;
  }

  const collected: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^##\s+/.test(line)) {
      break;
    }
    collected.push(line);
  }

  const cleaned = cleanMarkdownText(collected.join("\n"));
  return cleaned.length > 0 ? cleaned : undefined;
}

export function removePortingOnlyProse(value: string): string | undefined {
  function rewriteFunctionalLimitation(sentence: string): string {
    const playback = /^(Closing the desktop app ends playback)\s+because\b/i.exec(
      sentence,
    );
    if (playback?.[1] && /\bUWP\b|\bport\b/i.test(sentence)) {
      return `${playback[1]}.`;
    }
    if (
      /^The UWP display-orientation behavior is not reproduced because\b/i.test(
        sentence,
      )
    ) {
      return "Display-orientation handling is unavailable because the current-view DisplayInformation path cannot be used by the desktop app.";
    }
    if (
      /^The port does not change the inherited audio-and-video initialization mode or add the missing microphone capability\b/i.test(
        sentence,
      )
    ) {
      return "Camera OCR requires the microphone capability when media capture uses audio-and-video initialization.";
    }
    if (/Launch with view preference/i.test(sentence)) {
      return '"Launch with view preference" (split-screen) options are unavailable.';
    }
    if (
      /^Those APIs target the UWP single-window\/tablet model and have no desktop equivalent/i.test(
        sentence,
      )
    ) {
      return "The required view-management APIs have no desktop equivalent.";
    }
    if (/\bappUriHandler\b.*\bis dropped\b/i.test(sentence)) {
      return "HTTPS app URI handling requires a verified domain and is not enabled.";
    }
    if (/\bpositioning hints\b.*\bare not set\b/i.test(sentence)) {
      return "The Open With dialog does not set CoreWindow-relative positioning hints.";
    }
    if (
      /^Five of the original six scenarios are included; custom effects remain a documented migration gap/i.test(
        sentence,
      )
    ) {
      return "Five of the six scenarios are included; custom effects are unavailable.";
    }
    return sentence;
  }

  const kept = value
    .split(/\n+/)
    .flatMap((block) => block.split(/(?<=[.!?])\s+/))
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .map(rewriteFunctionalLimitation)
    .filter(
      (sentence) =>
        !/\b(?:UWP|migration notes?|migrat(?:ed|ing) from|port(?:ed|ing)|this port (?:keeps|uses|replaces)|recreated to match the original)\b/i.test(
          sentence,
        ),
    );
  const cleaned = kept.join(" ").replace(/\s+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

export async function readSampleReadmeContext(
  sample: CatalogSample,
  root = repositoryRoot,
): Promise<ReadmeContext> {
  const directory = sampleDirectory(sample, root);
  const readmePath = path.join(directory, "README.md");
  let entry: Awaited<ReturnType<typeof lstat>>;
  try {
    entry = await lstat(readmePath);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return {};
    }
    throw error;
  }
  if (!entry.isFile() || entry.isSymbolicLink()) {
    return {};
  }

  const [realDirectory, realReadme] = await Promise.all([
    realpath(directory),
    realpath(readmePath),
  ]);
  if (!isPathInside(realDirectory, realReadme)) {
    return {};
  }

  const file = await stat(realReadme);
  if (!file.isFile() || file.size > readmeSizeLimit) {
    return {};
  }

  const markdown = await readFile(realReadme, "utf8");
  const limitations =
    extractReadmeSection(markdown, "Known differences / limitations") ??
    extractReadmeSection(markdown, "Known differences and limitations") ??
    extractReadmeSection(markdown, "Limitations");
  return {
    limitations: limitations
      ? removePortingOnlyProse(limitations)
      : undefined,
  };
}
