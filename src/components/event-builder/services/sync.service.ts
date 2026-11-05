import type { EditorStore } from '@/app/editor/active-store'
import { shadrConverter } from '@/app/integrations/shadr/converter'
import {
  isSyncing,
  lastError,
  selectedPageId,
  serverPages,
  status
} from '@/app/integrations/shadr/store/state'
import type { ShadrPage } from '@/app/integrations/shadr/types'
import { toast } from '@/app/shell/ui'

import { pageService } from './page.service'

export async function pullPage(pageId: string, editor: EditorStore): Promise<boolean> {
  if (!pageId) return false
  isSyncing.value = true
  lastError.value = null
  try {
    const pageData: ShadrPage = await pageService.get(pageId)
    const graph = shadrConverter.importPage(pageData)
    editor.replaceGraph(graph)
    editor.undo.clear()
    editor.clearSelection()
    selectedPageId.value = pageId
    toast.info(`Страница "${pageId}" успешно загружена с сервера!`)
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    lastError.value = msg
    toast.error(`Ошибка загрузки "${pageId}": ${msg}`)
    return false
  } finally {
    isSyncing.value = false
  }
}

export async function pushCurrentPage(editor: EditorStore, overrideName?: string): Promise<boolean> {
  isSyncing.value = true
  lastError.value = null
  try {
    const page = shadrConverter.exportPage(editor, overrideName || selectedPageId.value)
    await pageService.save(page.name, page)
    selectedPageId.value = page.name
    if (!serverPages.value.includes(page.name)) {
      serverPages.value.push(page.name)
    }
    status.value = 'online'
    toast.info(`Страница "${page.name}" успешно сохранена на Minecraft сервер!`)
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    lastError.value = msg
    toast.error(`Ошибка сохранения: ${msg}`)
    return false
  } finally {
    isSyncing.value = false
  }
}
