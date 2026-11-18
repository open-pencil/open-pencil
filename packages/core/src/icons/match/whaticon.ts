import { gunzipSync } from 'fflate'
import { parseIndex, type IconIndex } from 'whaticon/hash'

/**
 * whaticon's index of the popular Iconify sets, as the npm package ships it. jsDelivr serves it
 * to any page, as it serves Material Symbols' names. The version is fixed so the index is hashed
 * as the `whaticon/hash` Core depends on hashes; moving it with that dependency picks up the sets'
 * newer icons.
 */
const INDEX = 'https://cdn.jsdelivr.net/npm/whaticon@0.3.0/data'

/**
 * How long the index may take to download, body included, before naming icons gives up and the
 * import keeps its SVG as artwork; the next import tries again.
 */
const INDEX_TIMEOUT_MS = 30_000

async function fetchGzipped(fetcher: typeof globalThis.fetch, file: string): Promise<Uint8Array> {
  const response = await fetcher(`${INDEX}/${file}`, {
    signal: AbortSignal.timeout(INDEX_TIMEOUT_MS)
  })
  if (!response.ok) throw new Error(`whaticon's index answered ${response.status} for ${file}`)
  return gunzipSync(new Uint8Array(await response.arrayBuffer()))
}

/** whaticon's index of the popular Iconify sets: about 60,000 icons, 1.9 MB to download. */
export async function fetchIconIndex(fetcher: typeof globalThis.fetch): Promise<IconIndex> {
  const [names, hashes] = await Promise.all([
    fetchGzipped(fetcher, 'names.txt.gz'),
    fetchGzipped(fetcher, 'hashes.bin.gz')
  ])
  return parseIndex(new TextDecoder().decode(names), hashes)
}
