import { CloudAPIError, type CloudCommentRequests } from '@open-pencil/cloud/client'
import type { CloudComment, CloudCommentThread } from '@open-pencil/cloud/contract'

/** When everything the fake server keeps was written. */
export const COMMENT_TIME = '2026-11-16T10:00:00.000Z'
const NOW = COMMENT_TIME

/**
 * A server that keeps comments as Cloud does: as the signed-in account, Ana, who may comment but
 * not change others' comments, plus what other people do through `others`.
 */
export function commentServer() {
  const threads = new Map<string, CloudCommentThread>()
  const calls: string[] = []
  const comment = (id: string, body: string, name = 'Ana'): CloudComment => ({
    id,
    author: { kind: 'user', id: name.toLowerCase(), name },
    agent: null,
    body,
    createdAt: NOW,
    editedAt: null
  })
  const found = (id: string) => {
    const thread = threads.get(id)
    if (!thread) throw new CloudAPIError('missing', 404, 'not_found')
    return thread
  }
  const put = (thread: CloudCommentThread) => {
    threads.set(thread.id, thread)
    return structuredClone(thread)
  }
  const requests: CloudCommentRequests = {
    list: async () => {
      calls.push('list')
      return {
        threads: [...threads.values()].map((thread) => structuredClone(thread)),
        access: { canComment: true, canModerate: false }
      }
    },
    get: async (id) => structuredClone(found(id)),
    createThread: async ({ id = crypto.randomUUID(), body, agent: _agent, ...anchor }) => {
      calls.push('create')
      return put({
        id,
        ...anchor,
        createdAt: NOW,
        updatedAt: NOW,
        resolvedAt: null,
        resolvedBy: null,
        comments: [comment(crypto.randomUUID(), body)]
      })
    },
    updateThread: async (id, input) => {
      calls.push('update')
      const thread = found(id)
      const resolved = input.resolved ?? thread.resolvedAt !== null
      return put({
        ...thread,
        ...input.anchor,
        resolvedAt: resolved ? NOW : null,
        resolvedBy: resolved ? 'ana' : null
      })
    },
    deleteThread: async (id) => {
      calls.push('delete')
      threads.delete(id)
    },
    reply: async (id, { id: replyId = crypto.randomUUID(), body }) => {
      calls.push('reply')
      const thread = found(id)
      return put({ ...thread, comments: [...thread.comments, comment(replyId, body)] })
    },
    updateComment: async (id, commentId, { body }) => {
      calls.push('edit')
      const thread = found(id)
      const target = thread.comments.find((entry) => entry.id === commentId)
      if (target?.author.kind === 'user' && target.author.id !== 'ana') {
        throw new CloudAPIError('forbidden', 403, 'forbidden')
      }
      return put({
        ...thread,
        comments: thread.comments.map((entry) =>
          entry.id === commentId ? { ...entry, body } : entry
        )
      })
    },
    deleteComment: async () => {
      throw new Error('not used')
    }
  }
  return {
    requests,
    calls,
    threads,
    /** Someone else starts a thread. */
    others(pageId: string, body: string) {
      const id = crypto.randomUUID()
      put({
        id,
        pageId,
        pageName: null,
        nodeId: null,
        nodeName: null,
        offsetX: null,
        offsetY: null,
        x: 0,
        y: 0,
        createdAt: NOW,
        updatedAt: NOW,
        resolvedAt: null,
        resolvedBy: null,
        comments: [comment(crypto.randomUUID(), body, 'Ben')]
      })
      return id
    }
  }
}
