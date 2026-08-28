const OPENPENCIL_CLIPBOARD_PATTERN = new RegExp(
  String.raw`<\x21--\(openpencil\)[\s\S]*?\(\/openpencil\)--\x3e`,
  'u'
)
const FIGMA_CLIPBOARD_PATTERN = new RegExp(
  String.raw`(?:<\x21--|&lt;\x21--)\(figma\)[\s\S]*?\(\/figma\)(?:--\x3e|--&gt;)`,
  'u'
)

export function isDesignClipboardHTML(html: string): boolean {
  return OPENPENCIL_CLIPBOARD_PATTERN.test(html) || FIGMA_CLIPBOARD_PATTERN.test(html)
}
