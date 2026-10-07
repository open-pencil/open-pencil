import type { Page } from '@playwright/test'

/** A model only the fixed catalog lists, so a test can tell when the catalog has loaded. */
export const CATALOG_ONLY_MODEL = 'Catalog Test Model'

const CATALOG = {
  openrouter: {
    models: {
      'test/catalog-model': {
        name: CATALOG_ONLY_MODEL,
        tool_call: true,
        attachment: true,
        release_date: '2026-01-01',
        modalities: { output: ['text'] },
        limit: { output: 16384 }
      }
    }
  }
}

/** Serves a small fixed models.dev catalog, so model pickers never depend on the live one. */
export async function routeModelCatalog(page: Page): Promise<void> {
  await page.route('https://models.dev/api.json', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(CATALOG) })
  )
}
