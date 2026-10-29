/// <reference types="@figma/plugin-typings" />

import type { FigmaAPI } from './index'
import type {
  FigmaComponentNode,
  FigmaComponentSetNode,
  FigmaInstanceNode,
  FigmaSlotNode
} from './node-types'
import type { OpenPencilPaint } from './paints'
import type { FigmaNodeProxy } from './proxy'
import type {
  FIGMA_API_HOST_MEMBERS,
  FIGMA_API_INCOMPLETE_MEMBERS,
  SERIALIZATION_MEMBERS
} from './surface'
import type { FigmaVariable, FigmaVariableCollection, FigmaVariablesAPI } from './variables'

type Expect<T extends true> = T

type IncompatibleKeys<Actual, Expected> = {
  [K in keyof Expected]: K extends keyof Actual ? (Actual[K] extends Expected[K] ? never : K) : K
}[keyof Expected]

export type SupportedPluginAPI = Pick<
  PluginAPI,
  | 'base64Decode'
  | 'base64Encode'
  | 'closePlugin'
  | 'getFontFamilyVariationAxes'
  | 'getImageByHash'
  | 'loadAllPagesAsync'
  | 'loadFontAsync'
  | 'notify'
  | 'util'
  | 'setCurrentPageAsync'
  | 'createComponent'
  | 'createConnector'
  | 'createEllipse'
  | 'createFrame'
  | 'createImage'
  | 'createImageAsync'
  | 'createLine'
  | 'createNodeFromSvg'
  | 'createPolygon'
  | 'createRectangle'
  | 'createSection'
  | 'createShapeWithText'
  | 'createStar'
  | 'createText'
  | 'createVector'
  | 'exclude'
  | 'flatten'
  | 'group'
  | 'intersect'
  | 'subtract'
  | 'ungroup'
  | 'union'
>

export type FigmaAPIIncompatibleKeys = IncompatibleKeys<FigmaAPI, SupportedPluginAPI>
export type FigmaAPICompatibility = Expect<FigmaAPIIncompatibleKeys extends never ? true : false>

type Extends<Actual, Expected> = Actual extends Expected ? true : false

type Equal<Actual, Expected> = [Actual] extends [Expected]
  ? [Expected] extends [Actual]
    ? true
    : false
  : false

type ComponentPropertyDefinitionsMatch = Expect<
  Equal<FigmaComponentNode['componentPropertyDefinitions'], ComponentPropertyDefinitions>
>
const _componentPropertyDefinitionsMatch: ComponentPropertyDefinitionsMatch = true

type ComponentPropertyMethodsMatch = Expect<
  Extends<FigmaComponentNode['addComponentProperty'], ComponentNode['addComponentProperty']>
>
const _componentPropertyMethodsMatch: ComponentPropertyMethodsMatch = true

type ComponentSetPropertyMethodsMatch = Expect<
  Extends<FigmaComponentSetNode['editComponentProperty'], ComponentSetNode['editComponentProperty']>
>
const _componentSetPropertyMethodsMatch: ComponentSetPropertyMethodsMatch = true

type InstancePropertySurfaceMatch = Expect<
  Extends<
    Pick<
      FigmaInstanceNode,
      | 'componentProperties'
      | 'componentPropertyReferences'
      | 'setProperties'
      | 'isExposedInstance'
      | 'exposedInstances'
      | 'getMainComponentAsync'
      | 'detachInstance'
      | 'swapComponent'
    >,
    Pick<
      InstanceNode,
      | 'componentProperties'
      | 'componentPropertyReferences'
      | 'setProperties'
      | 'isExposedInstance'
      | 'exposedInstances'
      | 'getMainComponentAsync'
      | 'detachInstance'
      | 'swapComponent'
    >
  >
>

const _instancePropertySurfaceMatch: InstancePropertySurfaceMatch = true

type SlotSurfaceMatch = Expect<
  Extends<
    Pick<FigmaComponentNode, 'createSlot'> &
      Pick<FigmaSlotNode, 'type' | 'resetSlot' | 'limitViolations'>,
    Pick<ComponentNode, 'createSlot'> & Pick<SlotNode, 'type' | 'resetSlot' | 'limitViolations'>
  >
>
const _slotSurfaceMatch: SlotSurfaceMatch = true

// `Effect` here is Figma's plugin-typings union; OpenPencil reads and writes a subset of it.
type EffectShapeMatch = Expect<Extends<FigmaNodeProxy['effects'][number], Effect>>
const _effectShapeMatch: EffectShapeMatch = true

// `Paint` here is Figma's plugin-typings union. `fills`, `strokes`, and `backgrounds` share one
// paint type: every paint they read is one of Figma's, apart from the noise and custom paints
// OpenPencil models and Figma has no type for, and they take every paint Figma's types allow but
// for the linear burn and dodge blend modes, which OpenPencil does not model.
type ReadPaint = Exclude<Exclude<FigmaNodeProxy['fills'], symbol>[number], OpenPencilPaint>
type WithoutLinearBlends<T> = T extends unknown
  ? Omit<T, 'blendMode'> & { blendMode?: Exclude<BlendMode, 'LINEAR_BURN' | 'LINEAR_DODGE'> }
  : never
type PaintShapeMatch = Expect<Extends<ReadPaint, Paint>>
const _paintShapeMatch: PaintShapeMatch = true
type PaintArgumentMatch = Expect<
  Extends<
    WithoutLinearBlends<SolidPaint | GradientPaint | ImagePaint | VideoPaint | PatternPaint>,
    ReadPaint
  >
>
const _paintArgumentMatch: PaintArgumentMatch = true

type TextListKeys =
  | 'setRangeListOptions'
  | 'setRangeIndentation'
  | 'setRangeListSpacing'
  | 'setRangeParagraphSpacing'
  | 'setRangeParagraphIndent'
  | 'setRangeFontSize'
  | 'setRangeFontName'
  | 'setRangeLetterSpacing'
  | 'setRangeLineHeight'
  | 'setRangeTextDecoration'
  | 'setRangeTextDecorationStyle'
  | 'setRangeTextDecorationOffset'
  | 'setRangeTextDecorationThickness'
  | 'setRangeTextDecorationSkipInk'
  | 'setRangeTextCase'
  | 'setRangeHyperlink'
  | 'setRangeTextStyleId'
  | 'setRangeTextStyleIdAsync'
  | 'setRangeFillStyleId'
  | 'setRangeFillStyleIdAsync'
  | 'hangingList'
type TextListSurfaceMatch = Expect<
  Extends<Pick<FigmaNodeProxy, TextListKeys>, Pick<TextNode, TextListKeys>>
>
const _textListSurfaceMatch: TextListSurfaceMatch = true

// Figma's mixed values are its own `figma.mixed` unique symbol; ours are a plain symbol. Fills
// and decoration colours can read OpenPencil's noise and custom paints, as `fills` can, and Figma
// types OpenType features as every feature while it returns only those set, so they stay out.
type WithoutMixed<T> = T extends (...args: infer A) => infer R
  ? (...args: A) => Exclude<R, symbol>
  : Exclude<T, symbol>
type TextMixedKeys =
  | 'getRangeListOptions'
  | 'getRangeIndentation'
  | 'getRangeListSpacing'
  | 'getRangeParagraphSpacing'
  | 'getRangeParagraphIndent'
  | 'getRangeFontSize'
  | 'getRangeFontName'
  | 'getRangeFontWeight'
  | 'getRangeLetterSpacing'
  | 'getRangeLineHeight'
  | 'getRangeTextDecoration'
  | 'getRangeTextDecorationStyle'
  | 'getRangeTextDecorationOffset'
  | 'getRangeTextDecorationThickness'
  | 'getRangeTextDecorationSkipInk'
  | 'getRangeAllFontNames'
  | 'getRangeTextCase'
  | 'getRangeHyperlink'
  | 'getRangeTextStyleId'
  | 'getRangeFillStyleId'
  | 'getRangeBoundVariable'
  | 'textCase'
  | 'hyperlink'
  | 'textStyleId'
  | 'fillStyleId'
  | 'fontSize'
  | 'fontName'
  | 'fontWeight'
  | 'letterSpacing'
  | 'lineHeight'
  | 'textDecoration'
  | 'listSpacing'
  | 'paragraphSpacing'
  | 'paragraphIndent'
type TextMixedMatch = Expect<
  Extends<
    { [K in TextMixedKeys]: WithoutMixed<FigmaNodeProxy[K]> },
    { [K in TextMixedKeys]: WithoutMixed<TextNode[K]> }
  >
>
const _textMixedMatch: TextMixedMatch = true

type SupportedVariableKeys =
  | 'id'
  | 'name'
  | 'description'
  | 'hiddenFromPublishing'
  | 'remote'
  | 'variableCollectionId'
  | 'key'
  | 'resolvedType'
  | 'valuesByMode'
  | 'scopes'
  | 'codeSyntax'
  | 'setVariableCodeSyntax'
  | 'removeVariableCodeSyntax'
  | 'setValueForMode'
  | 'remove'
type VariableMatch = Expect<
  Extends<Pick<FigmaVariable, SupportedVariableKeys>, Pick<Variable, SupportedVariableKeys>>
>
const _variableMatch: VariableMatch = true

type SupportedCollectionKeys =
  | 'id'
  | 'name'
  | 'hiddenFromPublishing'
  | 'remote'
  | 'isExtension'
  | 'modes'
  | 'variableIds'
  | 'defaultModeId'
  | 'key'
  | 'remove'
  | 'removeMode'
  | 'addMode'
  | 'renameMode'
type CollectionMatch = Expect<
  Extends<
    Pick<FigmaVariableCollection, SupportedCollectionKeys>,
    Pick<VariableCollection, SupportedCollectionKeys>
  >
>
const _collectionMatch: CollectionMatch = true

/** Every `figma.variables` member is Figma's, and takes what Figma's takes. */
type VariablesAPIArguments = {
  [K in keyof FigmaVariablesAPI]: K extends keyof VariablesAPI
    ? Parameters<VariablesAPI[K]> extends Parameters<FigmaVariablesAPI[K]>
      ? true
      : K
    : K
}[keyof FigmaVariablesAPI]
type VariablesAPIMatch = Expect<VariablesAPIArguments extends true ? true : false>
const _variablesAPIMatch: VariablesAPIMatch = true

type NodeBindingMatch = Expect<
  Extends<
    Parameters<SceneNodeMixin['setBoundVariable']>,
    Parameters<FigmaNodeProxy['setBoundVariable']>
  >
>
const _nodeBindingMatch: NodeBindingMatch = true

// --- Surface: nothing beyond Figma's Plugin API except what `surface.ts` lists ---
// Each check is a `Record` of the offending names, so a failure names them: "Property 'x' is
// missing". Add a Figma member as Figma types it; put an OpenPencil feature on `openpencil`.

type HostMembers = (typeof FIGMA_API_HOST_MEMBERS)[number]
type IncompleteMembers = (typeof FIGMA_API_INCOMPLETE_MEMBERS)[number]
type SerializationMembers = (typeof SERIALIZATION_MEMBERS)[number]
type KeysOfUnion<T> = T extends unknown ? keyof T : never
type None<Names extends PropertyKey> = Record<Names, never>

/** `figma` members Figma's Plugin API does not have. */
const _figmaExtras: None<Exclude<keyof FigmaAPI, keyof PluginAPI | HostMembers>> = {}
/** Listed host members that no longer exist. */
const _figmaGoneListings: None<Exclude<HostMembers, keyof FigmaAPI>> = {}
/** Listed host members that are Figma's after all. */
const _figmaFigmaListings: None<Extract<HostMembers, keyof PluginAPI>> = {}

type SharedKeys = keyof FigmaAPI & keyof PluginAPI
type DriftedKeys = {
  [K in SharedKeys]: FigmaAPI[K] extends PluginAPI[K] ? never : K
}[SharedKeys]
/** Members named as in Figma whose types differ from Figma's. */
const _figmaDrifted: None<Exclude<DriftedKeys, IncompleteMembers>> = {}
/** Members listed as incomplete that now match Figma's types. */
const _figmaNowComplete: None<Exclude<IncompleteMembers, DriftedKeys>> = {}

type FigmaNodeKeys = KeysOfUnion<SceneNode | PageNode | DocumentNode>
/** Node proxy members no Figma node type has. */
const _nodeExtras: None<
  Exclude<Extract<keyof FigmaNodeProxy, string>, FigmaNodeKeys | SerializationMembers>
> = {}
/** Variable members Figma's do not have. */
const _variableExtras: None<Exclude<keyof FigmaVariable, keyof Variable | SerializationMembers>> =
  {}
/** Collection members Figma's do not have. */
const _collectionExtras: None<
  Exclude<keyof FigmaVariableCollection, keyof VariableCollection | SerializationMembers>
> = {}
/** `figma.variables` members Figma's do not have. */
const _variablesAPIExtras: None<Exclude<keyof FigmaVariablesAPI, keyof VariablesAPI>> = {}
