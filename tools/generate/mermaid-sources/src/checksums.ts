import { createHash } from 'node:crypto'

/**
 * The SHA-256 of each file the generator writes into the upstream folder, by file name, kept
 * beside the generator so a hand edit to a copied or generated file fails a test.
 */
export const CHECKSUMS_FILE = 'tools/generate/mermaid-sources/checksums.json'

export function checksum(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

export function checksums(files: Map<string, string>): Record<string, string> {
  return Object.fromEntries(
    [...files]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([file, content]) => [file, checksum(content)])
  )
}
