import { escapeAttribute, escapeText } from 'entities'

import { printExpression, printModule, type SyntaxNode } from './estree'

/**
 * Text and attribute values are escaped as HTML by `entities`. Vue also reads `{{` as an
 * interpolation before it decodes entities, so text writes `{` as one too and a design's text
 * can never become template syntax.
 */
const templateText = (value: string) => escapeText(value).replaceAll('{', '&#123;')

export type VueAttribute =
  | { type: 'static'; name: string; value: string }
  /** `:name="expression"` */
  | { type: 'bound'; name: string; expression: SyntaxNode }
  /** `v-model="expression"`, or `v-model:argument` */
  | { type: 'model'; argument?: string; expression: SyntaxNode }

export interface VueElement {
  type: 'element'
  tag: string
  attributes: VueAttribute[]
  children: VueNode[]
}

export interface VueText {
  type: 'text'
  value: string
}

export type VueNode = VueElement | VueText

export const attribute = (name: string, value: string): VueAttribute => ({
  type: 'static',
  name,
  value
})

export const bound = (name: string, expression: SyntaxNode): VueAttribute => ({
  type: 'bound',
  name,
  expression
})

export const model = (expression: SyntaxNode, argument?: string): VueAttribute => ({
  type: 'model',
  argument,
  expression
})

export const element = (
  tag: string,
  attributes: VueAttribute[] = [],
  children: VueNode[] = []
): VueElement => ({ type: 'element', tag, attributes, children })

export const text = (value: string): VueText => ({ type: 'text', value })

function printAttribute(item: VueAttribute): string {
  if (item.type === 'static') return `${item.name}="${escapeAttribute(item.value)}"`
  const value = escapeAttribute(printExpression(item.expression))
  if (item.type === 'bound') return `:${item.name}="${value}"`
  return `${item.argument ? `v-model:${item.argument}` : 'v-model'}="${value}"`
}

function printNode(node: VueNode, depth: number): string {
  const indent = '  '.repeat(depth)
  if (node.type === 'text') return `${indent}${templateText(node.value)}`
  const open = [node.tag, ...node.attributes.map(printAttribute)].join(' ')
  if (node.children.length === 0) return `${indent}<${open} />`
  const only = node.children.at(0)
  // A lone text child stays on the element's line, so no whitespace is added around it.
  if (node.children.length === 1 && only?.type === 'text')
    return `${indent}<${open}>${templateText(only.value)}</${node.tag}>`
  const children = node.children.map((child) => printNode(child, depth + 1))
  return [`${indent}<${open}>`, ...children, `${indent}</${node.tag}>`].join('\n')
}

/** A template's markup, one element per line. */
export function printTemplate(root: VueNode): string {
  return printNode(root, 0)
}

export interface VueComponent {
  /** The `<script setup lang="ts">` body, a TypeScript program from `es`. */
  script: SyntaxNode
  template: VueNode
  /** Stylesheet text for a `<style scoped>` block. */
  style?: string
}

/** A single-file component: script setup, template, and scoped style. */
export function printComponent({ script, template, style }: VueComponent): string {
  const blocks = [
    `<script setup lang="ts">\n${printModule(script).trim()}\n</script>`,
    `<template>\n${printNode(template, 1)}\n</template>`,
    ...(style ? [`<style scoped>\n${style.trim()}\n</style>`] : [])
  ]
  return `${blocks.join('\n\n')}\n`
}
