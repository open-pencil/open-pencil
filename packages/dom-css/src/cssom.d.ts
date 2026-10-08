declare module '@acemir/cssom' {
  export interface CSSStyleDeclarationLike {
    readonly length: number
    readonly [index: number]: string
    getPropertyValue(property: string): string
  }

  export interface CSSStyleRuleLike {
    selectorText: string
    style: CSSStyleDeclarationLike
  }

  export class CSSFontFaceRule {
    readonly cssText: string
    readonly style: {
      setProperty(property: string, value: string, priority?: string): void
    }
  }

  export class CSSStyleSheet {
    readonly cssRules: ArrayLike<{
      readonly style: { setProperty(property: string, value: string): void }
    }>
    /** Parses `rule`, throwing on an invalid selector, and returns its index. */
    insertRule(rule: string, index?: number): number
    toString(): string
  }

  export interface CSSGroupingRuleLike {
    cssRules: unknown[]
  }

  export interface CSSStyleSheetLike {
    cssRules: unknown[]
  }

  export function parse(cssText: string): CSSStyleSheetLike
}
