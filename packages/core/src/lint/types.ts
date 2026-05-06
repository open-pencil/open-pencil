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

export interface LintMessage {
  ruleId: string
  severity: Exclude<Severity, 'off'>
  message: string
  nodeId: string
  nodeName: string
  nodePath: string[]
  suggest?: string
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

export interface RuleContext {
  report(issue: { node: LintNode; message: string; suggest?: string }): void
  getConfig(): unknown
  getParent(node: LintNode): LintNode | null
  getChildren(node: LintNode): LintNode[]
}

export interface Rule {
  meta: RuleMeta
  match?: string[]
  check(node: LintNode, context: RuleContext): void
}
