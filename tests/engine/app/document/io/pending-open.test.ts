import { afterEach, describe, expect, mock, test } from 'bun:test'

import { localeSetting } from '@open-pencil/vue'

import type { PendingOpenFile } from '@/app/document/io/pending-open'
import { openPendingFiles } from '@/app/document/io/pending-open'
import { toast } from '@/app/shell/ui'

afterEach(() => {
  toast.toasts.value = []
  localeSetting.set(undefined)
})

const actions = {
  openPaths: () => [] as string[],
  selectByName: () => true,
  notify: () => undefined
}

function io() {
  return {
    openPath: mock(async (): Promise<void> => undefined),
    openLink: mock(async (): Promise<void> => undefined)
  }
}

describe('openPendingFiles', () => {
  test('routes a deep-link entry to the deep-link resolver, never to the plain opener', async () => {
    const deps = io()
    const file: PendingOpenFile = {
      path: 'tests/fixtures/pencil_button.pen',
      node: 'Button/Large/Default',
      deepLink: true
    }

    await openPendingFiles([file], actions, deps)

    // The relative link path must never reach `openFileFromPath`: it would be read
    // relative to the process cwd, or fail, instead of being resolved against tabs.
    expect(deps.openPath).not.toHaveBeenCalled()
    expect(deps.openLink).toHaveBeenCalledTimes(1)
    expect(deps.openLink).toHaveBeenCalledWith(
      { path: 'tests/fixtures/pencil_button.pen', node: 'Button/Large/Default' },
      actions
    )
  })

  test('routes a file-association entry to the plain opener', async () => {
    const deps = io()

    await openPendingFiles(
      [{ path: '/r/hikyo/web/design/hikyo.pen', deepLink: false }],
      actions,
      deps
    )

    expect(deps.openLink).not.toHaveBeenCalled()
    expect(deps.openPath).toHaveBeenCalledTimes(1)
    expect(deps.openPath).toHaveBeenCalledWith('/r/hikyo/web/design/hikyo.pen')
  })

  test('keeps both producers in queue order within one drain', async () => {
    const seen: string[] = []
    const deps = {
      openPath: mock(async (path: string) => {
        seen.push(`path:${path}`)
      }),
      openLink: mock(async (target: { path: string }) => {
        seen.push(`link:${target.path}`)
      })
    }

    await openPendingFiles(
      [
        { path: '/a/first.pen', deepLink: false },
        { path: 'b/second.pen', deepLink: true },
        { path: '/c/third.pen', deepLink: false }
      ],
      actions,
      deps
    )

    expect(seen).toEqual(['path:/a/first.pen', 'link:b/second.pen', 'path:/c/third.pen'])
  })

  test('toasts a failing entry and still drains the rest of the batch', async () => {
    localeSetting.set('en')
    const deps = {
      openPath: mock(async (path: string) => {
        if (path === '/a/broken.pen') throw new Error('Invalid PEN container')
      }),
      openLink: mock(async (): Promise<void> => undefined)
    }

    await expect(
      openPendingFiles(
        [
          { path: '/a/broken.pen', deepLink: false },
          { path: 'b/second.pen', deepLink: true }
        ],
        actions,
        deps
      )
    ).resolves.toBeUndefined()

    expect(deps.openLink).toHaveBeenCalledTimes(1)
    expect(toast.toasts.value).toHaveLength(1)
    expect(toast.toasts.value[0]?.message).toContain('broken.pen')
  })
})
