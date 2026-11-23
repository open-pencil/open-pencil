import { buildDemoDocument } from '@open-pencil/demo-tools'
import { buildDemoBoard } from '@open-pencil/demo-tools/board'
import { BOARD_NAME } from '@open-pencil/demo-tools/board/names'

/** An example the gallery shows: its document's name there, and how to build its file. */
export type ExampleSource = { name: string; build(): Promise<Uint8Array> }

/**
 * The examples the gallery publishes, each a document of its own under this name. The tour and
 * the board are built from their sources here and live only in the gallery, where the app and the
 * docs landing open them from.
 */
export const EXAMPLES: ExampleSource[] = [
  { name: 'Welcome tour', build: buildDemoDocument },
  { name: BOARD_NAME, build: buildDemoBoard }
]
