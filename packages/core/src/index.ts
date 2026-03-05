export type { GUID, Color, Vector, Matrix, Rect } from './types'

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
export { SkiaRenderer, type RenderOverlays } from './renderer'
export { RenderProfiler } from './profiler'
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
export { parseColor, colorToHex, colorToHexRaw, colorToRgba255, colorToCSS } from './color'
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
  renderTree,
  renderJsx,
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
  node,
  type TreeNode,
  type BaseProps,
  type TextProps,
  type StyleProps,
  type RenderResult,
  sceneNodeToJsx,
  selectionToJsx
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
