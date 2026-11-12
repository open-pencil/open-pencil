import * as v from 'valibot'

/**
 * What the router loads statically, gzipped: the bulk of startup, not all of it, as the boot code
 * before the router and any dynamic import at startup are left out. Raise it only for a deliberate
 * cost.
 *
 * 2870 → 2900 for live pages: a frame that shows a route of the running application, the project
 * record that names the application, and the source-control panel that proposes the change. Their
 * code shares one static graph with the editor, so deferring the panels only moves the same bytes
 * into chunks the router still loads, and costs gzip density: measured, four deferred screens took
 * the startup set from 2878 KiB to 2883 KiB. The cost is taken here instead, and the graph stays as
 * the rest of the editor's.
 */
export const STARTUP_BUDGET_KIB = 2900
export const STARTUP_ENTRY = 'src/router.ts'

const manifestSchema = v.record(
  v.string(),
  v.object({ file: v.string(), imports: v.optional(v.array(v.string())) })
)

export type Manifest = v.InferOutput<typeof manifestSchema>

export function parseManifest(text: string): Manifest {
  const result = v.safeParse(v.pipe(v.string(), v.parseJson(), manifestSchema), text)
  if (!result.success) throw new Error(`Invalid Vite manifest: ${result.issues[0].message}`)
  return result.output
}

/** The files `entry` loads statically, which all arrive before it runs. */
export function staticFiles(manifest: Manifest, entry: string): string[] {
  const seen = new Set<string>()
  const visit = (key: string) => {
    if (seen.has(key)) return
    const chunk = manifest[key]
    if (!chunk) throw new Error(`The Vite manifest has no ${key}`)
    seen.add(key)
    chunk.imports?.forEach(visit)
  }
  visit(entry)
  return [...seen].flatMap((key) => manifest[key]?.file ?? [])
}
