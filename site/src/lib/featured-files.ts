import { lstat, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

import type {
  CatalogSample,
  FeaturedFile,
} from "./catalog";
import {
  isPathInside,
  repositoryRoot,
  sampleDirectory,
} from "./repository-files";
import {
  repositoryBlobUrl,
  sampleCodePath,
} from "./urls";

export const featuredFileSizeLimit = 128 * 1024;

export const safeFeaturedFileExtensions = new Map([
  [".appxmanifest", { language: "xml", label: "App package manifest" }],
  [".c", { language: "c", label: "C" }],
  [".cpp", { language: "cpp", label: "C++" }],
  [".cs", { language: "csharp", label: "C#" }],
  [".csproj", { language: "xml", label: "MSBuild project" }],
  [".h", { language: "cpp", label: "C/C++ header" }],
  [".idl", { language: "idl", label: "IDL" }],
  [".json", { language: "json", label: "JSON" }],
  [".manifest", { language: "xml", label: "Manifest" }],
  [".md", { language: "markdown", label: "Markdown" }],
  [".props", { language: "xml", label: "MSBuild props" }],
  [".ps1", { language: "powershell", label: "PowerShell" }],
  [".resw", { language: "xml", label: "Resource XML" }],
  [".targets", { language: "xml", label: "MSBuild targets" }],
  [".txt", { language: "text", label: "Text" }],
  [".xaml", { language: "xml", label: "XAML" }],
  [".xml", { language: "xml", label: "XML" }],
  [".yaml", { language: "yaml", label: "YAML" }],
  [".yml", { language: "yaml", label: "YAML" }],
]);

const deniedDirectoryNames = new Set([
  ".git",
  ".vs",
  "apppackages",
  "artifacts",
  "bin",
  "build",
  "bundleartifacts",
  "debug",
  "dist",
  "generated files",
  "node_modules",
  "obj",
  "packages",
  "release",
]);

const deniedFilePatterns = [
  /^\.env(?:\.|$)/i,
  /(?:^|[._-])credentials?(?:[._-]|$)/i,
  /(?:^|[._-])secrets?(?:[._-]|$)/i,
  /\.g(?:\.i)?\.cs$/i,
  /\.generated\.[^.]+$/i,
  /^packages\.lock\.json$/i,
  /^project\.assets\.json$/i,
];

export interface FeaturedFileDescriptor extends FeaturedFile {
  key: string;
  language: string;
  languageLabel: string;
  githubUrl: string;
  routePath: string;
}

export type FeaturedFileReadResult =
  | {
      status: "ready";
      descriptor: FeaturedFileDescriptor;
      code: string;
      size: number;
    }
  | {
      status: "unavailable";
      descriptor: FeaturedFileDescriptor;
      reason: string;
    };

export type FeaturedPathValidation =
  | {
      valid: true;
      extension: string;
      language: string;
      languageLabel: string;
    }
  | {
      valid: false;
      reason: string;
    };

function slugifyPath(filePath: string): string {
  return filePath
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function featuredFileKey(
  file: FeaturedFile,
  index: number,
): string {
  return `${String(index + 1).padStart(2, "0")}-${slugifyPath(file.path)}`;
}

export function validateFeaturedFilePath(
  relativePath: string,
): FeaturedPathValidation {
  if (
    relativePath.length === 0 ||
    relativePath.includes("\\") ||
    path.posix.isAbsolute(relativePath) ||
    /^[A-Za-z]:/.test(relativePath)
  ) {
    return {
      valid: false,
      reason: "The featured path must be relative to the sample folder.",
    };
  }

  const segments = relativePath.split("/");
  if (
    segments.some(
      (segment) => segment.length === 0 || segment === "." || segment === "..",
    )
  ) {
    return {
      valid: false,
      reason: "The featured path contains an unsafe traversal segment.",
    };
  }

  if (
    segments
      .slice(0, -1)
      .some((segment) => deniedDirectoryNames.has(segment.toLowerCase()))
  ) {
    return {
      valid: false,
      reason: "Generated and build artifact folders cannot be featured.",
    };
  }

  const filename = segments.at(-1) ?? "";
  if (deniedFilePatterns.some((pattern) => pattern.test(filename))) {
    return {
      valid: false,
      reason: "Generated or potentially sensitive files cannot be featured.",
    };
  }

  const extension = path.posix.extname(filename).toLowerCase();
  const language = safeFeaturedFileExtensions.get(extension);
  if (!language) {
    return {
      valid: false,
      reason: `The ${extension || "extensionless"} file type is not in the safe text allowlist.`,
    };
  }

  return {
    valid: true,
    extension,
    language: language.language,
    languageLabel: language.label,
  };
}

export function describeFeaturedFiles(
  sample: CatalogSample,
): FeaturedFileDescriptor[] {
  return sample.featuredFiles.map((file, index) => {
    const validation = validateFeaturedFilePath(file.path);
    return {
      ...file,
      key: featuredFileKey(file, index),
      language: validation.valid ? validation.language : "text",
      languageLabel: validation.valid
        ? validation.languageLabel
        : "Unavailable",
      githubUrl: repositoryBlobUrl(
        sample.project.repositoryPath,
        file.path,
      ),
      routePath: sampleCodePath(sample.id, featuredFileKey(file, index)),
    };
  });
}

function unavailable(
  descriptor: FeaturedFileDescriptor,
  reason: string,
): FeaturedFileReadResult {
  return { status: "unavailable", descriptor, reason };
}

export async function readFeaturedFile(
  sample: CatalogSample,
  descriptor: FeaturedFileDescriptor,
  root = repositoryRoot,
): Promise<FeaturedFileReadResult> {
  const validation = validateFeaturedFilePath(descriptor.path);
  if (!validation.valid) {
    return unavailable(descriptor, validation.reason);
  }

  const directory = sampleDirectory(sample, root);
  const candidate = path.resolve(
    directory,
    ...descriptor.path.split("/"),
  );
  if (!isPathInside(directory, candidate)) {
    return unavailable(
      descriptor,
      "The featured path resolves outside the sample folder.",
    );
  }

  try {
    const candidateEntry = await lstat(candidate);
    if (!candidateEntry.isFile() || candidateEntry.isSymbolicLink()) {
      return unavailable(
        descriptor,
        "Only regular, non-symbolic-link files can be featured.",
      );
    }

    const [realDirectory, realCandidate] = await Promise.all([
      realpath(directory),
      realpath(candidate),
    ]);
    if (!isPathInside(realDirectory, realCandidate)) {
      return unavailable(
        descriptor,
        "The featured path resolves outside the sample folder.",
      );
    }

    const file = await stat(realCandidate);
    if (file.size > featuredFileSizeLimit) {
      return unavailable(
        descriptor,
        `This file is larger than the ${featuredFileSizeLimit / 1024} KiB preview limit.`,
      );
    }

    const bytes = await readFile(realCandidate);
    if (bytes.includes(0)) {
      return unavailable(
        descriptor,
        "Binary content cannot be displayed in the code browser.",
      );
    }

    let code: string;
    try {
      code = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return unavailable(
        descriptor,
        "The file is not valid UTF-8 text.",
      );
    }

    return {
      status: "ready",
      descriptor: {
        ...descriptor,
        language: validation.language,
        languageLabel: validation.languageLabel,
      },
      code,
      size: file.size,
    };
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "unknown";
    return unavailable(
      descriptor,
      `The file could not be read during the static build (${code}).`,
    );
  }
}
