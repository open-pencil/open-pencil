import * as v from 'valibot'

import { IS_TAURI } from '@open-pencil/core/constants'

import { createDeferred } from '@/app/runtime/deferred'
import { openExternalLink } from '@/app/shell/ui'
import { WEB_APP_ORIGIN } from '@/constants'

import {
  createOpenRouterPKCE,
  exchangeOpenRouterCode,
  openRouterAuthorizationURL,
  OPENROUTER_CODE_LIFETIME_MS,
  parseOpenRouterCallback,
  type OpenRouterPKCE
} from './oauth'

/** Served from `public/`; it relays the redirect to the editor over this channel. */
export const OPENROUTER_CALLBACK_PATH = '/oauth/openrouter.html'
export const OPENROUTER_CALLBACK_CHANNEL = 'open-pencil:openrouter-oauth'
/** Served from `public/` on the web app; it hands the redirect to the desktop app's deep link. */
export const OPENROUTER_DESKTOP_CALLBACK_PATH = '/oauth/openrouter-desktop.html'
/** Emitted by the desktop shell for an `openpencil://oauth/<provider>?…` link. */
const OAUTH_CALLBACK_EVENT = 'oauth-callback'
const POPUP_NAME = 'open-pencil-openrouter'
const POPUP_FEATURES = 'popup,width=520,height=720'

export type OpenRouterSignInFailure = 'cancelled' | 'blocked' | 'expired' | 'failed'
export type OpenRouterSignInResult =
  | { ok: true; key: string }
  | { ok: false; reason: OpenRouterSignInFailure }

export interface OpenRouterSignInOptions {
  signal: AbortSignal
  /** Prefills the name of the key OpenRouter creates. */
  keyLabel: string
}

/** What the desktop shell forwards from an `openpencil://oauth/<provider>?…` link. */
const oauthCallbackSchema = v.object({ provider: v.string(), query: v.string() })

export interface OpenRouterSignIn {
  /** Opens the OpenRouter sign-in page again for the same attempt. */
  reopen: () => void
  result: Promise<OpenRouterSignInResult>
}

class SignInAbortedError extends Error {
  constructor() {
    super('OpenRouter sign-in was cancelled')
    this.name = 'SignInAbortedError'
  }
}

async function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw new SignInAbortedError()
  const aborted = createDeferred<never>()
  const abort = () => aborted.reject(new SignInAbortedError())
  signal.addEventListener('abort', abort, { once: true })
  try {
    return await Promise.race([promise, aborted.promise])
  } finally {
    signal.removeEventListener('abort', abort)
  }
}

async function finish(
  query: string | null,
  pkce: OpenRouterPKCE,
  signal: AbortSignal
): Promise<OpenRouterSignInResult> {
  if (query === null) return { ok: false, reason: 'expired' }
  const callback = parseOpenRouterCallback(query, pkce.state)
  if (!callback.ok)
    return { ok: false, reason: callback.reason === 'cancelled' ? 'cancelled' : 'failed' }
  return {
    ok: true,
    key: await abortable(exchangeOpenRouterCode(callback.code, pkce.verifier), signal)
  }
}

function settle(run: () => Promise<OpenRouterSignInResult>): Promise<OpenRouterSignInResult> {
  return run().catch((error: unknown) => ({
    ok: false as const,
    reason: error instanceof SignInAbortedError ? ('cancelled' as const) : ('failed' as const)
  }))
}

/** Waits for the callback page in this origin to relay the redirect query. */
function browserCallback(signal: AbortSignal): Promise<string | null> {
  const channel = new BroadcastChannel(OPENROUTER_CALLBACK_CHANNEL)
  let timer: ReturnType<typeof setTimeout> | undefined
  const received = new Promise<string | null>((resolve) => {
    timer = setTimeout(() => resolve(null), OPENROUTER_CODE_LIFETIME_MS)
    channel.addEventListener('message', (event: MessageEvent<unknown>) => {
      if (typeof event.data === 'string') resolve(event.data)
    })
  })
  return abortable(received, signal).finally(() => {
    clearTimeout(timer)
    channel.close()
  })
}

/**
 * Opens OpenRouter in a popup that returns to this origin. Must be called from the click that
 * starts sign-in, before anything is awaited, or the browser blocks the popup.
 */
function browserSignIn({ signal, keyLabel }: OpenRouterSignInOptions): OpenRouterSignIn {
  let popup = window.open('', POPUP_NAME, POPUP_FEATURES)
  let authorizationURL = ''
  const reopen = () => {
    if (authorizationURL) popup = window.open(authorizationURL, POPUP_NAME, POPUP_FEATURES) ?? popup
  }
  const result = settle(async () => {
    if (!popup) return { ok: false, reason: 'blocked' }
    const pkce = await createOpenRouterPKCE()
    const callbackURL = new URL(OPENROUTER_CALLBACK_PATH, window.location.origin).href
    authorizationURL = openRouterAuthorizationURL(callbackURL, pkce, keyLabel)
    popup.location.href = authorizationURL
    try {
      return await finish(await browserCallback(signal), pkce, signal)
    } finally {
      popup.close()
    }
  })
  return { reopen, result }
}

/**
 * Listens for the `openpencil://oauth/openrouter` link the hosted callback page opens; the
 * desktop shell forwards its query as an `oauth-callback` event.
 */
async function listenForDesktopCallback() {
  const { listen } = await import('@tauri-apps/api/event')
  const received = createDeferred<string | null>()
  const timer = setTimeout(() => received.resolve(null), OPENROUTER_CODE_LIFETIME_MS)
  const unlisten = await listen<unknown>(OAUTH_CALLBACK_EVENT, (event) => {
    const callback = v.safeParse(oauthCallbackSchema, event.payload)
    if (callback.success && callback.output.provider === 'openrouter') {
      received.resolve(callback.output.query)
    }
  })
  return {
    query: (signal: AbortSignal) => abortable(received.promise, signal),
    stop: () => {
      clearTimeout(timer)
      unlisten()
    }
  }
}

/** Opens OpenRouter in the system browser, which returns to the app through a deep link. */
function desktopSignIn({ signal, keyLabel }: OpenRouterSignInOptions): OpenRouterSignIn {
  let authorizationURL = ''
  const reopen = () => {
    if (authorizationURL) void openExternalLink(authorizationURL)
  }
  const result = settle(async () => {
    const [pkce, callback] = await Promise.all([createOpenRouterPKCE(), listenForDesktopCallback()])
    try {
      const callbackURL = new URL(OPENROUTER_DESKTOP_CALLBACK_PATH, WEB_APP_ORIGIN).href
      authorizationURL = openRouterAuthorizationURL(callbackURL, pkce, keyLabel)
      await openExternalLink(authorizationURL)
      return await finish(await callback.query(signal), pkce, signal)
    } finally {
      callback.stop()
    }
  })
  return { reopen, result }
}

/** Signs in to OpenRouter with OAuth PKCE and returns a new API key for this app. */
export function signInWithOpenRouter(options: OpenRouterSignInOptions): OpenRouterSignIn {
  return IS_TAURI ? desktopSignIn(options) : browserSignIn(options)
}
