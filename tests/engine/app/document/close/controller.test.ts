import { expect, test } from 'bun:test'

import { confirmDocumentClose, type CloseChoice } from '@/app/document/close/controller'

test.each<CloseChoice>(['cancel', 'discard'])('%s does not save the document', async (choice) => {
  let saves = 0
  const result = await confirmDocumentClose(
    {
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
})

test('clean documents close without prompting', async () => {
  expect(
    await confirmDocumentClose(
      {
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
        hasUnsavedChanges: () => true,
        saveFigFile: async () => {
          throw new Error('Disk full')
        }
      },
      async () => 'save'
    )
  ).rejects.toThrow('Disk full')
})
