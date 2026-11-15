export { readFigFile, parseFigFile, type ParseFigFileOptions } from './read'
export {
  exportFigFile,
  exportFigFileStream,
  setFigCanvasCompressor,
  type FigCanvasCompressor,
  type FigCanvasParts,
  type FigFileExtrasOptions
} from './write'
export { figThumbnailPageId } from './thumbnail-page'
export {
  isReaderPagePending as isFigPagePending,
  pendingReaderPageOfNode as pendingFigPageOfNode,
  populateFigPage,
  populateAllFigPages,
  readerDiagnostics
} from '#core/kiwi/fig/session/document-state'
export { buildFontDigestMap } from '#core/kiwi/fig/node-change/font/digests'
export { stopFigReaderWorker } from '#core/kiwi/fig/population/client'
