/** Page names made only of dashes, asterisks, and spaces mark section dividers, as in Figma. */
export const PAGE_DIVIDER_PATTERN = /^[-–—*\s]+$/

/** An empty page whose name matches `pattern` separates groups of pages instead of holding content. */
export function isPageDivider(
  page: { name: string; childIds: string[] },
  pattern: RegExp = PAGE_DIVIDER_PATTERN
): boolean {
  return page.childIds.length === 0 && pattern.test(page.name)
}
