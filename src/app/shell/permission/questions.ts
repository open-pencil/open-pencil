import { invoke } from '@tauri-apps/api/core'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import * as v from 'valibot'
import { onScopeDispose, shallowRef } from 'vue'

const optionSchema = v.object({ optionId: v.string(), name: v.string(), kind: v.string() })

/**
 * What an agent asks the person, as the desktop app holds it (`desktop/src/host/permission.rs`):
 * to run a tool, with ACP's `toolCall` and its options, to switch to a mode in which it runs
 * tools without asking, or for an OpenPencil tool to read or write a file it named.
 */
const questionSchema = v.variant('kind', [
  v.object({
    id: v.number(),
    kind: v.literal('tool'),
    agent: v.string(),
    params: v.object({
      toolCall: v.object({
        title: v.nullish(v.string()),
        rawInput: v.optional(v.unknown())
      }),
      options: v.array(optionSchema)
    })
  }),
  v.object({ id: v.number(), kind: v.literal('mode'), agent: v.string(), mode: v.string() }),
  v.object({
    id: v.number(),
    kind: v.literal('file'),
    /** The MCP client's own name; empty when it gave none. */
    client: v.string(),
    tool: v.string(),
    write: v.boolean(),
    path: v.string()
  })
])

export type PermissionQuestion = v.InferOutput<typeof questionSchema>
export type PermissionOption = v.InferOutput<typeof optionSchema>

/** The answer that confirms a mode or a file; none refuses it. */
export const ALLOW_MODE = 'allow'

/** What the desktop app tells this window when its questions change. */
const CHANGED_EVENT = 'permission:changed'

/**
 * The questions agents wait on, oldest first, as the permission window shows them. Only this
 * window may read and answer them; the desktop app closes it once none are left.
 */
export function usePermissionQuestions() {
  const questions = shallowRef<PermissionQuestion[]>([])

  async function refresh() {
    const listed = v.safeParse(v.array(questionSchema), await invoke<unknown>('permission_questions'))
    questions.value = listed.success ? listed.output : []
  }

  /** Answers a question with one of its options, or refuses it with none. */
  async function answer(id: number, option: string | null) {
    questions.value = questions.value.filter((question) => question.id !== id)
    await invoke('permission_answer', { id, option })
  }

  let stop: (() => void) | undefined
  let disposed = false
  void getCurrentWebviewWindow()
    .listen(CHANGED_EVENT, () => void refresh())
    .then((unlisten) => {
      if (disposed) unlisten()
      else stop = unlisten
      return undefined
    })
  void refresh()
  onScopeDispose(() => {
    disposed = true
    stop?.()
  })

  return { questions, answer }
}
