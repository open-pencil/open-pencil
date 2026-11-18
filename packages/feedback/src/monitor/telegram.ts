import type { FeedbackServices } from '#feedback/env'
import { compact } from 'es-toolkit'

const TELEGRAM_API = 'https://api.telegram.org'
const REQUEST_TIMEOUT_MS = 10_000
/** Telegram allows far more; these keep a message readable whatever a check reports. */
const MAX_TITLE = 200
const MAX_BODY = 600
const MAX_VALUE = 200

export type AlertTone = 'critical' | 'warning' | 'recovered' | 'info'

/** One message to the monitoring channel. */
export interface Alert {
  tone: AlertTone
  /** Bold, after the tone's icon: what is wrong or what recovered. */
  title: string
  /** After the title: where, such as `Cloud production`. */
  context: string
  /** A monospace block under the first line, such as the error a check got. */
  body?: string
  /** A compact table of labelled values. */
  rows?: readonly (readonly [label: string, value: string])[]
  link?: { label: string; url: string }
}

const ICONS: Record<AlertTone, string> = {
  critical: '🔴',
  warning: '🟠',
  recovered: '🟢',
  info: '☁️'
}

function clip(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text
}

function escape(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function attribute(text: string): string {
  return escape(text).replaceAll('"', '&quot;')
}

/** The alert as a Telegram rich message: one plain first line, then the details. */
export function richAlert(alert: Alert): string {
  const parts = [
    `<p>${ICONS[alert.tone]} <b>${escape(clip(alert.title, MAX_TITLE))}</b> · ${escape(alert.context)}</p>`
  ]
  if (alert.body) parts.push(`<pre>${escape(clip(alert.body, MAX_BODY))}</pre>`)
  if (alert.rows?.length) {
    const rows = alert.rows.map(
      ([label, value]) =>
        `<tr><td>${escape(label)}</td><td><code>${escape(clip(value, MAX_VALUE))}</code></td></tr>`
    )
    parts.push(`<table compact>${rows.join('')}</table>`)
  }
  if (alert.link)
    parts.push(
      `<tg-button-row><tg-button type="url" style="primary" url="${attribute(alert.link.url)}">${escape(alert.link.label)}</tg-button></tg-button-row>`
    )
  return parts.join('')
}

/** The alert as plain text, for when Telegram refuses the rich message. */
export function plainAlert(alert: Alert): string {
  return compact([
    `${ICONS[alert.tone]} ${clip(alert.title, MAX_TITLE)} · ${alert.context}`,
    alert.body && clip(alert.body, MAX_BODY),
    ...(alert.rows ?? []).map(([label, value]) => `${label}: ${clip(value, MAX_VALUE)}`),
    alert.link?.url
  ]).join('\n')
}

/**
 * Posts alerts to one Telegram chat as rich messages, falling back to plain text if Telegram
 * refuses one, so an alert still arrives whatever the formatting does. Throws when neither posts.
 */
export function telegramChannel(fetcher: FeedbackServices['fetch'], token: string, chatId: string) {
  const call = (method: string, body: Record<string, unknown>) =>
    fetcher(`${TELEGRAM_API}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, ...body }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })

  return {
    async post(alert: Alert): Promise<void> {
      const rich = await call('sendRichMessage', {
        rich_message: { html: richAlert(alert), skip_entity_detection: true }
      })
      if (rich.ok) return
      console.error(`Telegram refused a rich alert (${rich.status}): ${await rich.text()}`)
      const plain = await call('sendMessage', {
        text: plainAlert(alert),
        link_preview_options: { is_disabled: true }
      })
      if (!plain.ok) throw new Error(`Telegram refused an alert (${plain.status})`)
    }
  }
}

export type TelegramChannel = ReturnType<typeof telegramChannel>
