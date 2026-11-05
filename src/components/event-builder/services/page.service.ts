import { request } from '@/app/integrations/shadr/http/http-client'
import type { ShadrPage } from '@/app/integrations/shadr/types'

export const pageService = {
  list: (): Promise<string[]> =>
    request<{ ids: string[] }>('/configs/pages').then((r) => r.ids ?? []),

  get: (id: string): Promise<ShadrPage> =>
    request<{ document: ShadrPage }>(`/configs/pages/${encodeURIComponent(id)}`).then((r) => r.document),

  save: (id: string, page: ShadrPage): Promise<void> =>
    request(`/configs/pages/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(page)
    }),

  delete: (id: string): Promise<void> =>
    request(`/configs/pages/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
