import { withBasePath } from "./base-path";

export function sitePath(path: string): string {
  return withBasePath(path, import.meta.env.BASE_URL);
}
