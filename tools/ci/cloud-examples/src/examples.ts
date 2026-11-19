import { buildDemoDocument } from '@open-pencil/demo-tools'

/** An example the gallery shows: its document's name there, and how to build its file. */
export type ExampleSource = { name: string; build(): Promise<Uint8Array> }

/**
 * The examples the gallery publishes, each a document of its own under this name. The tour is
 * built from its sources here and lives only in the gallery, where the app and the docs landing
 * open it from.
 */
export const EXAMPLES: ExampleSource[] = [{ name: 'Welcome tour', build: buildDemoDocument }]
