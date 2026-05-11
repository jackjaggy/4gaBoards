// Escape a string for safe inclusion inside a RegExp literal.
// Used by page objects when building accessible-name patterns from dynamic data
// (e.g. a card's accessible name is "<name> Edit Card", and <name> may contain regex metacharacters).
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Random-suffix name generator. Unique names prevent collisions on the persistent Postgres volume across reruns.
export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}
