import * as v from 'valibot'

import { IS_TAURI } from '@open-pencil/core/constants'

import { createDeferred } from '@/app/runtime/deferred'
import { openExternalLink } from '@/app/shell/ui'
import { WEB_APP_ORIGIN } from '@/constants'

import {
  callbackOutcome,
  startSignIn,
  type CallbackOutcome,
  type SignIn,
  type SignInCallback,
  type SignInFailure
} from '../sign-in/attempt'
import {
  exchangeOpenRouterCode,
  openRouterAuthorizationURL,
  OPENROUTER_CODE_LIFETIME_MS
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

export type OpenRouterSignInFailure = SignInFailure | 'blocked'
export type OpenRouterSignIn = SignIn<string, 'blocked'>

export interface OpenRouterSignInOptions {
  signal: AbortSignal
  /** Prefills the name of the key OpenRouter creates. */
  keyLabel: string
}

/** What the desktop shell forwards from an `openpencil://oauth/<provider>?…` link. */
const oauthCallbackSchema = v.object({ provider: v.string(), query: v.string() })

/** A redirect that resolves once, or as expired when the code's lifetime passes. */
function pendingRedirect() {
  const received = createDeferred<CallbackOutcome>()
  const timer = setTimeout(() => received.resolve({ kind: 'expired' }), OPENROUTER_CODE_LIFETIME_MS)
  return { received, stop: () => clearTimeout(timer) }
}

/**
 * A popup that returns to this origin, whose callback page relays the redirect query. The popup
 * opens before anything is awaited, or the browser blocks it.
 */
function popupCallback(state: string): Promise<SignInCallback | { failure: 'blocked' }> {
  const opened = window.open('', POPUP_NAME, POPUP_FEATURES)
  if (!opened) return Promise.resolve({ failure: 'blocked' })
  let popup = opened
  let navigated = false
  const { received, stop } = pendingRedirect()
  const channel = new BroadcastChannel(OPENROUTER_CALLBACK_CHANNEL)
  channel.addEventListener('message', (event: MessageEvent<unknown>) => {
    if (typeof event.data === 'string') received.resolve(callbackOutcome(event.data, state))
  })
  return Promise.resolve({
    open: (url) => {
      if (navigated) popup = window.open(url, POPUP_NAME, POPUP_FEATURES) ?? popup
      else popup.location.href = url
      navigated = true
    },
    wait: () => received.promise,
    close: () => {
      stop()
      channel.close()
      popup.close()
    }
  })
}

/**
 * The system browser, whose hosted callback page opens an `openpencil://oauth/openrouter` link;
 * the desktop shell forwards its query as an `oauth-callback` event.
 */
async function deepLinkCallback(state: string): Promise<SignInCallback> {
  const { listen } = await import('@tauri-apps/api/event')
  const { received, stop } = pendingRedirect()
  const unlisten = await listen<unknown>(OAUTH_CALLBACK_EVENT, (event) => {
    const callback = v.safeParse(oauthCallbackSchema, event.payload)
    if (callback.success && callback.output.provider === 'openrouter') {
      received.resolve(callbackOutcome(callback.output.query, state))
    }
  })
  return {
    open: openExternalLink,
    wait: () => received.promise,
    close: () => {
      stop()
      unlisten()
    }
  }
}

/** Signs in to OpenRouter with OAuth PKCE and returns a new API key for this app. */
export function signInWithOpenRouter({
  signal,
  keyLabel
}: OpenRouterSignInOptions): OpenRouterSignIn {
  const callbackURL = IS_TAURI
    ? new URL(OPENROUTER_DESKTOP_CALLBACK_PATH, WEB_APP_ORIGIN).href
    : new URL(OPENROUTER_CALLBACK_PATH, window.location.origin).href
  return startSignIn({
    signal,
    callback: IS_TAURI ? deepLinkCallback : popupCallback,
    authorizationURL: (pkce) => openRouterAuthorizationURL(callbackURL, pkce, keyLabel),
    exchange: (code, verifier) => exchangeOpenRouterCode(code, verifier)
  })
}
