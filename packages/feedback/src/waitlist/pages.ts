import { html } from 'hono/html'

/** A small standalone page for the links in waitlist emails, styled like the emails. */
export function page(title: string, body: string | ReturnType<typeof html>) {
  return html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
        <title>${title} · Lawha</title>
        <link rel="icon" href="https://github.com/aliaaldihnayn-lab/design#readme" />
        <style>
          :root {
            --page: #f5f5ef;
            --card: #ffffff;
            --edge: #e7e5dc;
            --ink: #171717;
            --text: #404040;
            --teal: #0a6c65;
            color-scheme: light dark;
            font-family:
              -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          }
          @media (prefers-color-scheme: dark) {
            :root {
              --page: #141414;
              --card: #1e1e1e;
              --edge: #2e2e2e;
              --ink: #f5f5f5;
              --text: #c8c8c8;
              --teal: #167c76;
            }
          }
          body {
            margin: 0;
            padding: 12vh 16px;
            background: var(--page);
          }
          main {
            max-width: 480px;
            margin: 0 auto;
            padding: 40px;
            box-sizing: border-box;
            background: var(--card);
            border: 1px solid var(--edge);
            border-radius: 16px;
          }
          img {
            display: block;
            border-radius: 10px;
            margin-bottom: 28px;
          }
          h1 {
            margin: 0 0 12px;
            color: var(--ink);
            font-size: 22px;
            font-weight: 600;
          }
          p {
            margin: 0 0 24px;
            color: var(--text);
            font-size: 15px;
            line-height: 1.6;
          }
          p:last-child {
            margin-bottom: 0;
          }
          button {
            font: inherit;
            font-size: 15px;
            font-weight: 600;
            padding: 12px 22px;
            border: 0;
            border-radius: 10px;
            background: var(--teal);
            color: #ffffff;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <main>
          <img
            src="https://github.com/aliaaldihnayn-lab/design#readme"
            width="44"
            height="44"
            alt="Lawha"
          />
          <h1>${title}</h1>
          ${typeof body === 'string' ? html`<p>${body}</p>` : body}
        </main>
      </body>
    </html>`
}

/**
 * Asks before acting: mail scanners open links in emails, so a GET only shows this button and the
 * POST it sends does the work.
 */
export function actionPage({
  title,
  message,
  action,
  token
}: {
  title: string
  message: string
  action: string
  token: string
}) {
  return page(
    title,
    html`<p>${message}</p>
      <form method="post">
        <input type="hidden" name="token" value="${token}" />
        <button type="submit">${action}</button>
      </form>`
  )
}
