import type { CatalogSample } from "./catalog";
import {
  repositoryBlobUrl,
  repositoryTreeUrl,
  repositoryWebUrl,
} from "./urls";

export interface SampleSource {
  id: string;
  label: string;
  canonicalUrl: string;
  catalogUrl: string;
}

export const localCatalogSource = {
  id: "winui-samples",
  label: "WinUI samples",
  catalogUrl: repositoryWebUrl,
} as const;

export function getSampleProvider(sample: CatalogSample) {
  return sample.provider ?? {
    id: localCatalogSource.id,
    label: localCatalogSource.label,
    kind: "local" as const,
  };
}

export function getSampleSource(sample: CatalogSample): SampleSource {
  if (sample.source) {
    return {
      ...sample.source,
      catalogUrl:
        sample.federated?.record.links.repository ??
        sample.source.canonicalUrl,
    };
  }

  return {
    ...localCatalogSource,
    canonicalUrl: repositoryTreeUrl(sample.project.repositoryPath),
  };
}

export function developerDocumentation(sample: CatalogSample) {
  return sample.documentation.filter(
    (document) => document.kind !== "migration",
  );
}

export function sampleSourceFileUrl(
  sample: CatalogSample,
  filePath: string,
): string {
  const featured = sample.featuredFiles.find(
    (file) => file.path === filePath,
  );
  if (featured?.canonicalUrl) {
    return featured.canonicalUrl;
  }
  if (!sample.source) {
    return repositoryBlobUrl(sample.project.repositoryPath, filePath);
  }

  if (sample.federated) {
    const encodedFilePath = filePath
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    return `${sample.federated.record.links.repository}/blob/${sample.federated.record.source.lockedCommitSha}/${encodedFilePath}`;
  }

  const canonical = new URL(sample.source.canonicalUrl);
  const treePath =
    canonical.hostname === "github.com"
      ? /^\/([^/]+)\/([^/]+)\/tree\/([^/]+)(\/.*)?$/.exec(
          canonical.pathname,
        )
      : null;
  if (!treePath) {
    return sample.source.canonicalUrl;
  }

  const [, owner, repository, reference, sourcePath = ""] = treePath;
  const encodedFilePath = filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  canonical.pathname = `/${owner}/${repository}/blob/${reference}${sourcePath}/${encodedFilePath}`;
  return canonical.toString();
}
