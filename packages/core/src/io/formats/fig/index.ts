export { readFigFile, parseFigFile, type ParseFigFileOptions } from './read'
export {
  exportFigFile,
  exportFigFileStream,
  compressFigData,
  setFigArchiveAssembler,
  setFigCanvasCompressor,
  type FigArchiveAssembler,
  type FigArchiveParts,
  type FigArchiveSink,
  type FigCanvasCompressor,
  type FigCanvasParts,
  type FigFileExtrasOptions,
  type FigFileStreamOptions
} from './write'
export { figThumbnailPageId } from './thumbnail-page'
export {
  isReaderPagePending as isFigPagePending,
  populateFigPage,
  populateAllFigPages,
  readerDiagnostics
} from '#core/kiwi/fig/session/document-state'
export { buildFontDigestMap } from '#core/kiwi/fig/node-change/font/digests'
