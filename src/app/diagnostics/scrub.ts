/** A pattern and what replaces each match, applied with `String.replace`. */
type ScrubRule = readonly [pattern: RegExp, replacement: string | ((match: string) => string)]

export const REDACTED = '[redacted]'

/** Queries, fragments, and inline credentials, which carry keys, tokens, and document names. */
const URL_RULES: ScrubRule[] = [
  [/\b((?:https?|tauri|file):\/\/[^\s?#'")]*)[?#][^\s'")]*/g, '$1'],
  // A query on a bare path or file name, such as `/Designs/app.fig?token=…`. It needs a
  // `name=` after the `?`, so optional chaining such as `a.b?.c` in a message stays.
  [/([^\s?'"(]*[/.][^\s?#'")]*)\?[\w.~%-]+=[^\s'")]*/g, '$1'],
  [/(\/\/)[^/\s:@]+:[^/\s@]+@/g, `$1${REDACTED}@`]
]

/** A path segment that reads as a key: very long, or long and mixing cases and digits. */
function looksLikeToken(segment: string): boolean {
  if (segment.length >= 40) return true
  return (
    segment.length >= 16 && /\d/.test(segment) && /[a-z]/.test(segment) && /[A-Z]/.test(segment)
  )
}

/** A long run is a key or encoded content, unless it is a path such as a stack frame's. */
function redactLongRun(run: string): string {
  if (!run.includes('/')) return REDACTED
  return run
    .split('/')
    .map((segment) => (looksLikeToken(segment) ? REDACTED : segment))
    .join('/')
}

/**
 * Credentials the shape rules below miss, after gitleaks (MIT, https://github.com/gitleaks/gitleaks):
 * AWS access key IDs are too short for the long-run rule, and a JWT's dots split it into runs
 * while its payload can name the user.
 */
const CREDENTIAL_RULES: ScrubRule[] = [
  [
    /-----BEGIN[ A-Z0-9_-]{0,100}PRIVATE KEY(?: BLOCK)?-----[\s\S]*?-----END[ A-Z0-9_-]{0,100}PRIVATE KEY(?: BLOCK)?-----/g,
    REDACTED
  ],
  [/\beyJ[\w-]{10,}\.eyJ[\w-]{10,}\.[\w-]{10,}/g, REDACTED],
  [/\b(?:A3T[A-Z0-9]|AKIA|ASIA|ABIA|ACCA)[A-Z2-7]{16}\b/g, REDACTED],
  // An `Authorization` header value in any scheme; a bearer token anywhere.
  [/(\bAuthorization["']?\s*[:=]\s*["']?(?:Basic|Bearer|Token)?\s*)[^\s"',]+/gi, `$1${REDACTED}`],
  [/\bBearer\s+(?!\[redacted\])\S+/gi, `Bearer ${REDACTED}`],
  // Assignments such as `api_key=…` or `password: …`. A bare `key` or `token` counts only
  // with `=`, since messages such as `Missing key: fills` name code, not secrets.
  [
    /\b((?:api[_-]?key|(?:access|refresh)[_-]?token|(?:client[_-]?)?secret|passw(?:or)?d)\s*[=:]\s*)["']?[^\s&,"']+["']?/gi,
    `$1${REDACTED}`
  ],
  [/\b((?:key|token)\s*=\s*)["']?[^\s&,"']+["']?/gi, `$1${REDACTED}`],
  // Prefixed keys such as `sk-ant-…`, `sk-proj-…`, `sk_live_…`, and `rk_live_…`.
  [/\b(?:sk|pk|rk|key|token|secret)[-_][\w-]{8,}/gi, REDACTED],
  [/[A-Za-z0-9+/_-]{40,}={0,2}/g, redactLongRun]
]

/**
 * Details that identify a person. A domain needs a letter TLD, so `vue@3.5.41` stays. A home
 * folder name may contain spaces when a path continues after it, as in `/Users/Jane Doe/app`.
 */
const PERSONAL_RULES: ScrubRule[] = [
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[A-Za-z]{2,}\b/g, REDACTED],
  [/(\/(?:Users|home)\/)[\w .-]{1,64}?(?=\/)/g, '$1~'],
  [/(\/(?:Users|home)\/)[^/\s]+/g, '$1~'],
  [/([A-Za-z]:\\Users\\)[\w .-]{1,64}?(?=\\)/g, '$1~'],
  [/([A-Za-z]:\\Users\\)[^\\\s]+/g, '$1~']
]

// URL rules run first, so that `user:pass@host` is not left half-redacted as an email.
const RULES: readonly ScrubRule[] = [...URL_RULES, ...CREDENTIAL_RULES, ...PERSONAL_RULES]

function applyRule(text: string, [pattern, replacement]: ScrubRule): string {
  return typeof replacement === 'string'
    ? text.replace(pattern, replacement)
    : text.replace(pattern, replacement)
}

/**
 * Remove what could unlock an account or identify a person from an error message or stack
 * before it is stored: URL queries and credentials, keys and tokens, emails, and the user's
 * name in home folder paths.
 */
export function scrubDiagnosticText(text: string): string {
  return RULES.reduce(applyRule, text)
}
