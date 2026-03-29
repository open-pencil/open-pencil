export type { GUID, Color, Vector, Matrix, Rect } from './types'
export {
  computeBounds,
  computeAbsoluteBounds,
  degToRad,
  radToDeg,
  rotatePoint,
  rotatedCorners,
  rotatedBBox
} from './geometry'
export { randomHex, randomInt, randomIndex } from './random'

export * from './constants'

export { createDefaultEditorState, createEditor, EDITOR_TOOLS, TOOL_SHORTCUTS } from './editor'
export type {
  Editor,
  EditorContext,
  EditorOptions,
  EditorState,
  EditorToolDef,
  Tool
} from './editor'

export {
  SceneGraph,
  generateId,
  cloneVectorNetwork,
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
  type TextDirection,
  type TextAlignVertical,
  type TextCase,
  type TextDecoration,
  type LayoutDirection,
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
  type SceneGraphEvents,
  type DocumentColorSpace
} from './scene-graph'

export { FigmaAPI, FigmaNodeProxy, computeImageHash, type FigmaFontName } from './figma-api'
export {
  ALL_TOOLS,
  CORE_TOOLS,
  EXTENDED_TOOLS,
  defineTool,
  toolsToAI,
  buildDebugLog,
  requireNode,
  NodeNotFoundError,
  calcClusterConfidence
} from './tools'
export type {
  ToolDef,
  ParamDef,
  ParamType,
  ToolLogEntry,
  ToolDebugLog,
  AIAdapterOptions,
  StepBudget
} from './tools'
export { executeRpcCommand, ALL_RPC_COMMANDS } from './rpc'
export { queryByXPath, matchByXPath } from './xpath'
export type { XPathQueryOptions } from './xpath'
export {
  okhclToRGBA,
  rgbaToOkHCL,
  serializeOkHCLPayload,
  parseOkHCLPayload,
  setNodeFillOkHCL,
  setNodeStrokeOkHCL,
  clearNodeFillOkHCL,
  clearNodeStrokeOkHCL,
  getNodeOkHCLPayloads,
  getFillOkHCL,
  getStrokeOkHCL,
  type OkHCLColor,
  type OkHCLPayload
} from './color/okhcl'
export type {
  InfoResult,
  PageItem,
  TreeArgs,
  TreeResult,
  TreeNodeResult,
  FindArgs,
  FindNodeResult,
  QueryArgs,
  QueryNodeResult,
  NodeArgs,
  NodeResult,
  VariablesArgs,
  VariablesResult,
  AnalyzeColorsArgs,
  AnalyzeColorsResult,
  AnalyzeTypographyArgs,
  AnalyzeTypographyResult,
  AnalyzeSpacingResult,
  SpacingValue,
  AnalyzeClustersArgs,
  AnalyzeClustersResult,
  TypographyStyle
} from './rpc'
export { SkiaRenderer, type RenderOverlays } from './canvas'
export { LabelCache, type CachedSection, type CachedComponent } from './canvas/label-cache'
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
export { getCanvasKit, type CanvasKitOptions } from './canvaskit'
export {
  detectTextDirection,
  resolveTextDirection,
  resolveNodeTextDirection,
  resolveNodeLayoutDirection,
  isLogicalTextAlignStart,
  isLogicalTextAlignEnd
} from './text/direction'
export {
  FONT_WEIGHT_NAMES,
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
  ensureArabicFallback,
  getCJKFallbackFamily,
  getCJKFallbackFamilies,
  getArabicFallbackFamilies,
  setCJKFallbackFamily,
  setArabicFallbackFamily,
  styleToWeight,
  weightToStyle,
  normalizeFontFamily,
  isVariableFont,
  styleToVariant,
  fetchBundledFont
} from './text/fonts'
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
  resolveOkHCLForPreview,
  resolveRGBAForPreview,
  resolveNodeFillColor,
  resolveNodeStrokeColor,
  colorToDisplayCss,
  getDefaultRenderColorSpace,
  type RenderColorSpace,
  type ColorIntentSpace,
  type ColorPreviewOptions,
  type ResolvedRenderColor
} from './color/management'
export {
  vectorNetworkToPath,
  geometryBlobToPath,
  decodeVectorNetworkBlob,
  encodeVectorNetworkBlob,
  buildStyleOverrideTable,
  computeVectorBounds
} from './vector'
export {
  evalCubic,
  splitCubicAt,
  segmentToAbsolute,
  isLineSegment,
  cubicExtrema,
  computeAccurateBounds,
  nearestPointOnCubic,
  nearestPointOnNetwork,
  splitSegmentAt,
  removeVertex,
  breakAtVertex,
  deleteVertex,
  mirrorHandle,
  findOppositeHandle,
  findAllHandles,
  findConnectedComponents,
  extractSubNetwork,
  type CubicPoints,
  type NearestResult,
  type NetworkNearestResult
} from './vector/bezier'
export { computeSelectionBounds, computeSnap, type SnapGuide } from './scene-graph/snap'
export { UndoManager, type UndoEntry } from './scene-graph/undo'
export { TextEditor, type TextCaret, type TextEditorState } from './text/editor'
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
} from './text/style-runs'
export {
  renderNodesToImage,
  renderThumbnail,
  computeContentBounds,
  initCanvasKit,
  headlessRenderNodes,
  headlessRenderThumbnail,
  type RasterExportFormat,
  type ExportFormat
} from './io/formats/raster'
export {
  renderNodesToSVG,
  geometryBlobToSVGPath,
  vectorNetworkToSVGPaths,
  type SVGExportOptions
} from './io/formats/svg/export'
export { svg, renderSVGNode, type SVGNode } from './io/formats/svg/node'
export { parseSVGPath } from './io/formats/svg/parse-path'
export {
  fetchIcon,
  fetchIcons,
  searchIcons,
  searchIconsBatch,
  clearIconCache,
  type IconData,
  type IconPath,
  type IconSearchResult
} from './icons'
export { exportFigFile, compressFigData, compressFigDataSync } from './io/formats/fig/export'
export {
  FIG_KIWI_DEFAULT_VERSION,
  buildFigKiwi,
  parseFigKiwiChunks,
  decompressFigKiwiData,
  decompressFigKiwiDataAsync,
  buildFontDigestMap,
  sceneNodeToKiwi,
  fractionalPosition,
  mapToFigmaType
} from './kiwi/serialize'
export { buildDerivedTextDataV4 } from './kiwi/serialize-clipboard-v4'

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
} from './design-jsx'
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
export { probeGlyphOutlineCommands, type GlyphOutlineProbe } from './clipboard-text-outlines'

export { readPenFile, parsePenFile } from './io/formats/pen'

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

export * from './io'
export * from './lint'

export { CODEGEN_PROMPT } from './tools/prompts/codegen-prompt'
export {
  setPexelsApiKey,
  setUnsplashAccessKey,
  registerStockPhotoProvider,
  setActiveStockPhotoProvider,
  getStockPhotoProviders
} from './tools/stock-photo'
export type { StockPhotoProvider, StockPhotoResult } from './tools/stock-photo'
