export type { GUID, Color, Vector, Matrix, Rect } from './types'
export { degToRad, radToDeg, rotatePoint, rotatedCorners, rotatedBBox } from './geometry'
export { randomHex, randomInt, randomIndex } from './random'

export * from './constants'

export {
  SceneGraph,
  generateId,
  type SceneNode,
  type NodeType,
  type Fill,
  type FillType,
  type Stroke,
  type StrokeCap,
  type StrokeJoin,
  type MaskType,
  type Effect,
  type BlendMode,
  type ImageScaleMode,
  type GradientStop,
  type GradientTransform,
  type LayoutMode,
  type LayoutSizing,
  type LayoutAlign,
  type LayoutAlignSelf,
  type LayoutCounterAlign,
  type LayoutWrap,
  type GridTrack,
  type GridTrackSizing,
  type GridPosition,
  type ConstraintType,
  type TextAutoResize,
  type TextAlignVertical,
  type TextCase,
  type TextDecoration,
  type ArcData,
  type VectorNetwork,
  type VectorVertex,
  type VectorSegment,
  type VectorRegion,
  type GeometryPath,
  type HandleMirroring,
  type WindingRule,
  type VariableType,
  type VariableValue,
  type Variable,
  type VariableCollection,
  type VariableCollectionMode,
  type CharacterStyleOverride,
  type StyleRun,
  type SceneGraphEvents
} from './scene-graph'

export { FigmaAPI, FigmaNodeProxy, computeImageHash, type FigmaFontName } from './figma-api'
export { ALL_TOOLS, CORE_TOOLS, EXTENDED_TOOLS, defineTool, toolsToAI, buildDebugLog } from './tools'
export type { ToolDef, ParamDef, ParamType, ToolLogEntry, ToolDebugLog, AIAdapterOptions, StepBudget } from './tools'
export { executeRpcCommand, ALL_RPC_COMMANDS } from './rpc'
export { queryByXPath, matchByXPath } from './xpath'
export type { XPathQueryOptions } from './xpath'
export type {
  InfoResult, PageItem, TreeArgs, TreeResult, TreeNodeResult,
  FindArgs, FindNodeResult, QueryArgs, QueryNodeResult, NodeArgs, NodeResult,
  VariablesArgs, VariablesResult,
  AnalyzeColorsArgs, AnalyzeColorsResult,
  AnalyzeTypographyArgs, AnalyzeTypographyResult,
  AnalyzeSpacingResult, SpacingValue,
  AnalyzeClustersArgs, AnalyzeClustersResult, TypographyStyle
} from './rpc'
export { SkiaRenderer, type RenderOverlays } from './renderer/index'
export { LabelCache, type CachedSection, type CachedComponent } from './renderer/label-cache'
export {
  RenderProfiler,
  FrameStats,
  GPUTimer,
  DrawCallCounter,
  PhaseTimer,
  CaptureStack,
  toSpeedscopeJSON
} from './profiler'
export type { FrameCapture, NodeProfile } from './profiler'
export { computeLayout, computeAllLayouts, setTextMeasurer } from './layout'
export type { TextMeasurer } from './layout'
export { getCanvasKit, getGpuBackend, type CanvasKitOptions, type GpuBackend } from './canvaskit'
export {
  collectFontKeys,
  loadFont,
  listFamilies,
  initFontService,
  getFontProvider,
  isFontLoaded,
  getLoadedFontData,
  markFontLoaded,
  ensureNodeFont,
  ensureCJKFallback,
  getCJKFallbackFamily,
  setCJKFallbackFamily,
  styleToWeight,
  weightToStyle,
  normalizeFontFamily,
  isVariableFont,
  styleToVariant,
  fetchBundledFont
} from './fonts'
export {
  parseColor,
  normalizeColor,
  colorToHex,
  colorToHex8,
  colorToHexRaw,
  colorToRgba255,
  colorToCSS,
  colorToCSSCompact,
  rgba255ToColor,
  colorToFill,
  colorDistance
} from './color'
export {
  vectorNetworkToPath,
  geometryBlobToPath,
  decodeVectorNetworkBlob,
  encodeVectorNetworkBlob,
  computeVectorBounds
} from './vector'
export { computeSelectionBounds, computeSnap, type SnapGuide } from './snap'
export { UndoManager, type UndoEntry } from './undo'
export { TextEditor, type TextCaret, type TextEditorState } from './text-editor'
export {
  getStyleAt,
  applyStyleToRange,
  removeStyleFromRange,
  selectionHasStyle,
  toggleBoldInRange,
  toggleItalicInRange,
  toggleDecorationInRange,
  adjustRunsForInsert,
  adjustRunsForDelete
} from './style-runs'
export { renderNodesToImage, renderThumbnail, computeContentBounds, type ExportFormat } from './render-image'
export { initCanvasKit, headlessRenderNodes, headlessRenderThumbnail } from './headless-render'
export {
  renderNodesToSVG,
  geometryBlobToSVGPath,
  vectorNetworkToSVGPaths,
  type SVGExportOptions
} from './svg-export'
export { svg, renderSVGNode, type SVGNode } from './svg-node'
export { parseSVGPath } from './svg-path-parse'
export { parseSVGFile, extractPaths } from './svg-import'
export { createIconFromPaths } from './icon-render'
export { fetchIcon, fetchIcons, searchIcons, searchIconsBatch, clearIconCache, type IconData, type IconPath, type IconSearchResult } from './iconify'
export { exportFigFile, compressFigData, compressFigDataSync } from './fig-export'
export {
  FIG_KIWI_VERSION,
  buildFigKiwi,
  parseFigKiwiChunks,
  decompressFigKiwiData,
  decompressFigKiwiDataAsync,
  sceneNodeToKiwi,
  fractionalPosition,
  mapToFigmaType
} from './kiwi-serialize'

export {
  createElement,
  renderTree,
  renderJSX,
  renderTreeNode,
  buildComponent,
  Frame,
  Text,
  Rectangle,
  Ellipse,
  Line,
  Star,
  Polygon,
  Vector as VectorNode,
  Group,
  Section,
  View,
  Rect as RectNode,
  Component as ComponentNode,
  Instance as InstanceNode,
  Page as PageNode,
  INTRINSIC_ELEMENTS,
  isTreeNode,
  resolveToTree,
  node,
  type TreeNode,
  type BaseProps,
  type TextProps,
  type StyleProps,
  type RenderResult,
  sceneNodeToJSX,
  selectionToJSX,
  type JSXFormat
} from './render'
export {
  parseFigmaClipboard,
  importClipboardNodes,
  figmaNodesBounds,
  parseOpenPencilClipboard,
  buildFigmaClipboardHTML,
  buildOpenPencilClipboardHTML,
  prefetchFigmaSchema,
  type TextPictureBuilder,
  type OpenPencilClipboardData
} from './clipboard'

export {
  readFigFile,
  parseFigFile,
  importNodeChanges,
  initCodec,
  encodeMessage,
  decodeMessage,
  compress,
  decompress,
  getCompiledSchema,
  getSchemaBytes,
  isCodecReady,
  peekMessageType,
  createNodeChangesMessage,
  createNodeChange,
  parseVariableId,
  encodePaintWithVariableBinding,
  encodeNodeChangeWithVariables,
  type NodeChange,
  type GUID as KiwiGUID,
  type Color as KiwiColor,
  type Paint as KiwiPaint,
  type Effect as KiwiEffect,
  type VariableBinding,
  type ParentIndex,
  type FigmaMessage,
  MESSAGE_TYPES,
  NODE_TYPES,
  NODE_PHASES,
  BLEND_MODES,
  PAINT_TYPES,
  PROTOCOL_VERSION,
  KIWI,
  SESSION_ID,
  ZSTD_MAGIC,
  buildMultiplayerUrl,
  isZstdCompressed,
  hasFigWireHeader,
  skipFigWireHeader,
  isKiwiMessage,
  getKiwiMessageType,
  parseVarint,
  FIG_WIRE_MAGIC
} from './kiwi'

export { CODEGEN_PROMPT } from './tools/prompts/codegen-prompt'
export {
  setPexelsApiKey,
  setUnsplashAccessKey,
  registerStockPhotoProvider,
  setActiveStockPhotoProvider,
  getStockPhotoProviders
} from './tools/stock-photo'
export type { StockPhotoProvider, StockPhotoResult } from './tools/stock-photo'
