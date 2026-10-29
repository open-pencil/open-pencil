import type { FlowShape } from './shapes'

/** The way a flowchart, or a subgraph inside one, lays its nodes out: top to bottom, and so on. */
export type FlowDirection = 'TB' | 'BT' | 'LR' | 'RL'

/** A label's text; `markdown` text came in backticks and may hold `**bold**` and `*italic*`. */
export interface FlowLabel {
  text: string
  format: 'text' | 'markdown'
}

export interface FlowNode {
  id: string
  label: FlowLabel
  shape: FlowShape
  /** Class names in the order they were given, `classDef` names among them. */
  classes: string[]
  /** CSS declarations from `style` statements, as written (`fill:#f9f`). */
  styles: string[]
  /** Where `click` sends a reader, with its target window when given. */
  link?: { href: string; target?: string }
  tooltip?: string
}

/** What an edge's end is drawn with. */
export type FlowArrowhead = 'none' | 'arrow' | 'circle' | 'cross'

/** How an edge's line is drawn: `-->`, `==>`, `-.->`, or `~~~`, which lays out but is not drawn. */
export type FlowStroke = 'normal' | 'thick' | 'dotted' | 'invisible'

export interface FlowEdge {
  id: string
  from: string
  to: string
  label?: FlowLabel
  startArrow: FlowArrowhead
  endArrow: FlowArrowhead
  stroke: FlowStroke
  /** How many ranks the edge spans at least: one more for each extra dash, dot, or equals sign. */
  length: number
  /** CSS declarations from `linkStyle`, the default ones first. */
  styles: string[]
}

export interface FlowSubgraph {
  id: string
  title: FlowLabel
  /** Ids of the nodes and subgraphs it holds, each in exactly one subgraph. */
  members: string[]
  /** Its own `direction`, when it sets one. */
  direction?: FlowDirection
  classes: string[]
  /** CSS declarations from `style` statements naming the subgraph. */
  styles: string[]
}

/** A Mermaid flowchart (`flowchart` or `graph`) as written, before anything lays it out. */
export interface Flowchart {
  direction: FlowDirection
  /** Nodes in the order they first appear. */
  nodes: FlowNode[]
  /** Edges in the order they appear, which is the order `linkStyle` numbers them in. */
  edges: FlowEdge[]
  /** Subgraphs in the order they close, so a subgraph comes after those inside it. */
  subgraphs: FlowSubgraph[]
  /** `classDef` declarations by class name; `default` applies to every node. */
  classDefs: Map<string, string[]>
  /** The front matter's `title`. */
  title?: string
  accessibleTitle?: string
  accessibleDescription?: string
}
