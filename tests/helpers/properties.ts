import type { Locator, Page } from '@playwright/test'

export function propertySection(page: Page, name: string): Locator {
  return page.getByRole('region', { name })
}

export function propertyField(page: Page, property: string): Locator {
  return page.locator(`[data-property=${JSON.stringify(property)}]`)
}
