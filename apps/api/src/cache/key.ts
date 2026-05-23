/**
 * Build a versioned cache key.
 *
 * Shape: `<domain>:<entity>:v<version>:<segment>:<segment>:...`
 *
 * Bumping the version segment is the migration strategy when the cached value
 * shape changes — old keys time out naturally via TTL rather than requiring a
 * Redis flush. See docs/architecture.md §8.1.
 */
export function cacheKey(
  domain: string,
  entity: string,
  version: number,
  ...segments: (string | number | boolean)[]
): string {
  const head = `${domain}:${entity}:v${version}`;
  if (segments.length === 0) return head;
  return `${head}:${segments.join(":")}`;
}
