export {
  compressFigDataSync,
  parseFigBuffer,
  writeFigArchive,
  type FigImageEntry,
  type FigParseResult,
  type WriteFigArchiveInput
} from './archive'
export {
  effectiveFigmaRawNodeFields,
  effectiveFigmaSourcePayload,
  readEffectiveFigmaRawField,
  staleFigmaRawFields
} from './source-metadata'

import {
  FIG_KIWI_DEFAULT_VERSION,
  buildFigKiwi,
  decompressFigKiwiData,
  parseFigKiwiChunks
} from '@open-pencil/kiwi/fig/container'

export interface FigDocumentSource {
  readonly bytes?: Uint8Array
  readonly fileName?: string
}

export interface FigDocument<Graph = unknown> {
  readonly graph: Graph
  readonly source?: FigDocumentSource
}

export interface ReadFigOptions {
  readonly preserveRawMetadata?: boolean
}

export interface WriteFigOptions {
  readonly source?: FigDocumentSource
}

export interface FigContainerDocument {
  readonly schemaDeflated: Uint8Array
  readonly dataRaw: Uint8Array
  readonly source?: FigDocumentSource
}

export interface ReadFigContainerOptions {
  readonly fileName?: string
}

export interface WriteFigContainerOptions {
  readonly version?: number
}

export const FIG_PACKAGE_STATUS = 'archive-api' as const

export function readFigContainer(
  bytes: Uint8Array,
  options: ReadFigContainerOptions = {}
): FigContainerDocument {
  const chunks = parseFigKiwiChunks(bytes)
  if (!chunks) throw new Error('Invalid fig-kiwi container')
  const [schemaDeflated, dataDeflated] = chunks
  return {
    schemaDeflated,
    dataRaw: decompressFigKiwiData(dataDeflated),
    source: { bytes, fileName: options.fileName }
  }
}

export function writeFigContainer(
  document: FigContainerDocument,
  options: WriteFigContainerOptions = {}
): Uint8Array {
  return buildFigKiwi(
    document.schemaDeflated,
    document.dataRaw,
    options.version ?? FIG_KIWI_DEFAULT_VERSION
  )
}

export function assertFigPackageReady(): void {
  throw new Error(
    '@open-pencil/fig currently exposes archive/container APIs; use @open-pencil/core for SceneGraph .fig read/write APIs for now.'
  )
}
