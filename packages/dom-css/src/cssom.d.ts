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

  export interface CSSGroupingRuleLike {
    cssRules: unknown[]
  }

  export interface CSSStyleSheetLike {
    cssRules: unknown[]
  }

  export function parse(cssText: string): CSSStyleSheetLike
}
