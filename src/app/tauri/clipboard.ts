import { readText, writeHtml, writeText } from '@tauri-apps/plugin-clipboard-manager'

import { isTauri } from '@/app/tauri/env'

export async function writeTauriClipboardHtml(html: string, plainText: string) {
  if (!isTauri()) return false
  await writeHtml(html, plainText)
  return true
}

export async function writeTauriClipboardText(text: string) {
  if (!isTauri()) return false
  await writeText(text)
  return true
}

export async function readTauriClipboardText() {
  if (!isTauri()) return null
  return readText()
}
