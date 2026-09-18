import { describe, expect, mock, test } from 'bun:test'

import { openDeepLink, resolveDeepLinkFile } from '@/app/document/io/deep-link'

/**
 * Stands in for the `path_matches_suffix` Tauri command. The real comparator asks the
 * platform (ASCII-case-insensitive on macOS and Windows, exact on Linux); these tests
 * cover the resolver's own contract, and the case rule is tested in `deep_link.rs`.
 */
const matchesSuffix = async (candidate: string, relative: string): Promise<boolean> => {
  const a = candidate.replaceAll('\\', '/')
  const r = relative.replaceAll('\\', '/')
  return a === r || a.endsWith(`/${r}`)
}

const caseInsensitiveMatches = async (candidate: string, relative: string): Promise<boolean> =>
  matchesSuffix(candidate.toLowerCase(), relative.toLowerCase())

function io(overrides: Partial<Parameters<typeof openDeepLink>[2]> = {}) {
  return {
    choosePaths: mock(async (): Promise<string[]> => []),
    openPath: mock(async (): Promise<void> => undefined),
    activateTab: mock(async (): Promise<boolean> => true),
    matchesSuffix,
    ...overrides
  }
}

describe('resolveDeepLinkFile', () => {
  test('matches an open tab whose path ends with the relative file', async () => {
    expect(
      await resolveDeepLinkFile(
        'web/design/hikyo.pen',
        ['/r/hikyo/web/design/hikyo.pen'],
        matchesSuffix
      )
    ).toBe('/r/hikyo/web/design/hikyo.pen')
  })

  test('returns null when nothing matches', async () => {
    expect(
      await resolveDeepLinkFile('web/design/hikyo.pen', ['/other/x.pen'], matchesSuffix)
    ).toBeNull()
  })

  test('does not match a partial segment', async () => {
    expect(
      await resolveDeepLinkFile('design/hikyo.pen', ['/r/redesign/hikyo.pen'], matchesSuffix)
    ).toBeNull()
  })

  test('accepts backslashes on either side', async () => {
    expect(
      await resolveDeepLinkFile(
        'web\\design\\hikyo.pen',
        ['C:\\r\\web\\design\\hikyo.pen'],
        matchesSuffix
      )
    ).toBe('C:\\r\\web\\design\\hikyo.pen')
  })

  test('takes the comparator verdict, so a case-insensitive filesystem still matches', async () => {
    const paths = ['/r/hikyo/Web/Design/Hikyo.pen']
    expect(await resolveDeepLinkFile('web/design/hikyo.pen', paths, matchesSuffix)).toBeNull()
    expect(await resolveDeepLinkFile('web/design/hikyo.pen', paths, caseInsensitiveMatches)).toBe(
      '/r/hikyo/Web/Design/Hikyo.pen'
    )
  })

  test('returns the first matching open path', async () => {
    expect(
      await resolveDeepLinkFile('hikyo.pen', ['/a/hikyo.pen', '/b/hikyo.pen'], matchesSuffix)
    ).toBe('/a/hikyo.pen')
  })
})

describe('openDeepLink', () => {
  test('activates the tab of an already open file without re-reading it from disk', async () => {
    const selectByName = mock(() => true)
    const deps = io()
    const notices: string[] = []

    await openDeepLink(
      { path: 'web/design/hikyo.pen', node: 'Button/Large/Default' },
      {
        openPaths: () => ['/r/hikyo/web/design/hikyo.pen'],
        selectByName,
        notify: (message) => notices.push(message)
      },
      deps
    )

    expect(deps.choosePaths).not.toHaveBeenCalled()
    // The resolved absolute path, never the link's own string, and never a disk read:
    // a file that moved since its tab opened must still focus that tab.
    expect(deps.activateTab).toHaveBeenCalledTimes(1)
    expect(deps.activateTab).toHaveBeenCalledWith('/r/hikyo/web/design/hikyo.pen')
    expect(deps.openPath).not.toHaveBeenCalled()
    expect(selectByName).toHaveBeenCalledWith('Button/Large/Default')
    expect(notices).toEqual([])
  })

  test('opens the path when its tab closed between the snapshot and the activate', async () => {
    const deps = io({ activateTab: mock(async () => false) })
    const notices: string[] = []

    await openDeepLink(
      { path: 'web/design/hikyo.pen' },
      {
        openPaths: () => ['/r/hikyo/web/design/hikyo.pen'],
        selectByName: () => true,
        notify: (message) => notices.push(message)
      },
      deps
    )

    expect(deps.openPath).toHaveBeenCalledWith('/r/hikyo/web/design/hikyo.pen')
    expect(deps.choosePaths).not.toHaveBeenCalled()
    expect(notices).toEqual([])
  })

  test('opens the picked file and selects the node when no tab matches', async () => {
    const selectByName = mock(() => true)
    const deps = io({ choosePaths: mock(async () => ['/picked/web/design/hikyo.pen']) })
    const notices: string[] = []

    await openDeepLink(
      { path: 'web/design/hikyo.pen', node: 'Button/Large/Default' },
      {
        openPaths: () => [],
        selectByName,
        notify: (message) => notices.push(message)
      },
      deps
    )

    expect(deps.choosePaths).toHaveBeenCalledTimes(1)
    // The picker branch reads the file: nothing is open yet, so there is no tab to focus.
    expect(deps.activateTab).not.toHaveBeenCalled()
    expect(deps.openPath).toHaveBeenCalledTimes(1)
    expect(deps.openPath).toHaveBeenCalledWith('/picked/web/design/hikyo.pen')
    expect(deps.openPath).not.toHaveBeenCalledWith('web/design/hikyo.pen')
    expect(selectByName).toHaveBeenCalledWith('Button/Large/Default')
    expect(notices).toHaveLength(1)
  })

  test('notifies when the node is missing', async () => {
    const deps = io()
    const notices: string[] = []

    await openDeepLink(
      { path: 'web/design/hikyo.pen', node: 'Nope' },
      {
        openPaths: () => ['/r/hikyo/web/design/hikyo.pen'],
        selectByName: () => false,
        notify: (message) => notices.push(message)
      },
      deps
    )

    expect(deps.activateTab).toHaveBeenCalledWith('/r/hikyo/web/design/hikyo.pen')
    expect(notices).toHaveLength(1)
    expect(notices[0]).toContain('Nope')
  })

  test('reports a dismissed picker as nothing chosen, not a wrong file', async () => {
    const deps = io({ choosePaths: mock(async () => []) })
    const notices: string[] = []

    await openDeepLink(
      { path: 'web/design/hikyo.pen', node: 'Button' },
      {
        openPaths: () => [],
        selectByName: () => true,
        notify: (message) => notices.push(message)
      },
      deps
    )

    expect(deps.choosePaths).toHaveBeenCalledTimes(1)
    expect(deps.openPath).not.toHaveBeenCalled()
    expect(deps.activateTab).not.toHaveBeenCalled()
    // The locate prompt, then a dismissal notice that does not name an unchosen file.
    expect(notices).toHaveLength(2)
    expect(notices[1]).toBe('Link cancelled: no file was chosen.')
  })

  test('cancels the link when the picked file is not the requested one', async () => {
    const deps = io({
      choosePaths: mock(async () => ['/elsewhere/other.pen']),
      openPath: mock(async (path: string): Promise<void> => {
        throw new Error(`unexpected open of ${path}`)
      })
    })
    const notices: string[] = []

    await openDeepLink(
      { path: 'web/design/hikyo.pen', node: 'Button' },
      {
        openPaths: () => [],
        selectByName: () => true,
        notify: (message) => notices.push(message)
      },
      deps
    )

    expect(deps.choosePaths).toHaveBeenCalledTimes(1)
    expect(deps.openPath).not.toHaveBeenCalled()
    expect(deps.activateTab).not.toHaveBeenCalled()
    expect(notices).toHaveLength(2)
    expect(notices[1]).toContain('web/design/hikyo.pen')
  })
})
