import { request } from '@/app/integrations/shadr/http/http-client'
import type { ShadrComponent } from '@/app/integrations/shadr/types'

export const componentService = {
  list: (): Promise<string[]> =>
    request<{ ids: string[] }>('/configs/components').then((r) => r.ids ?? []),

  get: (id: string): Promise<ShadrComponent> =>
    request<{ document: ShadrComponent }>(`/configs/components/${encodeURIComponent(id)}`).then((r) => r.document),

  save: (id: string, comp: ShadrComponent): Promise<void> =>
    request(`/configs/components/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(comp)
    }),

  delete: (id: string): Promise<void> =>
    request(`/configs/components/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
