export function normalizeBasePath(basePath: string): string {
  const trimmed = basePath.trim();

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    throw new Error(`Base path must be root-relative: ${basePath}`);
  }

  if (trimmed.includes("?") || trimmed.includes("#")) {
    throw new Error(`Base path must not include a query or fragment: ${basePath}`);
  }

  if (trimmed === "/") {
    return "/";
  }

  return `/${trimmed.replace(/^\/+|\/+$/g, "")}/`;
}

export function withBasePath(path: string, basePath: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error(`Site path must be root-relative: ${path}`);
  }

  const normalizedBase = normalizeBasePath(basePath);
  if (path === "/") {
    return normalizedBase;
  }

  return `${normalizedBase}${path.slice(1)}`;
}
