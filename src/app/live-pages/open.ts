import { computed } from 'vue'

import { useEditorStore } from '@/app/editor/active-store'
import { readRepositoryRoot, runGit } from '@/app/integrations/git/client'
import { normalizePath } from '@/app/projects/schema'
import { useProjects } from '@/app/projects/store'

import { gridPosition } from './grid'
import { fillRoute, pagePaths, routeURL, routesFromFiles, type RouteInfo } from './routes'
import { normalizeLiveURL, pageLabel, pluginDataWithLivePage } from './schema'

/** The frame one page opens in; a page is a desktop screen until it is resized. */
export const PAGE_WIDTH = 1440
export const PAGE_HEIGHT = 900

/**
 * Where the pages of the running application come from: the project whose repository holds the
 * open document, the address its application answers on, and the routes its page files declare.
 * A document outside every project has no pages, which the panel explains instead of guessing.
 */
export function useLivePagesSource() {
  const store = useEditorStore()
  const { projects } = useProjects()

  const documentPath = computed(() => store.getDocumentFilePath())
  const project = computed(() => {
    const path = documentPath.value
    if (path === null) return null
    const normalized = normalizePath(path)
    return (
      projects.value.find(
        (entry) => normalized === entry.repository || normalized.startsWith(`${entry.repository}/`)
      ) ?? null
    )
  })

  /** The address the project's application was configured to answer on, if any. */
  const baseAddress = computed(() => project.value?.startUrl.trim() ?? '')

  /** The routes the project's page files declare, read from git so no walk of the disk is needed. */
  async function listRoutes(): Promise<RouteInfo[]> {
    const current = project.value
    if (!current) return []
    const resolved = await readRepositoryRoot(current.repository)
    const repository = resolved.ok && resolved.value !== null ? resolved.value : current.repository
    const listed = await runGit(repository, 'ls-files', ['--', ...pagePaths(current.appDirectory)])
    if (!listed.ok) return []
    const files = listed.value.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '')
    return routesFromFiles(files)
  }

  /**
   * One frame per route, laid out in a grid and linked to the page it shows, as one undo step. A
   * route with a parameter is opened with the value it was given; a route still missing one is
   * left out, since the page it names does not exist yet.
   */
  function openAll(
    routes: readonly RouteInfo[],
    base = baseAddress.value,
    params: Readonly<Record<string, string>> = {}
  ): number {
    // The address a project was configured with is text a person typed; a frame keeps the address
    // the page really has, or none at all.
    const address = normalizeLiveURL(base)
    if (address === '' || routes.length === 0) return 0
    const pageId = store.state.currentPageId
    let index = 0
    let opened = 0
    store.undo.runBatch('Open pages', () => {
      for (const route of routes) {
        const path = route.params.length > 0 ? fillRoute(route.route, params) : route.route
        if (path === null) continue
        const url = routeURL(address, path)
        if (url === '') continue
        const at = gridPosition(index, PAGE_WIDTH, PAGE_HEIGHT)
        index += 1
        const name = path === '/' ? 'Home' : path.replace(/^\//, '')
        const id = store.createShape('FRAME', at.x, at.y, PAGE_WIDTH, PAGE_HEIGHT, pageId, name)
        const node = store.graph.getNode(id)
        if (!node) continue
        store.updateNodeWithUndo(
          id,
          {
            // A route filled with a value can name a path longer than a frame's label holds.
            pluginData: pluginDataWithLivePage(node, { url, label: pageLabel(path), mode: 'live' })
          },
          'Link page'
        )
        opened += 1
      }
    })
    return opened
  }

  return { project, documentPath, baseAddress, listRoutes, openAll }
}

export type LivePagesSource = ReturnType<typeof useLivePagesSource>
