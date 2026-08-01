export { parseDeckBuffer, type DeckParseResult } from './parse'
export { restructureDeckNodeChanges, collectActiveSlides } from './restructure'
export { structurePagesToDeck } from './structure'
export {
  CARRIED_SLIDE_FIELDS,
  pickCarriedSlideFields,
  withoutCarriedSlideFields
} from './slide-fields'
export type { CarriedSlideField, CarriedSlideFields } from './slide-fields'
export { writeDeckArchive, defaultDeckMetaJson, type WriteDeckArchiveInput } from './archive'
export {
  normalizeDeckCanvasPrelude,
  setCanvasPrelude,
  readCanvasPrelude,
  FIG_DECK_PRELUDE,
  FIG_KIWI_PRELUDE
} from './prelude'
export {
  createEmptyDeckGraph,
  addEmptySlide,
  EMPTY_SLIDE_WIDTH,
  EMPTY_SLIDE_HEIGHT,
  EMPTY_SLIDE_CORNER_RADIUS,
  type CreateEmptyDeckOptions,
  type AddEmptySlideOptions
} from './empty'
