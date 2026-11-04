import { uniq } from 'es-toolkit'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { colorToHex } from '@open-pencil/scene-graph/color'
import { GENERATED_FRAME_TYPES, generatedFrameOwner } from '@open-pencil/scene-graph/generated'

import { presets } from './presets'
import { allRules } from './rules'
import type {
  LintConfig,
  LintVariables,
  LintMessage,
  LintNode,
  LintResult,
  Rule,
  RuleContext,
  Severity
} from './types'
import { getNodePath } from './utils'

/** The size and weight of each stretch of a text layer's characters, as the canvas draws them. */
function effectiveTextStyles(node: SceneNode): { fontSize: number; fontWeight: number }[] {
  const base = { fontSize: node.fontSize, fontWeight: node.fontWeight }
  const runs = node.styleRuns.map((run) => ({
    fontSize: run.style.fontSize ?? base.fontSize,
    fontWeight: run.style.fontWeight ?? base.fontWeight
  }))
  const covered = node.styleRuns.reduce((total, run) => total + run.length, 0)
  return covered < node.text.length || runs.length === 0 ? [base, ...runs] : runs
}

/** Sticky notes, shapes, and connectors: FigJam's own layers, which lint leaves alone. */
const GENERATED_TYPES: ReadonlySet<string> = GENERATED_FRAME_TYPES

export class Linter {
  private rules = new Map<string, Rule>()
  private ruleConfigs = new Map<string, { severity: Severity; options?: Record<string, unknown> }>()
  private messages: LintMessage[] = []
  private graph: SceneGraph | null = null
  /** The enabled rules with their contexts, made once per run rather than once per layer. */
  private checks: { rule: Rule; context: RuleContext }[] = []
  private nodes = new Map<string, LintNode>()
  private variables: LintVariables = {
    counts: { COLOR: 0, FLOAT: 0, STRING: 0, BOOLEAN: 0 },
    colorsByHex: new Map()
  }

  constructor(options: { config?: LintConfig; preset?: string; rules?: string[] } = {}) {
    let baseConfig: Record<
      string,
      Severity | { severity: Severity; options?: Record<string, unknown> }
    > = {}
    if (options.preset) baseConfig = { ...presets[options.preset].rules }
    if (options.config?.extends) {
      const ids = Array.isArray(options.config.extends)
        ? options.config.extends
        : [options.config.extends]
      for (const id of ids) baseConfig = { ...baseConfig, ...presets[id].rules }
    }
    if (options.config?.rules) baseConfig = { ...baseConfig, ...options.config.rules }
    const rulesToLoad = options.rules ?? Object.keys(baseConfig)
    for (const ruleId of rulesToLoad) {
      const rule = allRules[ruleId]
      const config = baseConfig[ruleId]
      if (config === 'off') continue
      this.rules.set(ruleId, rule)
      if (typeof config === 'string') this.ruleConfigs.set(ruleId, { severity: config })
      else this.ruleConfigs.set(ruleId, config)
    }
  }

  lintGraph(graph: SceneGraph, rootIds?: string[]): LintResult {
    this.messages = []
    this.nodes.clear()
    this.graph = graph
    this.variables = describeVariables(graph)
    this.checks = this.ruleChecks()
    const roots = rootIds && rootIds.length > 0 ? rootIds : graph.getPages().map((p) => p.id)
    for (const id of outermostRoots(graph, roots)) {
      // A sublayer of a sticky note, shape, or connector is skipped as a root, as in a page's walk.
      const node = graph.getNode(id)
      if (node && generatedFrameOwner(graph, node)) continue
      this.lintNode(id, undefined)
    }
    this.graph = null
    this.checks = []
    return {
      messages: this.messages,
      errorCount: this.messages.filter((m) => m.severity === 'error').length,
      warningCount: this.messages.filter((m) => m.severity === 'warning').length,
      infoCount: this.messages.filter((m) => m.severity === 'info').length
    }
  }

  /**
   * The rules' view of `id`, made the first time the walk or a rule reaches it. Instance sublayers
   * are never linted, so on a page made of instances most layers are never converted at all.
   */
  private nodeFor(id: string, parent: LintNode | undefined): LintNode | undefined {
    const cached = this.nodes.get(id)
    if (cached) return cached
    const raw = this.graph?.getNode(id)
    if (!this.graph || !raw) return undefined
    const node = this.toLintNode(this.graph, raw)
    node.parent = parent
    this.nodes.set(id, node)
    return node
  }

  private toLintNode(graph: SceneGraph, raw: SceneNode): LintNode {
    // Rules see the color a paint renders with, including a bound variable in this node's mode.
    const paintColor = (
      field: 'fills' | 'strokes',
      index: number,
      color: SceneNode['fills'][number]['color']
    ) => {
      const variableId = raw.boundVariables[`${field}/${index}/color`]
      return (variableId && graph.resolveColorVariableForNode(raw.id, variableId)) || color
    }
    return {
      id: raw.id,
      name: raw.name,
      type: raw.type,
      width: raw.width,
      height: raw.height,
      x: raw.x,
      y: raw.y,
      rotation: raw.rotation,
      visible: raw.visible,
      locked: raw.locked,
      opacity: raw.opacity,
      layoutMode: raw.layoutMode,
      layoutPositioning: raw.layoutPositioning,
      layoutGrow: raw.layoutGrow,
      layoutAlignSelf: raw.layoutAlignSelf,
      primaryAxisSizing: raw.primaryAxisSizing,
      counterAxisSizing: raw.counterAxisSizing,
      textAutoResize: raw.textAutoResize,
      itemSpacing: raw.itemSpacing,
      paddingTop: raw.paddingTop,
      paddingRight: raw.paddingRight,
      paddingBottom: raw.paddingBottom,
      paddingLeft: raw.paddingLeft,
      cornerRadius: raw.cornerRadius,
      childIds: raw.childIds.slice(),
      componentId: raw.componentId || undefined,
      text: raw.text,
      fontSize: raw.fontSize,
      textStyles: raw.type === 'TEXT' ? effectiveTextStyles(raw) : undefined,
      styleRunCount: raw.styleRuns.length,
      boundVariables: raw.boundVariables,
      fills: raw.fills.map((f, index) => ({
        type: f.type,
        visible: f.visible,
        opacity: f.opacity,
        color: f.type === 'SOLID' ? paintColor('fills', index, f.color) : undefined
      })),
      strokes: raw.strokes.map((stroke, index) => ({
        visible: stroke.visible,
        opacity: stroke.opacity,
        color: paintColor('strokes', index, stroke.color)
      })),
      effects: raw.effects.map((effect) => ({
        type: effect.type,
        visible: effect.visible,
        radius: effect.radius
      }))
    }
  }

  private ruleChecks(): { rule: Rule; context: RuleContext }[] {
    const checks: { rule: Rule; context: RuleContext }[] = []
    for (const [ruleId, rule] of this.rules) {
      const config = this.ruleConfigs.get(ruleId)
      if (!config || config.severity === 'off') continue
      const severity = config.severity
      checks.push({
        rule,
        context: {
          variables: this.variables,
          report: ({ node, message, suggest, data, fix, suggestions }) => {
            this.messages.push({
              ruleId,
              severity,
              message,
              nodeId: node.id,
              nodeName: node.name,
              nodePath: getNodePath(this.nodes.get(node.id) ?? node),
              suggest,
              data,
              fix,
              suggestions
            })
          },
          getConfig: () => config.options,
          getParent: (node) => this.nodes.get(node.id)?.parent ?? null,
          getChildren: (node) =>
            node.childIds
              .map((childId) => this.nodeFor(childId, this.nodes.get(node.id)))
              .filter((child): child is LintNode => !!child)
        }
      })
    }
    return checks
  }

  private lintNode(id: string, parent: LintNode | undefined) {
    const node = this.nodeFor(id, parent)
    if (!node) return
    // A sticky note, shape, or connector is FigJam's own, with its fixed choices: no design
    // system rule applies to it or to the sublayers it generates.
    if (GENERATED_TYPES.has(node.type)) return
    for (const { rule, context } of this.checks) {
      if (rule.match && !rule.match.includes(node.type)) continue
      rule.check(node, context)
    }
    // Instance sublayers mirror their main component: issues there are fixed once in the
    // component, so reporting every placed copy only multiplies the same finding.
    if (node.type === 'INSTANCE') return
    for (const childId of node.childIds) this.lintNode(childId, node)
  }
}

/**
 * The roots no other root contains, each once. A layer inside another root is linted with it,
 * so it has its real parents and reports once.
 */
function outermostRoots(graph: SceneGraph, ids: readonly string[]): string[] {
  const requested = new Set(ids)
  return uniq(ids).filter((id) => {
    for (let parentId = graph.getNode(id)?.parentId; parentId;) {
      if (requested.has(parentId)) return false
      parentId = graph.getNode(parentId)?.parentId
    }
    return true
  })
}

function describeVariables(graph: SceneGraph): LintVariables {
  const counts = { COLOR: 0, FLOAT: 0, STRING: 0, BOOLEAN: 0 }
  const colorsByHex = new Map<string, { id: string; name: string }>()
  for (const variable of graph.variables.values()) {
    counts[variable.type]++
    if (variable.type !== 'COLOR') continue
    const color = graph.resolveColorVariable(variable.id)
    if (!color || color.a < 1) continue
    const hex = colorToHex(color)
    if (!colorsByHex.has(hex)) colorsByHex.set(hex, { id: variable.id, name: variable.name })
  }
  return { counts, colorsByHex }
}

export function createLinter(options?: { config?: LintConfig; preset?: string; rules?: string[] }) {
  return new Linter(options)
}
