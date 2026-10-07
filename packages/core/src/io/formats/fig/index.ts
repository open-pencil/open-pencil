export { readFigFile, parseFigFile, type ParseFigFileOptions } from './read'
export { exportFigFile, compressFigData, compressFigDataSync } from './write'
export { findFigThumbnailPageId } from './thumbnail-page'
export {
  isReaderPagePending as isFigPagePending,
  populateFigPage,
  populateAllFigPages,
  readerDiagnostics
} from '#core/kiwi/fig/session/document-state'
