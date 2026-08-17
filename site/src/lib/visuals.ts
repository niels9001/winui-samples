export function fallbackVisualIndex(categoryId: string): number {
  let hash = 0;
  for (const character of categoryId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash % 6;
}
