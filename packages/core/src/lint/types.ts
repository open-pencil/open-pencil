export type Severity = 'error' | 'warning' | 'info' | 'off'

export type Category =
  | 'layout'
  | 'accessibility'
  | 'naming'
  | 'structure'
  | 'components'
  | 'design-tokens'
  | 'typography'

export interface RuleMeta {
  id: string
  severity: Severity
  category: Category
  description: string
}

/** Structured values behind a message, so interfaces can present it without parsing text. */
export type LintMessageData = Readonly<Record<string, string | number>>

/** Numeric layer properties a lint fix may set. */
export type LintFixProperty =
  | 'x'
  | 'y'
  | 'width'
  | 'height'
  | 'cornerRadius'
  | 'itemSpacing'
  | 'paddingTop'
  | 'paddingRight'
  | 'paddingBottom'
  | 'paddingLeft'
  | 'fontSize'

/**
 * A change that resolves a finding on the reported layer, kept as data so any interface can
 * preview, apply or serialize it.
 */
export type LintFix =
  | { kind: 'bind-variable'; path: string; variableId: string; variableName: string }
  | { kind: 'set'; changes: Readonly<Partial<Record<LintFixProperty, number>>> }
  /** Turns a group into a frame in place, keeping its children, bounds and look. */
  | { kind: 'convert-to-frame' }
  /** Deletes the layer with its children. */
  | { kind: 'delete' }

export interface LintMessage {
  ruleId: string
  severity: Exclude<Severity, 'off'>
  message: string
  nodeId: string
  nodeName: string
  nodePath: string[]
  suggest?: string
  data?: LintMessageData
  /** Keeps the design's intent, so it can be applied in bulk without review. */
  fix?: LintFix
  /** Changes the design's values; offered one finding at a time. */
  suggestions?: LintFix[]
}

export interface LintResult {
  messages: LintMessage[]
  errorCount: number
  warningCount: number
  infoCount: number
}

export interface LintConfig {
  extends?: string | string[]
  rules: Record<string, Severity | { severity: Severity; options?: Record<string, unknown> }>
}

export interface LintNode {
  id: string
  name: string
  type: string
  width: number
  height: number
  x: number
  y: number
  rotation: number
  visible: boolean
  locked: boolean
  layoutMode: string
  layoutPositioning: 'AUTO' | 'ABSOLUTE'
  layoutGrow: number
  layoutAlignSelf: string
  primaryAxisSizing: string
  counterAxisSizing: string
  textAutoResize: string
  itemSpacing: number
  paddingTop: number
  paddingRight: number
  paddingBottom: number
  paddingLeft: number
  cornerRadius: number
  childIds: string[]
  componentId?: string
  text: string
  fontSize: number
  styleRunCount: number
  boundVariables: Record<string, string>
  fills: Array<{
    type: string
    visible: boolean
    opacity: number
    color?: { r: number; g: number; b: number }
  }>
  strokes: Array<{
    visible: boolean
    opacity: number
    color?: { r: number; g: number; b: number }
  }>
  effects: Array<{
    type: string
    visible: boolean
    radius: number
  }>
  parent?: LintNode
}

/** The document's variables, which decide whether a rule suggesting a binding is actionable. */
export interface LintVariables {
  /** Number of local variables by type; a rule suggesting a binding needs a candidate to bind. */
  counts: Readonly<Record<'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN', number>>
  /** Color variables by their resolved `#RRGGBB` value, for suggesting an exact match. */
  colorsByHex: ReadonlyMap<string, { id: string; name: string }>
}

export interface RuleContext {
  variables: LintVariables
  report(issue: {
    node: LintNode
    message: string
    suggest?: string
    data?: LintMessageData
    fix?: LintFix
    suggestions?: LintFix[]
  }): void
  getConfig(): unknown
  getParent(node: LintNode): LintNode | null
  getChildren(node: LintNode): LintNode[]
}

export interface Rule {
  meta: RuleMeta
  match?: string[]
  check(node: LintNode, context: RuleContext): void
}
