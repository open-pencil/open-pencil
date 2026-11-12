import { expect, test } from 'bun:test'

import type { GitFileState } from '@/app/integrations/git/schema'
import { emptyDriftFile, type DriftFile, type DriftReference } from '@/app/live-pages/drift/schema'
import type { SidecarFiles } from '@/app/live-pages/drift/sidecar/files'
import type { SidecarGit } from '@/app/live-pages/drift/sidecar/git'
import { DRIFT_SIDECAR_PATH, parseSidecar } from '@/app/live-pages/drift/sidecar/model'
import { publishBaselines } from '@/app/live-pages/drift/sidecar/publish'
import { readBaselines, writeBaselines } from '@/app/live-pages/drift/sidecar/run'
import type { DriftDocument } from '@/app/live-pages/drift/use'

const repository = 'D:/work/site'

function referenceOf(nodeId: string, capturedAt: string, digest = 'a'.repeat(64)): DriftReference {
  return {
    nodeId,
    url: 'http://localhost:3000/pricing',
    capturedAt,
    width: 1440,
    height: 900,
    digest
  }
}

/** A document whose baselines a test can read back, standing in for the open one. */
function documentOf(initial: DriftFile = emptyDriftFile()) {
  let file = initial
  const writes: DriftFile[] = []
  const document: DriftDocument = {
    read: () => file,
    write(next) {
      file = next
      writes.push(next)
    }
  }
  return { document, writes }
}

/** A project's folder as a test sees it: one file a write replaces, or refuses to. */
function filesOf(initial: string | null = null) {
  const state = { text: initial, written: [] as string[], accepts: true }
  const files: SidecarFiles = {
    async read() {
      return state.text
    },
    async write(_repository, text) {
      if (!state.accepts) return false
      state.text = text
      state.written.push(text)
      return true
    }
  }
  return { files, state }
}

/** Git as the publish path reads it: how the sidecar stands, and whether a commit was made. */
function gitOf(state: GitFileState | null) {
  const commits: string[] = []
  const git: SidecarGit = {
    async state() {
      return state
    },
    async commit(_repository, path, message) {
      commits.push(`${path}: ${message}`)
      return true
    }
  }
  return { git, commits }
}

test('writing keeps the pictures in the project, named after their document', async () => {
  const { document } = documentOf({
    version: 1,
    references: {
      frame: referenceOf('frame', '2026-11-09T12:00:00.000Z'),
      other: referenceOf('other', '2026-11-09T12:00:00.000Z')
    }
  })
  const { files, state } = filesOf()

  const written = await writeBaselines({ repository, document, name: 'site.pen', files })

  expect(written).toEqual({ status: 'written', frames: 2 })
  const sidecar = parseSidecar(state.text ?? '')
  expect(sidecar.document).toBe('site.pen')
  expect(Object.keys(sidecar.references).sort()).toEqual(['frame', 'other'])
})

test('a document with no picture writes nothing rather than an empty set', async () => {
  const { document } = documentOf()
  const { files, state } = filesOf()

  expect(await writeBaselines({ repository, document, name: 'site.pen', files })).toEqual({
    status: 'empty'
  })
  expect(state.written).toEqual([])
})

test('a folder that refuses the write answers so instead of throwing', async () => {
  const { document } = documentOf({
    version: 1,
    references: { frame: referenceOf('frame', '2026-11-09T12:00:00.000Z') }
  })
  const { files, state } = filesOf()
  state.accepts = false

  expect(await writeBaselines({ repository, document, name: 'site.pen', files })).toEqual({
    status: 'unavailable'
  })
})

test('writing keeps the pictures the project already holds', async () => {
  const { document } = documentOf({
    version: 1,
    references: { mine: referenceOf('mine', '2026-11-09T12:00:00.000Z') }
  })
  const held = JSON.stringify({
    version: 1,
    document: 'site.pen',
    references: { theirs: referenceOf('theirs', '2026-11-08T12:00:00.000Z') }
  })
  const { files, state } = filesOf(held)

  const written = await writeBaselines({ repository, document, name: 'site.pen', files })

  expect(written).toEqual({ status: 'written', frames: 2 })
  expect(Object.keys(parseSidecar(state.text ?? '').references).sort()).toEqual(['mine', 'theirs'])
})

test('the only copy of another document’s pictures is never replaced', async () => {
  const { document } = documentOf({
    version: 1,
    references: { mine: referenceOf('mine', '2026-11-09T12:00:00.000Z') }
  })
  const held = JSON.stringify({
    version: 1,
    document: 'other.pen',
    references: { theirs: referenceOf('theirs', '2026-11-08T12:00:00.000Z') }
  })
  const { files, state } = filesOf(held)

  expect(await writeBaselines({ repository, document, name: 'site.pen', files })).toEqual({
    status: 'other-document'
  })
  expect(state.written).toEqual([])
  expect(state.text).toBe(held)
})

test('a pull request is not opened onto another document’s sidecar', async () => {
  const { document } = documentOf({
    version: 1,
    references: { mine: referenceOf('mine', '2026-11-09T12:00:00.000Z') }
  })
  const { files } = filesOf(
    JSON.stringify({
      version: 1,
      document: 'other.pen',
      references: { theirs: referenceOf('theirs', '2026-11-08T12:00:00.000Z') }
    })
  )
  const { git, commits } = gitOf('untracked')

  expect(await publishBaselines({ repository, document, name: 'site.pen', files, git })).toBe(
    'other-document'
  )
  expect(commits).toEqual([])
})

test('a project with no sidecar leaves the document alone', async () => {
  const { document, writes } = documentOf()
  const { files } = filesOf(null)

  expect(await readBaselines({ repository, document, name: 'site.pen', files })).toEqual({
    status: 'missing'
  })
  expect(writes).toEqual([])
})

test('a sidecar of another document is not read into this one', async () => {
  const { document, writes } = documentOf()
  const { files } = filesOf(
    JSON.stringify({
      version: 1,
      document: 'other.pen',
      references: { frame: referenceOf('frame', '2026-11-09T12:00:00.000Z') }
    })
  )

  expect(await readBaselines({ repository, document, name: 'site.pen', files })).toEqual({
    status: 'other-document'
  })
  expect(writes).toEqual([])
})

test('reading the project folds its pictures in as one undoable edit', async () => {
  const { document, writes } = documentOf()
  const { files } = filesOf(
    JSON.stringify({
      version: 1,
      document: 'site.pen',
      references: { frame: referenceOf('frame', '2026-11-09T12:00:00.000Z') }
    })
  )

  const read = await readBaselines({ repository, document, name: 'site.pen', files })

  expect(read).toEqual({ status: 'restored', frames: 1 })
  expect(writes).toHaveLength(1)
  expect(writes[0]?.references.frame.digest).toBe('a'.repeat(64))
})

test('reading the same pictures twice does not edit the document again', async () => {
  const { document, writes } = documentOf({
    version: 1,
    references: { frame: referenceOf('frame', '2026-11-09T12:00:00.000Z') }
  })
  const { files } = filesOf(
    JSON.stringify({
      version: 1,
      document: 'site.pen',
      references: { frame: referenceOf('frame', '2026-11-09T09:00:00.000Z', 'c'.repeat(64)) }
    })
  )

  expect(await readBaselines({ repository, document, name: 'site.pen', files })).toEqual({
    status: 'unchanged'
  })
  expect(writes).toEqual([])
})

test('a pull request carries the pictures it compares against', async () => {
  const { document } = documentOf({
    version: 1,
    references: { frame: referenceOf('frame', '2026-11-09T12:00:00.000Z') }
  })
  const { files } = filesOf()
  const { git, commits } = gitOf('untracked')

  const published = await publishBaselines({ repository, document, name: 'site.pen', files, git })

  expect(published).toBe('committed')
  expect(commits).toEqual([`${DRIFT_SIDECAR_PATH}: chore: record page baselines`])
})

test('a sidecar git already holds is written but not committed again', async () => {
  const { document } = documentOf({
    version: 1,
    references: { frame: referenceOf('frame', '2026-11-09T12:00:00.000Z') }
  })
  const { files, state } = filesOf()
  const { git, commits } = gitOf('clean')

  expect(await publishBaselines({ repository, document, name: 'site.pen', files, git })).toBe(
    'unchanged'
  )
  expect(state.written).toHaveLength(1)
  expect(commits).toEqual([])
})

test('a document with no picture publishes nothing', async () => {
  const { document } = documentOf()
  const { files, state } = filesOf()
  const { git, commits } = gitOf('untracked')

  expect(await publishBaselines({ repository, document, name: 'site.pen', files, git })).toBe(
    'empty'
  )
  expect(state.written).toEqual([])
  expect(commits).toEqual([])
})

test('a repository git cannot read answers so rather than committing blind', async () => {
  const { document } = documentOf({
    version: 1,
    references: { frame: referenceOf('frame', '2026-11-09T12:00:00.000Z') }
  })
  const { files } = filesOf()
  const { git, commits } = gitOf(null)

  expect(await publishBaselines({ repository, document, name: 'site.pen', files, git })).toBe(
    'unavailable'
  )
  expect(commits).toEqual([])
})
