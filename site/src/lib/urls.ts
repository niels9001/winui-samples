import { withBasePath } from "./base-path";

export const repositoryWebUrl = "https://github.com/niels9001/winui-samples";
export const repositoryCloneUrl =
  "https://github.com/niels9001/winui-samples.git";

export function sitePath(path: string): string {
  return withBasePath(path, import.meta.env.BASE_URL);
}

function encodeRepositoryPath(repositoryPath: string): string {
  if (
    repositoryPath.length === 0 ||
    repositoryPath.includes("\\") ||
    repositoryPath.startsWith("/") ||
    /^[A-Za-z]:/.test(repositoryPath)
  ) {
    throw new Error(`Repository path must be relative: ${repositoryPath}`);
  }

  const segments = repositoryPath.split("/");
  if (
    segments.some(
      (segment) => segment.length === 0 || segment === "." || segment === "..",
    )
  ) {
    throw new Error(
      `Repository path must not contain empty or traversal segments: ${repositoryPath}`,
    );
  }

  return segments.map((segment) => encodeURIComponent(segment)).join("/");
}

export function repositoryTreeUrl(repositoryPath: string): string {
  return `${repositoryWebUrl}/tree/main/${encodeRepositoryPath(repositoryPath)}`;
}

export function repositoryBlobUrl(
  repositoryPath: string,
  filePath: string,
): string {
  return `${repositoryWebUrl}/blob/main/${encodeRepositoryPath(
    `${repositoryPath}/${filePath}`,
  )}`;
}

export function repositoryReadmeUrl(repositoryPath: string): string {
  return repositoryBlobUrl(repositoryPath, "README.md");
}

export function sampleDetailPath(sampleId: string): string {
  return `/samples/${encodeURIComponent(sampleId)}/`;
}

export function sampleCodePath(sampleId: string, fileKey: string): string {
  return `/samples/${encodeURIComponent(sampleId)}/code/${encodeURIComponent(
    fileKey,
  )}/`;
}
