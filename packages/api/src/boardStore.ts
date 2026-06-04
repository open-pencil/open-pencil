import type {
  AddBoardCollaboratorInput,
  BoardRecord,
  BoardStore,
  CreateBoardInput
} from './types.js'

function cloneBoard(record: BoardRecord): BoardRecord {
  return structuredClone(record)
}

export function createBoardStore(): BoardStore {
  const boards = new Map<string, BoardRecord>()

  return {
    createBoard(input: CreateBoardInput) {
      const createdAt = Date.now()
      const record: BoardRecord = {
        id: crypto.randomUUID(),
        name: input.name,
        creatorAnonymousId: input.creatorAnonymousId,
        createdAt,
        updatedAt: createdAt,
        collaborators: [
          {
            anonymousId: input.creatorAnonymousId,
            role: 'owner',
            addedAt: createdAt,
            invitationId: null
          }
        ]
      }
      boards.set(record.id, record)
      return cloneBoard(record)
    },
    findBoard(id: string) {
      const record = boards.get(id)
      return record ? cloneBoard(record) : null
    },
    listBoardsForAnonymous(anonymousId: string) {
      return [...boards.values()]
        .filter(
          (record) =>
            record.creatorAnonymousId === anonymousId ||
            record.collaborators.some((collaborator) => collaborator.anonymousId === anonymousId)
        )
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .map((record) => cloneBoard(record))
    },
    deleteBoard(id: string) {
      const record = boards.get(id)
      if (!record) return null
      boards.delete(id)
      return cloneBoard(record)
    },
    addCollaborator(boardId: string, input: AddBoardCollaboratorInput) {
      const record = boards.get(boardId)
      if (!record) return null
      const existing = record.collaborators.find(
        (collaborator) => collaborator.anonymousId === input.anonymousId
      )
      const now = Date.now()
      if (existing) {
        existing.role = input.role
        existing.invitationId = input.invitationId
        record.updatedAt = now
        boards.set(boardId, record)
        return cloneBoard(record)
      }
      record.collaborators.push({
        anonymousId: input.anonymousId,
        role: input.role,
        addedAt: now,
        invitationId: input.invitationId
      })
      record.updatedAt = now
      boards.set(boardId, record)
      return cloneBoard(record)
    }
  }
}
