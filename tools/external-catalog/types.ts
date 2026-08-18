export type ProviderId = string;
export type GlobalRecordId = `${ProviderId}:${string}`;
export type GitSha = string;
export type Sha256 = string;
export type ProvenanceKind =
  | "authored"
  | "curated"
  | "derived"
  | "technical";

export interface ProviderIdentity {
  id: ProviderId;
  name: string;
  kind: "local" | "external";
}

export interface RepositoryIdentity {
  owner: string;
  name: string;
  url: string;
}

export interface FieldProvenance {
  field: `/${string}`;
  kind: ProvenanceKind;
  sourcePath: string;
}

export interface NestedSourceUnit {
  id: string;
  kind: "variant" | "scenario" | "example";
  position: number;
  title: string;
  summary: string | null;
  description: string | null;
  sourcePaths: string[];
  technologies: TechnologySet;
  apis: string[];
  documentation: DocumentationLink[];
  children: NestedSourceUnit[];
}

export interface TechnologySet {
  languages: string[];
  projectTypes: string[];
  packaging: string[];
}

export interface ApiReference {
  name: string;
  description: string | null;
  url: string | null;
}

export interface DocumentationLink {
  title: string;
  url: string;
  kind: "learn" | "api-reference" | "concept" | "repository" | "other";
}

export interface NormalizedCatalogRecord {
  schemaVersion: 1;
  id: GlobalRecordId;
  provider: ProviderIdentity;
  recordKey: string;
  route: {
    slug: string;
    path: `samples/${string}`;
    previousPaths: Array<{
      path: `samples/${string}`;
      declaredAtSync: string;
      reason: string;
    }>;
  };
  source: {
    repository: RepositoryIdentity;
    ref: string;
    lockedCommitSha: GitSha;
    treeSha: GitSha;
    commitTime: string;
    path: string;
    canonicalUrl: string;
  };
  title: {
    display: string;
    upstream: string | null;
  };
  summary: string | null;
  description: string | null;
  technicalAliases: string[];
  categories: {
    provider: string[];
    portal: {
      primary: string | null;
      secondary: string[];
    };
  };
  tags: string[];
  technologies: TechnologySet;
  apis: ApiReference[];
  documentation: DocumentationLink[];
  requirements: {
    minimumWindowsVersion: string | null;
    architectures: string[];
    declaredPackageCapabilities: Array<{
      name: string;
      kind: "general" | "device" | "restricted" | "unknown";
      description: string | null;
    }>;
    prerequisites: {
      hardware: string[];
      accountsAndServices: string[];
      software: string[];
      notes: string[];
    };
  };
  links: {
    provider: { label: string; url: string };
    repository: string;
    source: string;
    commit: string;
    tree: string;
  };
  content: {
    variants: NestedSourceUnit[];
    scenarios: NestedSourceUnit[];
    examples: NestedSourceUnit[];
  };
  featuredSourceFiles: Array<{
    path: string;
    label: string;
    description: string | null;
    language: string | null;
    canonicalUrl: string;
    blobSha: GitSha;
    sha256: Sha256 | null;
    size: number | null;
  }>;
  images: Array<{
    id: string;
    path: string;
    url: string;
    mediaType: "image/png" | "image/jpeg" | "image/webp";
    width: number | null;
    height: number | null;
    alt: string;
    provenance: {
      kind: ProvenanceKind;
      sourcePath: string;
    };
    blobSha: GitSha;
    sha256: Sha256;
    size: number;
  }>;
  relations: Array<{
    type:
      | "related"
      | "same-concept"
      | "supersedes"
      | "superseded-by"
      | "variant-of"
      | "see-also";
    targetId: GlobalRecordId;
    providerId: ProviderId;
  }>;
  metadata: {
    completeness: "complete" | "partial" | "minimal";
    missingFields: `/${string}`[];
    warnings: Array<{
      code: string;
      message: string;
      field: string | null;
      sourcePath: string | null;
    }>;
  };
  attribution: {
    licenseRefs: string[];
    attributionRefs: string[];
  };
  badges: {
    upstreamEditorial: Array<{
      id: string;
      label: string;
      sourcePath: string;
    }>;
    portalLifecycle: Array<"new" | "updated">;
  };
  limitations: string[];
  lifecycle: {
    status: "active" | "tombstoned";
    firstSeenSync: string;
    lastReviewedSync: string;
    lastChangedSync: string | null;
    removedAtSync: string | null;
  };
  fieldProvenance: FieldProvenance[];
}

export interface ProviderSourceLock {
  providerId: ProviderId;
  repository: { owner: string; name: string };
  ref: string;
  commitSha: GitSha;
  treeSha: GitSha;
  commitTime: string;
  artifacts: Array<{
    path: string;
    blobSha: GitSha;
    sha256: Sha256;
    size: number;
    mediaType: string;
    cachePath: string;
  }>;
}

export interface ReviewedSync {
  id: string;
  reviewedAt: string;
  lockCommitSha: GitSha;
}

export interface ProviderRecordHistory {
  id: GlobalRecordId;
  recordKey: string;
  routePath: `samples/${string}`;
  status: "active" | "tombstoned";
  firstSeenSync: string;
  lastReviewedSync: string;
  lastChangedSync: string | null;
  removedAtSync: string | null;
}

export interface ProviderSyncHistory {
  providerId: ProviderId;
  latestSyncId: string;
  syncs: ReviewedSync[];
  records: ProviderRecordHistory[];
}

export interface CacheManifestEntry {
  providerId: ProviderId;
  repository: { owner: string; name: string };
  commitSha: GitSha;
  treeSha: GitSha;
  path: string;
  blobSha: GitSha;
  sha256: Sha256;
  size: number;
  mediaType: string;
  cachePath: string;
}

export interface ProviderAdapterContext {
  provider: {
    id: ProviderId;
    name: string;
    repository: { owner: string; name: string };
    routeNamespace: string;
    completenessPolicy: "not-enforced" | "enforced";
    expectedRecordCount: number | null;
  };
  lock: ProviderSourceLock;
  readArtifact(path: string): Promise<Uint8Array>;
  createRouteSlug(providerId: ProviderId, recordKey: string): string;
}

export interface ProviderOutput {
  schemaVersion: 1;
  providerId: ProviderId;
  reviewedSync: ReviewedSync;
  lock: ProviderSourceLock;
  records: NormalizedCatalogRecord[];
  redirects: Array<{
    fromPath: string;
    toId: GlobalRecordId;
    declaredAtSync: string;
    reason: string;
  }>;
  tombstones: Array<{
    id: GlobalRecordId;
    providerId: ProviderId;
    recordKey: string;
    routePath: string;
    removedAtSync: string;
    reason: string;
    redirectToId: GlobalRecordId | null;
  }>;
  licenseManifest: LicenseManifest | null;
}

export interface MergedExternalCatalog {
  schemaVersion: 1;
  catalogVersion: 1;
  generatedBy: "tools/external-catalog";
  generatedFrom: {
    registrySha256: Sha256;
    lockFileSha256: Sha256;
    cacheManifestSha256: Sha256;
    historySha256: Sha256;
    providerLocks: ProviderSourceLock[];
  };
  providers: Array<{
    id: ProviderId;
    name: string;
    kind: "external";
    repository: string;
    recordCount: number;
    reviewedSync: ReviewedSync;
  }>;
  records: NormalizedCatalogRecord[];
  redirects: ProviderOutput["redirects"];
  tombstones: ProviderOutput["tombstones"];
  licenses: LicenseManifest[];
  contentHash: Sha256;
}

export interface LicenseManifest {
  schemaVersion: 1;
  providerId: ProviderId;
  repository: { owner: string; name: string };
  lockedCommitSha: GitSha;
  entries: Array<{
    id: string;
    scopePath: string;
    spdxId: string | null;
    licensePath: string;
    licenseUrl: string;
    attributionText: string | null;
  }>;
}

export interface ProviderAdapter {
  generate(context: ProviderAdapterContext): Promise<ProviderOutput>;
}
