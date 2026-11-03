import type {
  BaseNodeMixin,
  BooleanOperationNode,
  ComponentSetNode,
  DocumentNode,
  ExportMixin,
  GeometryMixin,
  Guide,
  LeadingTrim,
  MinimalFillsMixin,
  TextDecorationOffset,
  TextDecorationStyle,
  TextDecorationThickness
} from '@figma/plugin-typings/plugin-api-standalone'

import type {
  ArcData,
  HyperlinkTarget,
  LayoutGrid,
  LayoutMode,
  NodeType,
  SceneNode
} from '@open-pencil/scene-graph'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'
import type { ShapeWithTextType } from '@open-pencil/scene-graph/shape-with-text'

import type { TextRangeMethods } from './accessors/text/ranges'
import type { VariableNodeMembers } from './accessors/variables'
import type { FigmaVectorNetwork, FigmaVectorPath } from './accessors/vector'
import type { FigmaDevStatusValue } from './dev-status'
import type { FigmaEffect } from './effects'
import type { FigmaFontName } from './fonts/names'
import type { FigmaInstanceOverride } from './overrides'
import type { FigmaPaint } from './paints'
import type { PluginDataMethods } from './plugin-data'
import type { FigmaNodeProxy } from './proxy'
import type { FigmaLetterSpacing, FigmaLineHeight } from './text'
import type { FigmaDecorationColor } from './text/style'
import type { FigmaTransform } from './types'

/** A style reference's async setter, as Figma types it. */
type StyleIdSetter = MinimalFillsMixin['setFillStyleIdAsync']

/**
 * The members of Figma's node types that `FigmaNodeProxy` gives scripts. Accessors install them
 * at runtime, on the prototype or, for members Figma has on some node types alone, on each
 * proxy; this class only declares their types.
 */
/**
 * A node's type as Figma's plugin API names it: the document root reads as `'DOCUMENT'`, a page
 * as `'PAGE'` (the scene graph's `CANVAS`), and a slot frame as `'SLOT'`, as Figma's
 * `DocumentNode`, `PageNode` and `SlotNode` do.
 */
export type FigmaNodeType = Exclude<NodeType, 'CANVAS'> | 'DOCUMENT' | 'PAGE' | 'SLOT'

export abstract class FigmaNodeMembers {
  declare readonly id: string
  declare readonly type: FigmaNodeType
  declare name: string
  declare readonly removed: boolean
  declare x: number
  declare y: number
  declare readonly width: number
  declare readonly height: number
  declare rotation: number
  declare relativeTransform: FigmaTransform
  declare resize: (width: number, height: number) => void
  declare resizeWithoutConstraints: (width: number, height: number) => void
  declare rescale: (scale: number) => void
  declare readonly absoluteTransform: FigmaTransform
  declare readonly absoluteBoundingBox: Rect
  declare readonly absoluteRenderBounds: Rect | null

  declare fills: readonly FigmaPaint[] | symbol
  declare strokes: readonly FigmaPaint[]
  declare effects: readonly FigmaEffect[]
  declare opacity: number
  declare visible: boolean
  declare locked: boolean
  declare devStatus: FigmaDevStatusValue | undefined
  declare blendMode: string
  declare clipsContent: boolean
  declare cornerRadius: number | symbol
  declare topLeftRadius: number
  declare topRightRadius: number
  declare bottomLeftRadius: number
  declare bottomRightRadius: number
  declare cornerSmoothing: number

  declare layoutMode: LayoutMode
  declare layoutGrids: readonly LayoutGrid[]
  declare primaryAxisAlignItems: string
  declare counterAxisAlignItems: string
  declare itemSpacing: number
  declare counterAxisSpacing: number
  declare paddingTop: number
  declare paddingRight: number
  declare paddingBottom: number
  declare paddingLeft: number
  declare horizontalPadding: number
  declare verticalPadding: number
  declare guides: readonly Guide[]
  declare exportSettings: ExportMixin['exportSettings']
  declare exportAsync: ExportMixin['exportAsync']
  declare getCSSAsync: BaseNodeMixin['getCSSAsync']
  declare fillGeometry: GeometryMixin['fillGeometry']
  declare strokeGeometry: GeometryMixin['strokeGeometry']
  declare layoutWrap: string
  declare primaryAxisSizingMode: string
  declare counterAxisSizingMode: string
  declare counterAxisAlignContent: string
  declare itemReverseZIndex: boolean
  declare strokesIncludedInLayout: boolean
  declare layoutPositioning: string
  declare layoutGrow: number
  declare layoutAlign: string
  declare layoutSizingHorizontal: string
  declare layoutSizingVertical: string
  declare constraints: { horizontal: string; vertical: string }
  declare minWidth: number | null
  declare maxWidth: number | null
  declare minHeight: number | null
  declare maxHeight: number | null
  declare readonly targetAspectRatio: Vector | null
  /** @deprecated Figma's alias for whether `targetAspectRatio` is set. */
  declare constrainProportions: boolean
  declare lockAspectRatio: () => void
  declare unlockAspectRatio: () => void
  declare pointCount: number
  declare innerRadius: number
  declare arcData: Readonly<ArcData>
  declare booleanOperation: BooleanOperationNode['booleanOperation']
  declare description: string
  declare readonly instances: FigmaNodeProxy[]
  declare getInstancesAsync: () => Promise<FigmaNodeProxy[]>
  declare readonly defaultVariant: FigmaNodeProxy | null
  declare readonly variantGroupProperties: ComponentSetNode['variantGroupProperties']
  declare readonly documentColorProfile: DocumentNode['documentColorProfile']
  declare getTopLevelFrame: () => FigmaNodeProxy | undefined
  declare setFillsAsync: (paints: readonly FigmaPaint[]) => Promise<void>
  declare setStrokesAsync: (paints: readonly FigmaPaint[]) => Promise<void>
  declare vectorPaths: readonly FigmaVectorPath[]
  declare vectorNetwork: FigmaVectorNetwork
  declare setVectorNetworkAsync: (vectorNetwork: FigmaVectorNetwork) => Promise<void>
  declare handleMirroring: SceneNode['handleMirroring'] | symbol
  declare getPluginData: PluginDataMethods['getPluginData']
  declare setPluginData: PluginDataMethods['setPluginData']
  declare getPluginDataKeys: PluginDataMethods['getPluginDataKeys']
  declare getSharedPluginData: PluginDataMethods['getSharedPluginData']
  declare setSharedPluginData: PluginDataMethods['setSharedPluginData']
  declare getSharedPluginDataKeys: PluginDataMethods['getSharedPluginDataKeys']
  declare readonly explicitVariableModes: VariableNodeMembers['explicitVariableModes']
  declare readonly resolvedVariableModes: VariableNodeMembers['resolvedVariableModes']
  declare setExplicitVariableModeForCollection: VariableNodeMembers['setExplicitVariableModeForCollection']
  declare clearExplicitVariableModeForCollection: VariableNodeMembers['clearExplicitVariableModeForCollection']
  declare readonly boundVariables: VariableNodeMembers['boundVariables']
  declare setBoundVariable: VariableNodeMembers['setBoundVariable']
  declare readonly overrides: FigmaInstanceOverride[] | undefined
  /** A sticky note's body or a shape's label, a sticky's author line, and whether it is wide. */
  declare readonly text: FigmaNodeProxy | undefined
  declare readonly authorName: string | undefined
  declare authorVisible: boolean | undefined
  declare isWideWidth: boolean | undefined
  declare shapeType: ShapeWithTextType | undefined
  /** On pages alone, as in Figma. */
  declare loadAsync: () => Promise<void>
  declare resetOverrides: () => void
  declare removeOverrides: () => void

  declare strokeWeight: number
  declare strokeAlign: string
  declare dashPattern: readonly number[]
  declare strokeCap: string
  declare strokeJoin: string
  declare strokeMiterLimit: number
  declare strokeTopWeight: number
  declare strokeBottomWeight: number
  declare strokeLeftWeight: number
  declare strokeRightWeight: number

  declare characters: string
  declare fontSize: number | symbol
  declare fontName: FigmaFontName | symbol
  declare fontWeight: number | symbol
  declare textAlignHorizontal: string
  declare textAlignVertical: string
  declare textAutoResize: string
  declare letterSpacing: FigmaLetterSpacing | symbol
  declare lineHeight: FigmaLineHeight | symbol
  declare textCase: SceneNode['textCase'] | symbol
  declare hyperlink: HyperlinkTarget | null | symbol
  declare textStyleId: string | symbol
  declare fillStyleId: string | symbol
  declare textDecoration: SceneNode['textDecoration'] | symbol
  declare textDecorationStyle: TextDecorationStyle | null | symbol
  declare textDecorationOffset: TextDecorationOffset | null | symbol
  declare textDecorationThickness: TextDecorationThickness | null | symbol
  declare textDecorationColor: FigmaDecorationColor | null | symbol
  declare textDecorationSkipInk: boolean | null | symbol
  declare leadingTrim: LeadingTrim
  declare readonly openTypeFeatures: Readonly<Record<string, boolean>> | symbol
  declare maxLines: number | null
  declare listSpacing: number | symbol
  declare paragraphSpacing: number | symbol
  declare paragraphIndent: number | symbol
  declare hangingList: boolean
  declare textTruncation: string
  declare autoRename: boolean

  // Per-character and per-paragraph methods: accessors/text/ranges.ts.
  declare getStyledTextSegments: TextRangeMethods['getStyledTextSegments']
  declare getRangeAllFontNames: TextRangeMethods['getRangeAllFontNames']
  declare getRangeFontSize: TextRangeMethods['getRangeFontSize']
  declare setRangeFontSize: TextRangeMethods['setRangeFontSize']
  declare getRangeFontName: TextRangeMethods['getRangeFontName']
  declare setRangeFontName: TextRangeMethods['setRangeFontName']
  declare getRangeFontWeight: TextRangeMethods['getRangeFontWeight']
  declare getRangeFills: TextRangeMethods['getRangeFills']
  declare setRangeFills: TextRangeMethods['setRangeFills']
  declare getRangeLetterSpacing: TextRangeMethods['getRangeLetterSpacing']
  declare setRangeLetterSpacing: TextRangeMethods['setRangeLetterSpacing']
  declare getRangeLineHeight: TextRangeMethods['getRangeLineHeight']
  declare setRangeLineHeight: TextRangeMethods['setRangeLineHeight']
  declare getRangeTextDecoration: TextRangeMethods['getRangeTextDecoration']
  declare setRangeTextDecoration: TextRangeMethods['setRangeTextDecoration']
  declare getRangeTextDecorationStyle: TextRangeMethods['getRangeTextDecorationStyle']
  declare setRangeTextDecorationStyle: TextRangeMethods['setRangeTextDecorationStyle']
  declare getRangeTextDecorationOffset: TextRangeMethods['getRangeTextDecorationOffset']
  declare setRangeTextDecorationOffset: TextRangeMethods['setRangeTextDecorationOffset']
  declare getRangeTextDecorationThickness: TextRangeMethods['getRangeTextDecorationThickness']
  declare setRangeTextDecorationThickness: TextRangeMethods['setRangeTextDecorationThickness']
  declare getRangeTextDecorationColor: TextRangeMethods['getRangeTextDecorationColor']
  declare setRangeTextDecorationColor: TextRangeMethods['setRangeTextDecorationColor']
  declare getRangeTextDecorationSkipInk: TextRangeMethods['getRangeTextDecorationSkipInk']
  declare setRangeTextDecorationSkipInk: TextRangeMethods['setRangeTextDecorationSkipInk']
  declare getRangeOpenTypeFeatures: TextRangeMethods['getRangeOpenTypeFeatures']
  declare getRangeListOptions: TextRangeMethods['getRangeListOptions']
  declare setRangeListOptions: TextRangeMethods['setRangeListOptions']
  declare getRangeIndentation: TextRangeMethods['getRangeIndentation']
  declare setRangeIndentation: TextRangeMethods['setRangeIndentation']
  declare getRangeListSpacing: TextRangeMethods['getRangeListSpacing']
  declare setRangeListSpacing: TextRangeMethods['setRangeListSpacing']
  declare getRangeParagraphSpacing: TextRangeMethods['getRangeParagraphSpacing']
  declare setRangeParagraphSpacing: TextRangeMethods['setRangeParagraphSpacing']
  declare getRangeParagraphIndent: TextRangeMethods['getRangeParagraphIndent']
  declare setRangeParagraphIndent: TextRangeMethods['setRangeParagraphIndent']
  declare getRangeTextCase: TextRangeMethods['getRangeTextCase']
  declare setRangeTextCase: TextRangeMethods['setRangeTextCase']
  declare getRangeHyperlink: TextRangeMethods['getRangeHyperlink']
  declare setRangeHyperlink: TextRangeMethods['setRangeHyperlink']
  declare getRangeTextStyleId: TextRangeMethods['getRangeTextStyleId']
  declare setRangeTextStyleId: TextRangeMethods['setRangeTextStyleId']
  declare setRangeTextStyleIdAsync: TextRangeMethods['setRangeTextStyleIdAsync']
  declare getRangeFillStyleId: TextRangeMethods['getRangeFillStyleId']
  declare setRangeFillStyleId: TextRangeMethods['setRangeFillStyleId']
  declare setRangeFillStyleIdAsync: TextRangeMethods['setRangeFillStyleIdAsync']
  declare getRangeBoundVariable: TextRangeMethods['getRangeBoundVariable']
  declare setRangeBoundVariable: TextRangeMethods['setRangeBoundVariable']
  declare strokeStyleId: string
  declare effectStyleId: string
  declare gridStyleId: string
  /** @deprecated Figma's name for a frame's `fillStyleId`. */
  declare backgroundStyleId: string
  declare setFillStyleIdAsync: StyleIdSetter
  declare setStrokeStyleIdAsync: StyleIdSetter
  declare setEffectStyleIdAsync: StyleIdSetter
  declare setGridStyleIdAsync: StyleIdSetter
  declare setTextStyleIdAsync: StyleIdSetter
}
