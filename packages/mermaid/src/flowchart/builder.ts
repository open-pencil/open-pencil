import * as v from 'valibot'
import { parse as parseYAML } from 'yaml'

import { readLabel, type GrammarText } from '../label'
import type {
  FlowArrowhead,
  FlowDirection,
  FlowEdge,
  FlowNode,
  FlowStroke,
  FlowSubgraph,
  Flowchart
} from './model'
import { bracketShape, shapeNamed } from './shapes'

/** An edge as the grammar describes it before its ends are known. */
interface GrammarLink {
  type: string
  stroke: string
  length?: number
  text?: GrammarText
  id?: string
}

/** A `direction` statement inside a subgraph, as the grammar lists it among the members. */
interface DirectionStatement {
  stmt: 'dir'
  value: string
}

const STROKES: Record<string, FlowStroke> = {
  normal: 'normal',
  thick: 'thick',
  dotted: 'dotted',
  invisible: 'invisible'
}

const ARROWHEADS: Record<string, FlowArrowhead> = {
  arrow_point: 'arrow',
  arrow_circle: 'circle',
  arrow_cross: 'cross',
  arrow_open: 'none'
}

/** The arrowhead a link's first character opens it with, as in `<-->` or `o--o`. */
const START_HEADS: Record<string, string> = {
  '<': 'arrow_point',
  x: 'arrow_cross',
  o: 'arrow_circle'
}

/** The arrowhead a link's last character closes it with, and the one that opens it as well. */
const END_HEADS = new Map([
  ['x', { type: 'arrow_cross', opening: 'x' }],
  ['>', { type: 'arrow_point', opening: '<' }],
  ['o', { type: 'arrow_circle', opening: 'o' }]
])

/** Mermaid's longest edge: more dashes than this count as this many. */
const MAX_EDGE_LENGTH = 10

function direction(text: string): FlowDirection {
  const dir = text.trim()
  if (dir.includes('<')) return 'RL'
  if (dir.includes('^')) return 'BT'
  if (dir.includes('>')) return 'LR'
  if (dir.includes('v')) return 'TB'
  if (dir === 'BT' || dir === 'LR' || dir === 'RL') return dir
  return 'TB'
}

function isDirectionStatement(item: unknown): item is DirectionStatement {
  return typeof item === 'object' && item !== null && 'stmt' in item && item.stmt === 'dir'
}

/** What `@{ … }` data sets that a node keeps; other keys, such as `icon`, are left out. */
const shapeDataSchema = v.looseObject({
  shape: v.optional(v.string()),
  label: v.optional(v.pipe(v.union([v.string(), v.number()]), v.toString())),
  labelType: v.optional(v.string())
})

type ShapeData = v.InferOutput<typeof shapeDataSchema>

/** `@{ … }` data, which is YAML, written as a flow mapping when it fits on one line. */
function shapeData(text: string): ShapeData {
  const data: unknown = parseYAML(text.includes('\n') ? `${text}\n` : `{\n${text}\n}`)
  const parsed = v.safeParse(shapeDataSchema, data)
  return parsed.success ? parsed.output : {}
}

function arrowheads(type: string): { startArrow: FlowArrowhead; endArrow: FlowArrowhead } {
  if (type.startsWith('double_')) {
    const head = ARROWHEADS[type.slice('double_'.length)] ?? 'arrow'
    return { startArrow: head, endArrow: head }
  }
  return { startArrow: 'none', endArrow: ARROWHEADS[type] ?? 'arrow' }
}

/**
 * The `yy` object Mermaid's flowchart grammar calls as it parses, building a `Flowchart`. It
 * keeps the meaning Mermaid's `FlowDB` gives each call in the pinned release (MIT, Copyright (c)
 * 2014 - 2022 Knut Sveidqvist), without what only Mermaid's renderer needs: DOM ids, click
 * callbacks, sanitizing for the page, and edge animation.
 */
export class FlowchartBuilder {
  private dir: FlowDirection = 'TB'
  private readonly nodes = new Map<string, FlowNode>()
  private readonly edges: FlowEdge[] = []
  private readonly subgraphs: FlowSubgraph[] = []
  private readonly classDefs = new Map<string, string[]>()
  private defaultEdgeStyle: string[] = []
  private subgraphCount = 0
  private firstGraphSeen = false
  private accessibleTitle?: string
  private accessibleDescription?: string

  readonly lex = {
    /** True for the first `graph`/`flowchart` keyword only; a later one is text. */
    firstGraph: () => {
      if (this.firstGraphSeen) return false
      this.firstGraphSeen = true
      return true
    }
  }

  /**
   * The calls the grammar makes, as the plain object it copies them from: JISON copies `yy`'s
   * enumerable properties into its own state, which leaves out a class's methods.
   */
  grammarCalls() {
    return {
      lex: this.lex,
      setDirection: this.setDirection.bind(this),
      setAccTitle: this.setAccTitle.bind(this),
      setAccDescription: this.setAccDescription.bind(this),
      addVertex: this.addVertex.bind(this),
      destructLink: this.destructLink.bind(this),
      addLink: this.addLink.bind(this),
      updateLinkInterpolate: this.updateLinkInterpolate.bind(this),
      updateLink: this.updateLink.bind(this),
      addClass: this.addClass.bind(this),
      setClass: this.setClass.bind(this),
      setLink: this.setLink.bind(this),
      setTooltip: this.setTooltip.bind(this),
      setClickEvent: this.setClickEvent.bind(this),
      addSubGraph: this.addSubGraph.bind(this)
    }
  }

  result(title?: string): Flowchart {
    // `style` and `class` statements naming a subgraph style the subgraph, though the grammar
    // reports them as nodes.
    const subgraphIds = new Set(this.subgraphs.map((subgraph) => subgraph.id))
    for (const subgraph of this.subgraphs) {
      const node = this.nodes.get(subgraph.id)
      if (!node) continue
      subgraph.styles.push(...node.styles)
      subgraph.classes.push(...node.classes)
    }
    return {
      direction: this.dir,
      nodes: [...this.nodes.values()].filter((node) => !subgraphIds.has(node.id)),
      edges: this.edges.map((edge) => ({
        ...edge,
        styles: [...this.defaultEdgeStyle, ...edge.styles]
      })),
      subgraphs: this.subgraphs,
      classDefs: this.classDefs,
      title,
      accessibleTitle: this.accessibleTitle,
      accessibleDescription: this.accessibleDescription
    }
  }

  setDirection(dir: string): void {
    this.dir = direction(dir)
  }

  setAccTitle(text: string): void {
    this.accessibleTitle = text
  }

  setAccDescription(text: string): void {
    this.accessibleDescription = text
  }

  addVertex(
    id: string,
    text?: GrammarText,
    type?: string,
    styles?: string[],
    classes?: string[],
    _dir?: string,
    _props?: Record<string, unknown>,
    metadata?: string
  ): void {
    if (!id || id.trim().length === 0) return
    const data = metadata === undefined ? undefined : shapeData(metadata)
    // An edge's id, or `@{ … }` after a subgraph's, names that edge or subgraph, not a node;
    // the data it carries is animation and the like, which nothing here draws.
    if (this.edges.some((edge) => edge.id === id) || (data && this.isSubgraph(id))) return
    let node = this.nodes.get(id)
    if (!node) {
      node = {
        id,
        label: { text: id, format: 'text' },
        shape: 'rect',
        classes: [],
        styles: []
      }
      this.nodes.set(id, node)
    }
    if (text) node.label = readLabel(text)
    if (type !== undefined) node.shape = bracketShape(type)
    if (styles) node.styles.push(...styles)
    if (classes) node.classes.push(...classes)
    if (!data) return
    if (typeof data.shape === 'string') {
      const shape = data.shape === data.shape.toLowerCase() ? shapeNamed(data.shape) : null
      if (!shape) throw new Error(`No such shape: ${data.shape}.`)
      node.shape = shape
    }
    if (typeof data.label === 'string') {
      node.label = readLabel({
        text: data.label,
        type: data.labelType === 'text' || data.labelType === 'string' ? 'text' : 'markdown'
      })
    }
  }

  destructLink(end: string, start?: string): GrammarLink {
    const info = this.endOfLink(end)
    if (!start) return info
    const begin = this.startOfLink(start)
    if (begin.stroke !== info.stroke) return { type: 'INVALID', stroke: 'INVALID' }
    if (begin.type === 'arrow_open') return { ...info, type: info.type }
    if (begin.type !== info.type) return { type: 'INVALID', stroke: 'INVALID' }
    return { ...info, type: `double_${begin.type}` }
  }

  addLink(starts: string[], ends: string[], link: GrammarLink): void {
    const id = link.id?.replace('@', '')
    for (const from of starts) {
      for (const to of ends) {
        // In `A e1@--> B & C`, the id names the edge from the last start to the first end.
        const named = from === starts.at(-1) && to === ends[0]
        this.addEdge(from, to, link, named ? id : undefined)
      }
    }
  }

  updateLinkInterpolate(): void {
    // Curve styles are Mermaid's renderer's; connectors take their own line type.
  }

  updateLink(positions: ('default' | number)[], styles: string[]): void {
    for (const position of positions) {
      if (position === 'default') {
        this.defaultEdgeStyle = styles
        continue
      }
      const edge = this.edges.at(position)
      if (!edge || position < 0) {
        throw new Error(
          `The index ${position} for linkStyle is out of bounds. Valid indices for linkStyle are between 0 and ${this.edges.length - 1}.`
        )
      }
      edge.styles = styles
    }
  }

  addClass(ids: string, styles: string[]): void {
    // Commas and semicolons separate declarations; an escaped comma, as in `font-family:a\,b`,
    // is part of one.
    const declarations = styles
      .join(',')
      .split(/(?<!\\)[,;]/)
      .map((declaration) => declaration.replaceAll('\\,', ','))
    for (const id of ids.split(',')) {
      const existing = this.classDefs.get(id) ?? []
      this.classDefs.set(id, [...existing, ...declarations])
    }
  }

  setClass(ids: string, className: string): void {
    for (const id of ids.split(',')) {
      const subgraph = this.subgraphs.find((candidate) => candidate.id === id)
      if (subgraph) subgraph.classes.push(className)
      else this.nodes.get(id)?.classes.push(className)
    }
  }

  setLink(ids: string, href: string, target?: string): void {
    for (const id of ids.split(',')) {
      const node = this.nodes.get(id)
      if (node) node.link = target ? { href, target } : { href }
    }
  }

  setTooltip(ids: string, tooltip?: string): void {
    if (tooltip === undefined) return
    for (const id of ids.split(',')) {
      const node = this.nodes.get(id)
      if (node) node.tooltip = tooltip
    }
  }

  setClickEvent(): void {
    // Callbacks run scripts on Mermaid's page; a design layer has none to run.
  }

  addSubGraph(
    idText: GrammarText | undefined,
    list: unknown[],
    titleText: GrammarText | undefined
  ): string {
    // `subgraph Some title` gives the title as the id too; an id with spaces is no id.
    let id = idText?.text.trim()
    if (idText && idText === titleText && /\s/.test(idText.text)) id = undefined
    let dir: FlowDirection | undefined
    const members: string[] = []
    for (const item of list.flat()) {
      if (isDirectionStatement(item)) {
        dir = direction(item.value)
        continue
      }
      if (typeof item !== 'string' || item.trim() === '' || members.includes(item)) continue
      members.push(item)
    }
    const subgraphId = id ?? `subGraph${this.subgraphCount}`
    this.subgraphCount++
    // A node belongs to the subgraph that closes first, which is the innermost one, and a
    // subgraph never holds itself.
    const own = members.filter(
      (member) =>
        member !== subgraphId &&
        !this.subgraphs.some((subgraph) => subgraph.members.includes(member))
    )
    const existing = this.subgraphs.find((subgraph) => subgraph.id === subgraphId)
    if (existing) {
      // A repeated id adds to the first declaration, which keeps its title and direction.
      existing.members.push(...own)
      return subgraphId
    }
    this.subgraphs.push({
      id: subgraphId,
      title: titleText ? readLabel(titleText) : { text: '', format: 'text' },
      members: own,
      direction: dir,
      classes: [],
      styles: []
    })
    return subgraphId
  }

  private isSubgraph(id: string): boolean {
    return this.subgraphs.some((subgraph) => subgraph.id === id)
  }

  private addEdge(from: string, to: string, link: GrammarLink, id?: string): void {
    const label = link.text && readLabel(link.text)
    const edgeId =
      id && !this.edges.some((edge) => edge.id === id)
        ? id
        : `L_${from}_${to}_${this.edges.filter((edge) => edge.from === from && edge.to === to).length}`
    this.edges.push({
      id: edgeId,
      from,
      to,
      ...(label && label.text !== '' ? { label } : {}),
      ...arrowheads(link.type),
      stroke: STROKES[link.stroke] ?? 'normal',
      length: Math.min(link.length ?? 1, MAX_EDGE_LENGTH),
      styles: []
    })
  }

  private startOfLink(text: string): { type: string; stroke: string } {
    let rest = text.trim()
    let type = 'arrow_open'
    const head = rest[0]
    const opening = head && START_HEADS[head]
    if (opening) {
      type = opening
      rest = rest.slice(1)
    }
    let stroke = 'normal'
    if (rest.includes('=')) stroke = 'thick'
    if (rest.includes('.')) stroke = 'dotted'
    return { type, stroke }
  }

  private endOfLink(text: string): GrammarLink {
    const link = text.trim()
    let line = link.slice(0, -1)
    let type = 'arrow_open'
    const tail = link.slice(-1)
    const head = END_HEADS.get(tail)
    if (head) {
      type = head.type
      if (link.startsWith(head.opening)) {
        type = `double_${type}`
        line = line.slice(1)
      }
    }
    let stroke = 'normal'
    let length = line.length - 1
    if (line.startsWith('=')) stroke = 'thick'
    if (line.startsWith('~')) stroke = 'invisible'
    const dots = line.split('.').length - 1
    if (dots) {
      stroke = 'dotted'
      length = dots
    }
    return { type, stroke, length }
  }
}
