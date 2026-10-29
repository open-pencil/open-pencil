export { readFigFile, parseFigFile, type ParseFigFileOptions } from './read'
export { exportFigFile, compressFigData, type FigFileExtrasOptions } from './write'
export { figThumbnailPageId } from './thumbnail-page'
export {
  isReaderPagePending as isFigPagePending,
  populateFigPage,
  populateAllFigPages,
  readerDiagnostics
} from '#core/kiwi/fig/session/document-state'
export { buildFontDigestMap } from '#core/kiwi/fig/node-change/font/digests'
