import { expect, test } from 'bun:test'

import {
  confirmDocumentClose,
  holdsUnkeptEdits,
  type CloseChoice,
  type CloseResult
} from '@/app/document/close/controller'

test.each<Extract<CloseChoice, CloseResult>>(['cancel', 'discard'])(
  '%s does not save the document',
  async (choice) => {
    let saves = 0
    const result = await confirmDocumentClose(
      {
        state: { roomKeepsEdits: false },
        hasUnsavedChanges: () => true,
        saveFigFile: async () => {
          saves++
          return true
        }
      },
      async () => choice
    )
    expect(result).toBe(choice)
    expect(saves).toBe(0)
  }
)

test('clean documents close without prompting', async () => {
  expect(
    await confirmDocumentClose(
      {
        state: { roomKeepsEdits: false },
        hasUnsavedChanges: () => false,
        saveFigFile: async () => {
          throw new Error('Unexpected save')
        }
      },
      async () => {
        throw new Error('Unexpected prompt')
      }
    )
  ).toBe('saved')
})

test('a cancelled file picker prevents close', async () => {
  expect(
    await confirmDocumentClose(
      {
        state: { roomKeepsEdits: false },
        hasUnsavedChanges: () => true,
        saveFigFile: async () => false
      },
      async () => 'save'
    )
  ).toBe('cancel')
})

test('edits during a successful write prevent close', async () => {
  expect(
    await confirmDocumentClose(
      {
        state: { roomKeepsEdits: false },
        hasUnsavedChanges: () => true,
        saveFigFile: async () => true
      },
      async () => 'save'
    )
  ).toBe('cancel')
})

test('a successful save of the current revision permits close', async () => {
  let dirty = true
  expect(
    await confirmDocumentClose(
      {
        state: { roomKeepsEdits: false },
        hasUnsavedChanges: () => dirty,
        saveFigFile: async () => {
          dirty = false
          return true
        }
      },
      async () => 'save'
    )
  ).toBe('saved')
})

test('write failures propagate without authorizing close', async () => {
  await expect(
    confirmDocumentClose(
      {
        state: { roomKeepsEdits: false },
        hasUnsavedChanges: () => true,
        saveFigFile: async () => {
          throw new Error('Disk full')
        }
      },
      async () => 'save'
    )
  ).rejects.toThrow('Disk full')
})

test('a document whose room keeps its edits saves without asking and closes', async () => {
  let saves = 0
  const inRoom = (save: () => Promise<boolean>) => ({
    state: { roomKeepsEdits: true },
    hasUnsavedChanges: () => true,
    saveFigFile: async () => {
      saves++
      return save()
    }
  })
  const unexpectedPrompt = async (): Promise<CloseChoice> => {
    throw new Error('Unexpected prompt')
  }
  expect(
    await confirmDocumentClose(
      inRoom(async () => true),
      unexpectedPrompt
    )
  ).toBe('saved')
  // The room still holds what a failed upload left out.
  expect(
    await confirmDocumentClose(
      inRoom(async () => {
        throw new Error('Offline')
      }),
      unexpectedPrompt
    )
  ).toBe('saved')
  expect(saves).toBe(2)
})

test('only edits nobody keeps hold a document open', () => {
  const document = (dirty: boolean, roomKeepsEdits: boolean) => ({
    state: { roomKeepsEdits },
    hasUnsavedChanges: () => dirty,
    saveFigFile: async () => true
  })
  expect(holdsUnkeptEdits(document(true, false))).toBe(true)
  expect(holdsUnkeptEdits(document(true, true))).toBe(false)
  expect(holdsUnkeptEdits(document(false, false))).toBe(false)
})

test('a document whose room loses its edits while it saves asks as any other', async () => {
  const state = { roomKeepsEdits: true }
  let asked = 0
  const result = await confirmDocumentClose(
    {
      state,
      hasUnsavedChanges: () => true,
      saveFigFile: async () => {
        state.roomKeepsEdits = false
        throw new Error('Offline')
      }
    },
    async () => {
      asked++
      return 'cancel'
    }
  )
  expect(result).toBe('cancel')
  expect(asked).toBe(1)
})
