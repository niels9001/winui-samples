import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import type { CatalogSample } from "./catalog";
import {
  repositoryRoot,
  sampleDirectory,
} from "./repository-files";

const readmeSizeLimit = 256 * 1024;

export interface ReadmeContext {
  migrationNotes?: string;
  limitations?: string;
}

function cleanMarkdownText(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_~]/g, "")
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

export async function readSampleReadmeContext(
  sample: CatalogSample,
  root = repositoryRoot,
): Promise<ReadmeContext> {
  const readmePath = path.join(sampleDirectory(sample, root), "README.md");
  let file: Awaited<ReturnType<typeof stat>>;
  try {
    file = await stat(readmePath);
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
  if (!file.isFile() || file.size > readmeSizeLimit) {
    return {};
  }

  const markdown = await readFile(readmePath, "utf8");
  return {
    migrationNotes: extractReadmeSection(markdown, "Migration notes"),
    limitations: extractReadmeSection(
      markdown,
      "Known differences / limitations",
    ),
  };
}
