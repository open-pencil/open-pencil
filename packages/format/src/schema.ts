// ─── Primitive types ────────────────────────────────────────────

/** A design variable reference, e.g. `$primary` */
export type Variable = `$${string}`;

export type NumberOrVariable = number | Variable;
export type ColorOrVariable = string | Variable;
export type BooleanOrVariable = boolean | Variable;
export type StringOrVariable = string | Variable;

export type SizingBehavior = "fixed" | "hug" | "fill";

export interface ThemeConfig {
  activeTheme?: string;
  overrides?: Record<string, string>;
}

// ─── Fill types ─────────────────────────────────────────────────

export interface SolidFill {
  type: "solid";
  color: ColorOrVariable;
  opacity?: NumberOrVariable;
}

export interface GradientStop {
  color: ColorOrVariable;
  position: number;
}

export interface GradientFill {
  type: "linear-gradient" | "radial-gradient" | "conic-gradient";
  stops: GradientStop[];
  angle?: number;
  opacity?: NumberOrVariable;
}

export interface ImageFill {
  type: "image";
  src: string;
  fit?: "cover" | "contain" | "fill" | "tile";
  opacity?: NumberOrVariable;
}

export type Fill = SolidFill | GradientFill | ImageFill;
export type Fills = Fill[];

// ─── Stroke ─────────────────────────────────────────────────────

export interface Stroke {
  color: ColorOrVariable;
  width: NumberOrVariable;
  style?: "solid" | "dashed" | "dotted";
  position?: "inside" | "outside" | "center";
  opacity?: NumberOrVariable;
}

// ─── Effects ────────────────────────────────────────────────────

export interface ShadowEffect {
  type: "drop-shadow" | "inner-shadow";
  color: ColorOrVariable;
  x: NumberOrVariable;
  y: NumberOrVariable;
  blur: NumberOrVariable;
  spread?: NumberOrVariable;
}

export interface BlurEffect {
  type: "blur" | "background-blur";
  radius: NumberOrVariable;
}

export type Effect = ShadowEffect | BlurEffect;

// ─── Layout ─────────────────────────────────────────────────────

export type LayoutDirection = "horizontal" | "vertical" | "grid";
export type JustifyContent = "start" | "center" | "end" | "space-between" | "space-around" | "space-evenly";
export type AlignItems = "start" | "center" | "end" | "stretch" | "baseline";

export interface Padding {
  top: NumberOrVariable;
  right: NumberOrVariable;
  bottom: NumberOrVariable;
  left: NumberOrVariable;
}

// ─── Node types (literal union) ─────────────────────────────────

export type NodeType =
  | "frame"
  | "rectangle"
  | "ellipse"
  | "text"
  | "line"
  | "path"
  | "polygon"
  | "group"
  | "icon_font"
  | "ref"
  | "note"
  | "context";

// ─── Base node properties ───────────────────────────────────────

export interface BaseNodeProperties {
  id: string;
  type: NodeType;
  name?: string;
  x: NumberOrVariable;
  y: NumberOrVariable;
  width: NumberOrVariable;
  height: NumberOrVariable;
  rotation?: NumberOrVariable;
  opacity?: NumberOrVariable;
  enabled?: BooleanOrVariable;
  fill?: Fills;
  stroke?: Stroke[];
  effect?: Effect[];
  reusable?: boolean;
  theme?: ThemeConfig;
  blendMode?: string;
  metadata?: Record<string, unknown>;
}

// ─── Concrete node interfaces ───────────────────────────────────

export interface FrameNode extends BaseNodeProperties {
  type: "frame";
  layout?: LayoutDirection;
  gap?: NumberOrVariable;
  padding?: Padding;
  children: DesignNode[];
  cornerRadius?: NumberOrVariable | [number, number, number, number];
  slot?: string;
  widthBehavior?: SizingBehavior;
  heightBehavior?: SizingBehavior;
  clipContent?: boolean;
}

export interface RectangleNode extends BaseNodeProperties {
  type: "rectangle";
  cornerRadius?: NumberOrVariable | [number, number, number, number];
}

export interface EllipseNode extends BaseNodeProperties {
  type: "ellipse";
  arcStartAngle?: number;
  arcEndAngle?: number;
}

export interface TextNode extends BaseNodeProperties {
  type: "text";
  content: StringOrVariable;
  fontSize?: NumberOrVariable;
  fontFamily?: StringOrVariable;
  fontWeight?: NumberOrVariable;
  textAlign?: "left" | "center" | "right" | "justify";
  lineHeight?: NumberOrVariable;
  letterSpacing?: NumberOrVariable;
  textDecoration?: "none" | "underline" | "line-through";
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  maxLines?: number;
  overflow?: "visible" | "hidden" | "ellipsis";
}

export interface LineNode extends BaseNodeProperties {
  type: "line";
  x2: NumberOrVariable;
  y2: NumberOrVariable;
}

export interface PathNode extends BaseNodeProperties {
  type: "path";
  d: string;
  fillRule?: "nonzero" | "evenodd";
}

export interface PolygonNode extends BaseNodeProperties {
  type: "polygon";
  sides: number;
  cornerRadius?: NumberOrVariable;
}

export interface GroupNode extends BaseNodeProperties {
  type: "group";
  children: DesignNode[];
}

export interface IconFontNode extends BaseNodeProperties {
  type: "icon_font";
  icon: string;
  iconSet?: string;
  fontSize?: NumberOrVariable;
}

export interface RefNode extends BaseNodeProperties {
  type: "ref";
  refId: string;
  overrides?: Record<string, unknown>;
}

export interface NoteNode extends BaseNodeProperties {
  type: "note";
  content: string;
  author?: string;
}

export interface ContextNode extends BaseNodeProperties {
  type: "context";
  description: string;
  rules?: string[];
}

// ─── Design node union ──────────────────────────────────────────

export type DesignNode =
  | FrameNode
  | RectangleNode
  | EllipseNode
  | TextNode
  | LineNode
  | PathNode
  | PolygonNode
  | GroupNode
  | IconFontNode
  | RefNode
  | NoteNode
  | ContextNode;

// ─── Variables & Design Context ─────────────────────────────────

export interface DesignVariable {
  name: string;
  value: string | number | boolean;
  type: "color" | "number" | "string" | "boolean";
  description?: string;
}

export interface ProjectDesignContext {
  brand?: Record<string, unknown>;
  style?: Record<string, unknown>;
  constraints?: string[];
  audience?: string[];
  references?: string[];
  rules?: string[];
}

// ─── Document ───────────────────────────────────────────────────

export interface DocumentMeta {
  name: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  author?: string;
  description?: string;
}

export interface DesignDocument {
  version: string;
  meta: DocumentMeta;
  designContext?: ProjectDesignContext;
  variables?: DesignVariable[];
  themes?: Record<string, Record<string, string>>;
  imports?: string[];
  children: DesignNode[];
}
