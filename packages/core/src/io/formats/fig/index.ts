export { readFigFile, parseFigFile, type ParseFigFileOptions } from './read'
export {
  exportFigFile,
  compressFigData,
  compressFigDataSync,
  type FigFileExtrasOptions
} from './write'
export { documentThumbnailPageId, findFigThumbnailPageId } from './thumbnail-page'
export {
  isReaderPagePending as isFigPagePending,
  populateFigPage,
  populateAllFigPages,
  readerDiagnostics
} from '#core/kiwi/fig/session/document-state'
