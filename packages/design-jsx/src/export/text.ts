import { isEmptyObject, isEqual, omitBy, pick } from 'es-toolkit'

import { jsx, type SyntaxNode } from '@open-pencil/emit'
import type {
  SceneNode,
  TextParagraphSpacingField,
  TextParagraphStyle
} from '@open-pencil/scene-graph'
import {
  hasParagraphSpacing,
  MAX_LIST_INDENTATION,
  paragraphStyleAt,
  textParagraphRanges,
  withParagraphSpacing
} from '@open-pencil/scene-graph/text'

import { TEXT_CASE, TEXT_DECORATION } from '../enums'
import { AUTO, textLengthJSX } from '../overrides/text'
import { SPAN_STYLE_FIELDS, type SpanStyle } from '../text-content'
import { collectDecorationProps } from './decoration'
import { collectFontSettingProps } from './font'
import { collectFillProps } from './paints'
import { fontWeightValue } from './props'
import { propAttribute, type JSXProp } from './value'

/** A text's content as JSX children, and whether they print on the element's own line. */
export interface TextChildren {
  children: SyntaxNode[]
  inline: boolean
}

/**
 * Each character's style where it differs from the text's own, as a span writes it, with the
 * URL it links to; a span cannot write a link to a node.
 */
function characterStyles(node: SceneNode): SpanStyle[] {
  const styles = Array.from({ length: node.text.length }, (): SpanStyle => ({}))
  for (const run of node.styleRuns) {
    const style: SpanStyle = pick(run.style, SPAN_STYLE_FIELDS)
    if (run.style.hyperlink?.type === 'URL') style.hyperlink = run.style.hyperlink
    const end = Math.min(run.start + run.length, styles.length)
    for (let index = run.start; index < end; index++) styles[index] = { ...styles[index], ...style }
  }
  return styles.map((style) =>
    omitBy(
      style,
      (value, key) => value === undefined || (key !== 'hyperlink' && isEqual(value, node[key]))
    )
  )
}

function spanProps(style: SpanStyle, node: SceneNode): JSXProp[] {
  const props: JSXProp[] = []
  if (style.fontSize !== undefined) props.push(['size', style.fontSize])
  if (style.fontFamily !== undefined) props.push(['font', style.fontFamily])
  if (style.fontWeight !== undefined) props.push(['weight', fontWeightValue(style.fontWeight)])
  if (style.italic !== undefined) props.push(['italic', style.italic])
  if (style.fills) collectFillProps({ ...node, fills: style.fills }, props)
  if (style.lineHeight !== undefined) {
    props.push(['lineHeight', style.lineHeight ? textLengthJSX(style.lineHeight) : AUTO])
  }
  if (style.letterSpacing !== undefined) {
    props.push(['letterSpacing', textLengthJSX(style.letterSpacing)])
  }
  if (style.textDecoration !== undefined)
    props.push(['textDecoration', TEXT_DECORATION.print(style.textDecoration)])
  collectDecorationProps(style, node, props)
  collectFontSettingProps(style, props)
  if (style.textCase !== undefined) props.push(['textCase', TEXT_CASE.print(style.textCase)])
  if (style.hyperlink) props.push(['href', style.hyperlink.value])
  return props
}

/** `text[start, end)` as text and a `<Span>` for every stretch styled apart from the text. */
function inlineContent(
  node: SceneNode,
  styles: readonly SpanStyle[],
  start: number,
  end: number
): SyntaxNode[] {
  const content: SyntaxNode[] = []
  let from = start
  for (let index = start + 1; index <= end; index++) {
    if (index < end && isEqual(styles[index], styles[from])) continue
    const text = jsx.inlineText(node.text.slice(from, index))
    const style = styles[from]
    content.push(
      isEmptyObject(style)
        ? text
        : jsx.element('Span', spanProps(style, node).map(propAttribute), [text], 0, true)
    )
    from = index
  }
  return content
}

/** `<Paragraph>`'s prop for each spacing a paragraph can set, in the order they are written. */
const PARAGRAPH_SPACING_PROPS: readonly (readonly [TextParagraphSpacingField, string])[] = [
  ['paragraphSpacing', 'spacing'],
  ['listSpacing', 'listSpacing'],
  ['paragraphIndent', 'indent']
]

/** A paragraph's style with only the spacing that differs from the text's own. */
function ownParagraphStyle(node: SceneNode, paragraph: number): TextParagraphStyle {
  let style = paragraphStyleAt(node.textParagraphs, paragraph)
  for (const [field] of PARAGRAPH_SPACING_PROPS) {
    if (style[field] === node[field]) style = withParagraphSpacing(style, field, undefined)
  }
  return style
}

function paragraphProps(style: TextParagraphStyle): JSXProp[] {
  const props: JSXProp[] = []
  if (style.listType !== 'NONE') {
    props.push(['list', style.listType === 'ORDERED' ? 'ordered' : 'unordered'])
    const level = Math.min(style.indentation, MAX_LIST_INDENTATION)
    if (level > 1) props.push(['level', level])
  }
  for (const [field, name] of PARAGRAPH_SPACING_PROPS) {
    const value = style[field]
    if (value !== undefined) props.push([name, value])
  }
  return props
}

/**
 * A text's content as JSX children: its text alone when it is styled as a whole, with
 * `<Span>`s for characters styled apart, and as `<Paragraph>`s when a paragraph is a list item
 * or has spacing other than the text's.
 */
export function textChildren(node: SceneNode, depth: number): TextChildren {
  const styles = characterStyles(node)
  const ranges = textParagraphRanges(node.text)
  const paragraphs = ranges.map((_, index) => ownParagraphStyle(node, index))
  const styledParagraphs = paragraphs.some(
    (style) => style.listType !== 'NONE' || hasParagraphSpacing(style)
  )
  if (!styledParagraphs) {
    if (styles.every(isEmptyObject)) {
      return { children: node.text ? [jsx.text(node.text)] : [], inline: true }
    }
    return { children: inlineContent(node, styles, 0, node.text.length), inline: true }
  }
  const children = ranges.map(({ start, end }, index) =>
    jsx.element(
      'Paragraph',
      paragraphProps(paragraphs[index]).map(propAttribute),
      inlineContent(node, styles, start, end),
      depth + 1,
      true
    )
  )
  return { children, inline: false }
}
