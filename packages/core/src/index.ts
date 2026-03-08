export type { GUID, Color, Vector, Matrix, Rect } from './types'
export { degToRad, radToDeg, rotatePoint, rotatedCorners, rotatedBBox } from './geometry'

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
  type StyleRun
} from './scene-graph'

export { FigmaAPI, FigmaNodeProxy, type FigmaFontName } from './figma-api'
export { ALL_TOOLS, defineTool, toolsToAI } from './tools'
export type { ToolDef, ParamDef, ParamType } from './tools'
export { executeRpcCommand, ALL_RPC_COMMANDS } from './rpc'
export type {
  InfoResult, PageItem, TreeArgs, TreeResult, TreeNodeResult,
  FindArgs, FindNodeResult, NodeArgs, NodeResult,
  VariablesArgs, VariablesResult,
  AnalyzeColorsArgs, AnalyzeColorsResult,
  AnalyzeTypographyArgs, AnalyzeTypographyResult,
  AnalyzeSpacingResult, SpacingValue,
  AnalyzeClustersArgs, AnalyzeClustersResult, TypographyStyle
} from './rpc'
export { SkiaRenderer, type RenderOverlays } from './renderer/index'
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
  markFontLoaded,
  ensureNodeFont,
  ensureCJKFallback,
  getCJKFallbackFamily,
  styleToWeight,
  weightToStyle
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
export { UndoManager } from './undo'
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
export {
  renderNodesToSVG,
  geometryBlobToSVGPath,
  vectorNetworkToSVGPaths,
  type SVGExportOptions
} from './svg-export'
export { svg, renderSVGNode, type SVGNode } from './svg-node'
export { exportFigFile } from './fig-export'
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
  type TextPictureBuilder
} from './clipboard'

export { readFigFile, parseFigFile } from './kiwi/fig-file'
export { importNodeChanges } from './kiwi/fig-import'
export {
  initCodec,
  encodeMessage,
  decodeMessage,
  compress,
  decompress,
  getCompiledSchema,
  getSchemaBytes,
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
  type FigmaMessage
} from './kiwi/codec'

export {
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
} from './kiwi/protocol'
