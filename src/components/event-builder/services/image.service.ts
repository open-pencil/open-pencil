import { request } from '@/app/integrations/shadr/http/http-client'

export interface ImageListItem {
  name: string
  unicode?: string
}

export const imageService = {
  list: (): Promise<ImageListItem[]> =>
    request<{ images: ImageListItem[] }>('/images').then((r) => r.images ?? [])
}
