import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { colorToHex } from '@open-pencil/scene-graph/color'

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

export class Linter {
  private rules = new Map<string, Rule>()
  private ruleConfigs = new Map<string, { severity: Severity; options?: Record<string, unknown> }>()
  private messages: LintMessage[] = []
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
    this.variables = describeVariables(graph)
    const roots = rootIds && rootIds.length > 0 ? rootIds : graph.getPages().map((p) => p.id)
    for (const id of roots) this.capture(graph, id, undefined)
    for (const id of roots) this.lintNode(id)
    return {
      messages: this.messages,
      errorCount: this.messages.filter((m) => m.severity === 'error').length,
      warningCount: this.messages.filter((m) => m.severity === 'warning').length,
      infoCount: this.messages.filter((m) => m.severity === 'info').length
    }
  }

  private capture(graph: SceneGraph, id: string, parent?: LintNode) {
    const raw = graph.getNode(id)
    if (!raw) return
    const node = this.toLintNode(graph, raw)
    node.parent = parent
    this.nodes.set(id, node)
    for (const childId of raw.childIds) this.capture(graph, childId, node)
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

  private lintNode(id: string) {
    const node = this.nodes.get(id)
    if (!node) return
    for (const [ruleId, rule] of this.rules) {
      if (rule.match && !rule.match.includes(node.type)) continue
      const config = this.ruleConfigs.get(ruleId)
      if (!config || config.severity === 'off') continue
      const context: RuleContext = {
        variables: this.variables,
        report: ({ node, message, suggest, data, fix, suggestions }) => {
          this.messages.push({
            ruleId,
            severity: config.severity as Exclude<Severity, 'off'>,
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
            .map((childId) => this.nodes.get(childId))
            .filter((child): child is LintNode => !!child)
      }
      rule.check(node, context)
    }
    // Instance sublayers mirror their main component: issues there are fixed once in the
    // component, so reporting every placed copy only multiplies the same finding.
    if (node.type === 'INSTANCE') return
    for (const childId of node.childIds) this.lintNode(childId)
  }
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
