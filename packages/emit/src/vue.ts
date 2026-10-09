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

/** `{{ expression }}`, printed from a syntax tree so it holds only what the tree says. */
export interface VueInterpolation {
  type: 'interpolation'
  expression: SyntaxNode
}

export type VueNode = VueElement | VueText | VueInterpolation

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

export const interpolation = (expression: SyntaxNode): VueInterpolation => ({
  type: 'interpolation',
  expression
})

function printAttribute(item: VueAttribute): string {
  if (item.type === 'static') return `${item.name}="${escapeAttribute(item.value)}"`
  const value = escapeAttribute(printExpression(item.expression))
  if (item.type === 'bound') return `:${item.name}="${value}"`
  return `${item.argument ? `v-model:${item.argument}` : 'v-model'}="${value}"`
}

/** Markup with nothing added around it, as text content needs. */
function printInline(node: VueNode): string {
  if (node.type === 'text') return templateText(node.value)
  if (node.type === 'interpolation') {
    const expression = printExpression(node.expression)
    // The template ends an interpolation at the first `}}`, wherever it falls.
    if (expression.includes('}}'))
      throw new Error(`An interpolated expression cannot contain "}}": ${expression}`)
    return `{{ ${expression} }}`
  }
  const open = [node.tag, ...node.attributes.map(printAttribute)].join(' ')
  if (node.children.length === 0) return `<${open} />`
  return `<${open}>${node.children.map(printInline).join('')}</${node.tag}>`
}

function printNode(node: VueNode, depth: number): string {
  const indent = '  '.repeat(depth)
  // Vue renders whitespace between text and elements as a space, so an element with text or
  // an interpolation in it keeps its children on its own line, exactly as given.
  if (node.type !== 'element' || node.children.some((child) => child.type !== 'element'))
    return `${indent}${printInline(node)}`
  const open = [node.tag, ...node.attributes.map(printAttribute)].join(' ')
  if (node.children.length === 0) return `${indent}<${open} />`
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

/**
 * A raw block's content, which ends at the first closing tag for its element. Strings in the
 * script and values in the stylesheet can come from an imported design, so a closing tag in
 * them is written `<\\/`, which JavaScript strings and CSS both read back as `</`.
 */
const rawBlock = (tag: string, content: string) =>
  `<${tag}>\n${content.trim().replace(/<\/(?=script|style)/gi, '<\\/')}\n</${tag.split(' ')[0]}>`

/** A single-file component: script setup, template, and scoped style. */
export function printComponent({ script, template, style }: VueComponent): string {
  const blocks = [
    rawBlock('script setup lang="ts"', printModule(script)),
    `<template>\n${printNode(template, 1)}\n</template>`,
    ...(style ? [rawBlock('style scoped', style)] : [])
  ]
  return `${blocks.join('\n\n')}\n`
}
