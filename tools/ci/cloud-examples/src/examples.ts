import { buildDemoDocument } from '@open-pencil/demo-tools'
import { buildDemoBoard } from '@open-pencil/demo-tools/board'
import { BOARD_NAME } from '@open-pencil/demo-tools/board/names'

/**
 * An example the gallery shows: its document's name there, what it is in a sentence or two (what
 * its page and search results say), and how to build its file.
 */
export type ExampleSource = { name: string; description: string; build(): Promise<Uint8Array> }

/**
 * The examples the gallery publishes, each a document of its own under this name. The tour and
 * the board are built from their sources here and live only in the gallery, where the app and the
 * docs landing open them from.
 */
export const EXAMPLES: ExampleSource[] = [
  {
    name: 'Welcome tour',
    description:
      'A tour of OpenPencil in eight chapters: components with slots, variants and controls, variable modes, live shaders, code export, and design lint.',
    build: buildDemoDocument
  },
  {
    name: BOARD_NAME,
    description:
      'A planning board: feature requests on stickies grouped by colour, and the flow that ships one, drawn in shapes and connectors.',
    build: buildDemoBoard
  }
]
