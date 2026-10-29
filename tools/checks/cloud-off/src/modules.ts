/**
 * Which source modules belong to OpenPencil Cloud, so a build without it can show it bundled none.
 * The protocol in `packages/cloud/src/contract` is shared with peer-to-peer rooms and may stay;
 * Cloud's two entry points stand in for it through their `off` modules.
 */
const CLOUD_MODULES = [
  /^packages\/cloud\/src\//,
  /^src\/app\/cloud\//,
  /^src\/app\/collab\/transport\/cloud\.ts$/,
  /^src\/app\/integrations\/storage\/cloud\//,
  /^src\/components\/cloud\//,
  /^src\/components\/home\/cloud\//,
  /^src\/components\/settings\/cloud\//
]

const ALLOWED_MODULES = [
  /^packages\/cloud\/src\/contract\//,
  /^src\/app\/cloud\/integration\/off\//,
  // The storage provider's identifier, which Home and Save to compare locations with.
  /^src\/app\/cloud\/sessions\/token\.ts$/,
  /^src\/components\/cloud\/integration\/off\.ts$/
]

/** The Cloud modules among a build's module IDs, as repository-relative paths. */
export function cloudModulesIn(moduleIds: Iterable<string>, repoRoot: string): string[] {
  const prefix = `${repoRoot.replace(/\/$/, '')}/`
  const found = new Set<string>()
  for (const id of moduleIds) {
    // Vue compiles a component into several virtual modules that share its path.
    const path = id.split('?')[0] ?? id
    if (!path.startsWith(prefix)) continue
    const relative = path.slice(prefix.length)
    if (!CLOUD_MODULES.some((pattern) => pattern.test(relative))) continue
    if (ALLOWED_MODULES.some((pattern) => pattern.test(relative))) continue
    found.add(relative)
  }
  return [...found].sort()
}
