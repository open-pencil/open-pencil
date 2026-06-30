declare module 'postcss-value-parser' {
  export interface ParsedNodeBase {
    type: string
    value: string
    before?: string
    after?: string
    sourceIndex?: number
  }

  export interface FunctionNode extends ParsedNodeBase {
    type: 'function'
    nodes: ParsedNode[]
  }

  export type ParsedNode = ParsedNodeBase | FunctionNode

  export interface ParsedValue {
    nodes: ParsedNode[]
  }

  export interface ParsedUnit {
    number: string
    unit: string
  }

  interface ValueParser {
    (value: string): ParsedValue
    stringify(node: ParsedNode | ParsedNode[]): string
    unit(value: string): ParsedUnit | false
  }

  const valueParser: ValueParser
  export default valueParser
}
