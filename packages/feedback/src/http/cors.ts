import { cors } from 'hono/cors'

/**
 * Pages allowed to call the service: the web app, the website's waitlist form, the desktop app's
 * webview on macOS and Linux (`tauri://localhost`) and on Windows (`http://tauri.localhost`), and
 * the fixed local dev server, so a build with sending switched on can be tried before release.
 * This guards nothing secret: anyone can call these routes without a browser.
 */
export const ALLOWED_ORIGINS = [
  'https://app.openpencil.dev',
  'https://openpencil.dev',
  'tauri://localhost',
  'http://tauri.localhost',
  'http://localhost:1420'
]

export const allowOpenPencilOrigins = cors({
  origin: ALLOWED_ORIGINS,
  allowMethods: ['POST', 'PUT'],
  // `Authorization` carries a report's upload token.
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
})
