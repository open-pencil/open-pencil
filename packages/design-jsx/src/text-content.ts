import { isEmptyObject, isEqual, omitBy, pick } from 'es-toolkit'
import * as v from 'valibot'

import type {
  CharacterStyleOverride,
  SceneNode,
  StyleRun,
  TextParagraphStyle
} from '@open-pencil/scene-graph'
import { createDefaultNode } from '@open-pencil/scene-graph/node-defaults'
import {
  MAX_LIST_INDENTATION,
  paragraphCount,
  PLAIN_PARAGRAPH,
  trimParagraphStyles
} from '@open-pencil/scene-graph/text'

import { parseScriptInput } from './schema'
import type { MarkdownService } from './services'
import { isTreeNode, type TreeNode } from './tree'

/** `<Span>`: characters of a text styled apart from the rest of it. */
export const SPAN = 'text-span'
/** `<Paragraph>`: one paragraph of a text, with its list and spacing. */
export const PARAGRAPH = 'text-paragraph'

/** The names `<Span>` and `<Paragraph>` are written under, for messages about them. */
export const TEXT_CONTENT_NAMES: Readonly<Partial<Record<string, string>>> = {
  [SPAN]: 'Span',
  [PARAGRAPH]: 'Paragraph'
}

/** The character styles a `<Span>` sets, as the fields `<Text>`'s props set on a text. */
export const SPAN_STYLE_FIELDS = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'italic',
  'fills',
  'letterSpacing',
  'lineHeight',
  'textDecoration',
  'textDecorationStyle',
  'textDecorationFills',
  'textDecorationThickness',
  'textUnderlineOffset',
  'textDecorationSkipInk',
  'fontFeatures',
  'fontVariations',
  'textLanguage',
  'textCase'
] as const satisfies readonly (keyof CharacterStyleOverride & keyof SceneNode)[]

/** A span's character styles and the URL it links to, which only characters have. */
export type SpanStyle = Pick<
  CharacterStyleOverride,
  (typeof SPAN_STYLE_FIELDS)[number] | 'hyperlink'
>

/** The fields an element's props set on a text node, as `propsToOverrides` reads them. */
export type SpanOverrides = (props: Record<string, unknown>) => Partial<SceneNode>

export type TextContentFields = Partial<Pick<SceneNode, 'text' | 'styleRuns' | 'textParagraphs'>>

const lengthSchema = v.pipe(v.number(), v.finite())

const paragraphPropsSchema = v.pipe(
  v.object({
    list: v.optional(v.picklist(['ordered', 'unordered'])),
    level: v.optional(
      v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(MAX_LIST_INDENTATION))
    ),
    spacing: v.optional(lengthSchema),
    listSpacing: v.optional(lengthSchema),
    indent: v.optional(lengthSchema)
  }),
  v.check(
    (props) => props.level === undefined || props.list !== undefined,
    '`level` nests list items; set `list` too'
  )
)

/** Characters appended so far, each stretch with the style its spans give it. */
interface Segment {
  length: number
  style: SpanStyle
}

/** Whether a child is `<Span>` or `<Paragraph>`, which are part of their text, not layers. */
export function isTextContent(child: TreeNode | string): boolean {
  return isTreeNode(child) && (child.type === SPAN || child.type === PARAGRAPH)
}

const spanLinkSchema = v.object({ href: v.optional(v.pipe(v.string(), v.trim(), v.nonEmpty())) })

function spanStyle(props: Record<string, unknown>, spanOverrides: SpanOverrides): SpanStyle {
  const style: SpanStyle = omitBy(
    pick(spanOverrides(props), SPAN_STYLE_FIELDS),
    (value) => value === undefined
  )
  const { href } = parseScriptInput('Invalid <Span> props', spanLinkSchema, props)
  if (href) style.hyperlink = { type: 'URL', value: href }
  return style
}

function appendContent(
  segments: Segment[],
  children: TreeNode['children'],
  inherited: SpanStyle,
  owner: string,
  spanOverrides: SpanOverrides
): void {
  for (const child of children) {
    if (typeof child === 'string') {
      segments.push({ length: child.length, style: inherited })
    } else if (child.type === SPAN) {
      // Nested spans style their characters over the span around them.
      const style = { ...inherited, ...spanStyle(child.props, spanOverrides) }
      appendContent(segments, child.children, style, '<Span>', spanOverrides)
    } else if (child.type === PARAGRAPH) {
      throw new Error(`<Paragraph> must be a direct child of <Text>, not of ${owner}`)
    } else {
      throw new Error(`${owner} can hold only text and <Span>, not <${child.type}>`)
    }
  }
}

function textOf(children: TreeNode['children']): string {
  return children
    .map((child) => (typeof child === 'string' ? child : textOf(child.children)))
    .join('')
}

function paragraphStyle(props: Record<string, unknown>): TextParagraphStyle {
  const { list, level, spacing, listSpacing, indent } = parseScriptInput(
    'Invalid <Paragraph> props',
    paragraphPropsSchema,
    props
  )
  const style: TextParagraphStyle = list
    ? { listType: list === 'ordered' ? 'ORDERED' : 'UNORDERED', indentation: level ?? 1 }
    : { ...PLAIN_PARAGRAPH }
  if (spacing !== undefined) style.paragraphSpacing = spacing
  if (listSpacing !== undefined) style.listSpacing = listSpacing
  if (indent !== undefined) style.paragraphIndent = indent
  return style
}

/** The `<Paragraph>` children of a text, or null without any; other content beside them is an error. */
function paragraphElements(tree: TreeNode): TreeNode[] | null {
  const paragraphs = tree.children.filter(
    (child): child is TreeNode => isTreeNode(child) && child.type === PARAGRAPH
  )
  if (paragraphs.length === 0) return null
  const mixed = tree.children.some((child) =>
    typeof child === 'string' ? child.trim() !== '' : child.type !== PARAGRAPH
  )
  if (mixed) {
    throw new Error(
      '<Text> mixes <Paragraph> with other content: put all of its text in <Paragraph> elements, or use none'
    )
  }
  return paragraphs
}

/**
 * The text an element's children write, `<Span>`s and `<Paragraph>`s included, such as a sticky
 * note's body or a connector's label; other elements among them are not text and are skipped.
 */
export function textContentText(tree: TreeNode): string {
  // Mixed content fails here, before the element makes its layer.
  const paragraphs = paragraphElements(tree) ?? []
  if (paragraphs.length > 0) {
    return paragraphs.map((paragraph) => textOf(paragraph.children)).join('\n')
  }
  const inline = tree.children.filter((child) => typeof child === 'string' || child.type === SPAN)
  return textOf(inline)
}

/** Runs for the segments, holding only what differs from the text's own style. */
function styleRuns(segments: readonly Segment[], textStyle: SpanStyle): StyleRun[] {
  const runs: StyleRun[] = []
  let start = 0
  for (const segment of segments) {
    const style = omitBy(segment.style, (value, key) => isEqual(value, textStyle[key]))
    if (segment.length > 0 && !isEmptyObject(style)) {
      const previous = runs.at(-1)
      const adjoins = previous && previous.start + previous.length === start
      if (adjoins && isEqual(previous.style, style)) previous.length += segment.length
      else runs.push({ start, length: segment.length, style })
    }
    start += segment.length
  }
  return runs
}

/** The style of the last character appended, which a newline after it takes, as in Figma. */
function lastStyle(segments: readonly Segment[]): SpanStyle {
  return segments.findLast((segment) => segment.length > 0)?.style ?? {}
}

/**
 * The text a `<Text>` element's children and text props give. Strings alone are its text, as
 * before; `<Span>` children also give style runs and `<Paragraph>` children paragraph styles.
 * `overrides` are the text's own fields, which runs leave out.
 */
export function textContentFields(
  tree: TreeNode,
  props: Record<string, unknown>,
  overrides: Partial<SceneNode>,
  spanOverrides: SpanOverrides,
  markdown?: MarkdownService
): TextContentFields {
  if (props.markdown === true) return markdownContentFields(tree, props, overrides, markdown)
  if (!tree.children.some(isTextContent)) {
    const childText = tree.children.filter((c): c is string => typeof c === 'string').join('')
    const propText =
      props.text ?? props.characters ?? props.content ?? props.label ?? props.value ?? props.title
    if (childText) return { text: childText }
    return typeof propText === 'string' ? { text: propText } : {}
  }

  const textStyle = pick(
    createDefaultNode(() => '', 'TEXT', overrides),
    SPAN_STYLE_FIELDS
  )
  const segments: Segment[] = []
  const paragraphs = paragraphElements(tree)
  if (!paragraphs) {
    appendContent(segments, tree.children, {}, '<Text>', spanOverrides)
    return { text: textOf(tree.children), styleRuns: styleRuns(segments, textStyle) }
  }

  const styles: TextParagraphStyle[] = []
  const lines: string[] = []
  for (const paragraph of paragraphs) {
    if (lines.length > 0) segments.push({ length: 1, style: lastStyle(segments) })
    appendContent(segments, paragraph.children, {}, '<Paragraph>', spanOverrides)
    const content = textOf(paragraph.children)
    // A line break inside a paragraph's text starts paragraphs of the same style.
    const style = paragraphStyle(paragraph.props)
    for (let index = 0; index < paragraphCount(content); index++) styles.push(style)
    lines.push(content)
  }
  return {
    text: lines.join('\n'),
    styleRuns: styleRuns(segments, textStyle),
    textParagraphs: trimParagraphStyles(styles, styles.length)
  }
}

/**
 * `source` without the indent all its lines share, as a template literal written inside JSX
 * indents them; a line indented further, such as a nested list item, keeps the rest.
 */
function withoutSharedIndent(source: string): string {
  const lines = source.split('\n')
  const indents = lines
    .filter((line) => line.trim() !== '')
    .map((line) => line.length - line.trimStart().length)
  if (indents.length === 0) return ''
  const shared = Math.min(...indents)
  return lines.map((line) => line.slice(Math.min(shared, line.length))).join('\n')
}

/**
 * `<Text markdown>`: its text, from children or the `text` prop, read as Markdown over the
 * text's own style. Indentation the source shares, as in a template literal, is left out.
 */
function markdownContentFields(
  tree: TreeNode,
  props: Record<string, unknown>,
  overrides: Partial<SceneNode>,
  markdown: MarkdownService | undefined
): TextContentFields {
  if (tree.children.some(isTreeNode))
    throw new Error('<Text markdown> holds only its Markdown text, not <Span> or <Paragraph>')
  if (!markdown) throw new Error('<Text markdown> needs the renderer to read Markdown')
  const childText = tree.children.filter((c): c is string => typeof c === 'string').join('')
  const source = childText || (typeof props.text === 'string' ? props.text : '')
  const base = createDefaultNode(() => '', 'TEXT', overrides)
  return markdown(withoutSharedIndent(source), base)
}
