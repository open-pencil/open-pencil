import { ref } from 'vue'

import { IS_TAURI, type ACPAgentDef, type ACPAgentID } from '@open-pencil/core/constants'

import {
  checkAgentAuth,
  signInWithAgent,
  type AgentAuthCheck,
  type ToolsProbe
} from '@/app/ai/agents/acp/auth/session'
import type { AgentAuthMethod, AgentAuthStatus } from '@/app/ai/agents/acp/auth/status'
import { startTerminalSignIn, type TerminalSignIn } from '@/app/ai/agents/acp/auth/terminal'

/** What setup knows about the account a coding agent uses. */
export interface AgentAccount {
  checking: boolean
  /** Undefined until checked; null when the agent does not report its login. */
  status: AgentAuthStatus | null | undefined
  /** The ACP program that answered, null when it did not say. */
  adapter: AgentAuthCheck['adapter']
  /** The agent offers the auth method setup signs in with. */
  canSignIn: boolean
  signingIn: boolean
  /** A sign-in page to open by hand, when the login printed one. */
  signInURL: string | null
  /** The sign-in reads a code pasted from its page. */
  acceptsCode: boolean
  /** Whether a session reached OpenPencil's tools; null until a signed-in check says. */
  tools: AgentAuthCheck['tools']
  error: 'check' | 'sign-in' | null
}

const NOT_CHECKED: AgentAccount = {
  checking: false,
  status: undefined,
  adapter: null,
  canSignIn: false,
  signingIn: false,
  signInURL: null,
  acceptsCode: false,
  tools: null,
  error: null
}

type Accounts = Partial<Record<ACPAgentID, AgentAccount>>

export function createAgentAccounts(options: {
  enabled: boolean
  check: (agent: ACPAgentDef) => Promise<AgentAuthCheck>
  signInWithAgent: (
    agent: ACPAgentDef,
    methodId: string,
    signal: AbortSignal
  ) => Promise<AgentAuthStatus | null>
  startTerminalSignIn: (
    agent: ACPAgentDef,
    args: string[],
    onURL: (url: string) => void
  ) => Promise<TerminalSignIn>
}) {
  const accounts = ref<Accounts>({})
  const methods = new Map<ACPAgentID, AgentAuthMethod[]>()
  const checks = new Map<ACPAgentID, Promise<void>>()
  const signIns = new Map<
    ACPAgentID,
    { cancel(): Promise<void>; submitCode?: TerminalSignIn['submitCode'] }
  >()

  function account(id: ACPAgentID): AgentAccount {
    return accounts.value[id] ?? NOT_CHECKED
  }

  function update(id: ACPAgentID, patch: Partial<AgentAccount>) {
    accounts.value = { ...accounts.value, [id]: { ...account(id), ...patch } }
  }

  function signInMethod(agent: ACPAgentDef): AgentAuthMethod | undefined {
    const wanted = agent.signIn
    if (!wanted) return undefined
    const method = methods.get(agent.id)?.find((candidate) => candidate.id === wanted.method)
    if (wanted.via === 'terminal' && method?.type !== 'terminal') return undefined
    return method
  }

  /** Starts the agent and records the login it reports; joins a check already running. */
  function check(agent: ACPAgentDef): Promise<void> {
    if (!options.enabled) return Promise.resolve()
    const running = checks.get(agent.id)
    if (running) return running
    update(agent.id, { checking: true, error: null })
    const pending = options
      .check(agent)
      .then((result) => {
        methods.set(agent.id, result.methods)
        update(agent.id, {
          status: result.status,
          adapter: result.adapter,
          tools: result.tools,
          canSignIn: signInMethod(agent) !== undefined
        })
        return undefined
      })
      .catch(() => update(agent.id, { error: 'check' }))
      .finally(() => {
        update(agent.id, { checking: false })
        checks.delete(agent.id)
      })
    checks.set(agent.id, pending)
    return pending
  }

  async function signIn(agent: ACPAgentDef): Promise<void> {
    if (!options.enabled || account(agent.id).signingIn) return
    if (!methods.has(agent.id)) await check(agent)
    const method = signInMethod(agent)
    if (!method) {
      update(agent.id, { error: 'sign-in' })
      return
    }
    update(agent.id, { signingIn: true, signInURL: null, acceptsCode: false, error: null })
    // A field, so the cancel callbacks' writes are visible to the checks below.
    const run = { cancelled: false, signedIn: false }
    try {
      if (agent.signIn?.via === 'terminal') {
        const login = await options.startTerminalSignIn(agent, agent.signIn.args, (url) =>
          update(agent.id, { signInURL: url })
        )
        signIns.set(agent.id, {
          cancel: () => {
            run.cancelled = true
            return login.cancel()
          },
          submitCode: login.submitCode
        })
        update(agent.id, { acceptsCode: true })
        await login.done
        run.signedIn = true
      } else {
        const controller = new AbortController()
        signIns.set(agent.id, {
          cancel: async () => {
            run.cancelled = true
            controller.abort()
          }
        })
        const status = await options.signInWithAgent(agent, method.id, controller.signal)
        if (status) update(agent.id, { status })
        run.signedIn = true
      }
    } catch {
      if (!run.cancelled) update(agent.id, { error: 'sign-in' })
    } finally {
      signIns.delete(agent.id)
      update(agent.id, { signingIn: false, signInURL: null, acceptsCode: false })
    }
    // The agent reports the new login when it starts again.
    if (run.signedIn) await check(agent)
  }

  async function cancelSignIn(id: ACPAgentID): Promise<void> {
    await signIns.get(id)?.cancel()
  }

  async function submitCode(id: ACPAgentID, code: string): Promise<void> {
    await signIns.get(id)?.submitCode?.(code)
  }

  /** A login the agent reported elsewhere, such as during a chat. */
  function report(id: ACPAgentID, status: AgentAuthStatus) {
    update(id, { status })
  }

  return { supported: options.enabled, account, check, signIn, cancelSignIn, submitCode, report }
}

/** Starts a session as a chat does: in the agent workspace, linked to OpenPencil's tools. */
const chatTools: ToolsProbe = {
  cwd: async () => (await import('@/app/ai/agents/setup/native')).agentWorkspace(),
  link: async () => {
    const [{ getAutomationAuthToken }, { linkOwnTools }] = await Promise.all([
      import('@/app/automation/mcp/spawn'),
      import('@/app/ai/agents/acp/tools')
    ])
    return linkOwnTools(await getAutomationAuthToken())
  }
}

export const agentAccounts = createAgentAccounts({
  enabled: IS_TAURI,
  check: (agent) => checkAgentAuth(agent, { tools: chatTools }),
  signInWithAgent: (agent, methodId, signal) => signInWithAgent(agent, methodId, signal),
  startTerminalSignIn
})
