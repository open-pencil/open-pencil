import { cors } from 'hono/cors'

/**
 * Pages allowed to call the service: the web app, the website's waitlist form, the desktop app's
 * webview on macOS and Linux (`tauri://localhost`) and on Windows (`http://tauri.localhost`), and
 * the fixed local dev server, so a build with sending switched on can be tried before release.
 * This guards nothing secret: anyone can call these routes without a browser.
 */
export const ALLOWED_ORIGINS = [
  'https://app.lawha.invalid',
  'https://github.com/aliaaldihnayn-lab/design#readme',
  'tauri://localhost',
  'http://tauri.localhost',
  'http://localhost:1420'
]

export const allowLawhaOrigins = cors({
  origin: ALLOWED_ORIGINS,
  allowMethods: ['POST'],
  allowHeaders: ['Content-Type'],
  maxAge: 86400
})
