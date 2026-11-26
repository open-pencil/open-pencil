import { SHOTS as autoLayout } from './auto-layout.ts'
import { SHOTS as canvasNavigation } from './canvas-navigation.ts'
import { SHOTS as components } from './components/index.ts'
import { SHOTS as componentLibraries } from './components/libraries.ts'
import { SHOTS as exporting } from './exporting.ts'
import { SHOTS as files } from './files.ts'
import { SHOTS as gettingStarted } from './getting-started.ts'
import { SHOTS as layersAndPages } from './layers-and-pages.ts'
import { SHOTS as selectionAndManipulation } from './selection-and-manipulation.ts'
import type { Shot } from './shared.ts'
import { SHOTS as variables } from './variables.ts'

export type { Shot }

/** The guide's pages by the folder their pictures go in, which is their address in the docs. */
const PAGES: Record<string, Record<string, Shot>> = {
  'auto-layout': autoLayout,
  'canvas-navigation': canvasNavigation,
  'component-libraries': componentLibraries,
  components,
  exporting,
  files,
  'getting-started': gettingStarted,
  'layers-and-pages': layersAndPages,
  'selection-and-manipulation': selectionAndManipulation,
  variables
}

/** Every picture in the guide, by `<page>/<picture>`, the name `GuideImage` takes. */
export const SHOTS: Record<string, Shot> = Object.fromEntries(
  Object.entries(PAGES).flatMap(([page, shots]) =>
    Object.entries(shots).map(([name, shot]) => [`${page}/${name}`, shot])
  )
)
