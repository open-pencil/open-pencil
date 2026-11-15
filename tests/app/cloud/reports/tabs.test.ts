import { describe, expect, test } from 'bun:test'

import { asDouble } from '@open-pencil/test-support/doubles'

import { canReport } from '@/app/cloud/reports/file'
import { cloudShareLinkTabs, rememberShareLinkTab } from '@/app/cloud/reports/tabs'
import type { EditorStore } from '@/app/editor/session'

const link = { shareId: crypto.randomUUID(), server: 'https://cloud.example.com', secret: 's' }

describe('reporting shared files', () => {
  test('offers Report only on a tab opened from a share link', () => {
    const shared = asDouble<EditorStore>({})
    const own = asDouble<EditorStore>({})
    expect(canReport(shared)).toBe(false)

    rememberShareLinkTab(shared, link)
    expect(canReport(shared)).toBe(true)
    expect(cloudShareLinkTabs.value.get(shared)).toEqual(link)
    expect(canReport(own)).toBe(false)
  })
})
