# BYOK provider and model compatibility

OpenPencil has no backend. When you bring your own API key, the browser talks to the provider
directly — so a provider only works in the **web build** if it sets CORS headers correctly, and a
model is only useful for the AI chat panel if its **streaming tool calls** are well-formed.

Both of those vary a lot between providers, and neither is documented by the providers themselves.
This page records what has actually been measured.

**This is a living list — please add to it.** See [Contributing results](#contributing-results).

Results are dated because providers change behaviour without announcement. Treat anything older
than a few months as unverified.

---

## Provider CORS support

Whether the **web build** can reach the provider at all. The desktop build bypasses CORS entirely
(it routes through `tauriFetch`), so a ❌ here still works on desktop.

| Provider             | Base URL                                          | Browser | Notes                                                                                          | Tested     |
| -------------------- | ------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------- | ---------- |
| OpenRouter           | `https://openrouter.ai/api/v1`                    | ✅      | `ACAO: *`                                                                                      | 2026-07-30 |
| OpenAI               | `https://api.openai.com/v1`                       | ✅      | `ACAO: *`                                                                                      | 2026-07-30 |
| Groq                 | `https://api.groq.com/openai/v1`                  | ✅      | `ACAO: *`                                                                                      | 2026-07-30 |
| Google               | `https://generativelanguage.googleapis.com`       | ✅      | echoes origin                                                                                  | 2026-07-30 |
| DeepSeek             | `https://api.deepseek.com`                        | ✅      | echoes origin                                                                                  | 2026-07-30 |
| Z.ai                 | `https://api.z.ai/api/anthropic`                  | ✅      | echoes origin                                                                                  | 2026-07-30 |
| MiniMax              | `https://api.minimax.io/v1`                       | ✅      | echoes origin                                                                                  | 2026-07-30 |
| Nebius AI Studio     | `https://api.studio.nebius.com/v1`                | ✅      | `ACAO: *`                                                                                      | 2026-07-30 |
| Nebius Token Factory | `https://api.tokenfactory.<region>.nebius.com/v1` | ✅      | `ACAO: *`; catalog differs per region                                                          | 2026-07-30 |
| Anthropic            | `https://api.anthropic.com`                       | ✅      | Requires `anthropic-dangerous-direct-browser-access: true`; OpenPencil sends it in the web app | 2026-07-30 |
| Scaleway             | `https://api.scaleway.ai/<project-id>/v1`         | ⚠️      | `ACAO: *` on success, **absent on errors** — a bad key reads as a network failure              | 2026-07-31 |
| TensorX              | `https://api.tensorx.ai/v1`                       | ⚠️      | `ACAO: *` on success, **absent on errors** (401/403/500). Reported to their support            | 2026-07-31 |

### The common failure

A provider that answers the `OPTIONS` preflight correctly but omits `Access-Control-Allow-Origin`
on the **actual response** will fail in the browser with a generic `Failed to fetch`. OpenPencil
surfaces that as _"Could not reach this endpoint from the browser"_ — which is indistinguishable
from a wrong API key. **Always verify with curl before assuming the app is at fault.**

### Test the success path, not just an error

Several providers (Scaleway, TensorX) send CORS headers on a `200` but **not** on `401`/`403`/`500`
— errors are rejected at a gateway that never adds the header. So an unauthenticated probe tells
you nothing: it looks identical to a provider that is genuinely broken.

Always test with a **valid key and a successful response**. Do not infer success-path CORS from
an error response: providers can route successful and failed requests through different middleware.
Record error-response CORS separately so users know whether an expired key, exhausted quota, or bad
model name will surface as a useful API error or an opaque network failure.

---

## Model tool-calling quality

The AI chat panel is an agent loop, so a model is only usable if it reliably emits **streaming**
tool calls that the AI SDK can parse. Two independent things go wrong:

- **`id` correctness** — if a streamed `tool_calls` delta introduces a new index without an `id`,
  `@ai-sdk/openai` throws `Expected 'id' to be a string.` and the stream dies.
- **Argument validity** — arguments are streamed in fragments and concatenated. If the fragments
  are misrouted, the result isn't valid JSON and the tool silently never fires.

Cost matters as much as correctness here. The chat panel is an agent loop that runs up to
`MAX_AGENT_STEPS` (50) and resends the tool schemas on every step, so it is input-token heavy and
a high per-token price compounds fast.

Vision is measured by sending a solid-colour image and asking the model to name it. Tool-call and
vision results are measurements; context limits and prices are catalog metadata, identified below
with their source dates.

**Record the output-token budget with every result** — it changes the outcome. Scaleway rows below
were measured at `max_tokens: 16384`; Nebius and TensorX rows at 2000, so their "emits calls"
figures are not directly comparable and any failure there may be starvation rather than incapacity.

Most results below used provider-default reasoning settings. The separate reasoning comparison
explicitly identifies each override it tested. Future rows must record any non-default
`reasoning_effort` or `chat_template_kwargs.enable_thinking` value.

The `Tools` cells use `prompts, bad ID deltas, valid arguments`: for example,
`3/3 prompts · 0/238 bad IDs · 6/6 valid args`. A prompt passes when it emits at least one tool
call; ID counts cover inspected streamed tool-call deltas; argument counts cover completed calls
whose concatenated argument fragments parse as JSON.

| Model                                 | Provider | /1M in–out     | Ctx¹ | Tools                                                       | Vision | Verdict                                                                                               | Tested     |
| ------------------------------------- | -------- | -------------- | ---- | ----------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------- | ---------- |
| `mistral-small-3.2-24b-instruct-2506` | Scaleway | €0.15 – €0.35  | 128k | ✅ 3/3 prompts · 0/238 bad IDs · 6/6 valid args             | ✅     | **Recommended** — cheapest with vision, fully clean                                                   | 2026-07-31 |
| `gemma-4-26b-a4b-it`                  | Scaleway | €0.25 – €0.50  | 256k | ✅ 3/3 prompts · 0/77 bad IDs · 8/8 valid args              | ✅     | Same but 2× the context — pick this for large documents                                               | 2026-07-31 |
| `gpt-oss-120b`                        | Scaleway | €0.15 – €0.60  | 128k | ✅ 3/3 prompts · 0/118 bad IDs · 3/3 valid args             | ❌     | Cheap and clean, but text-only                                                                        | 2026-07-31 |
| `qwen3.6-35b-a3b`                     | Scaleway | €0.25 – €1.50  | 128k | ✅ 3/3 prompts · 0/106 bad IDs · 9/9 valid args             | ✅     | Clean; heavy reasoner, needs the larger budget                                                        | 2026-07-31 |
| `qwen3.5-397b-a17b`                   | Scaleway | €0.60 – €3.60  | 256k | ✅ 3/3 prompts · 0/92 bad IDs · 10/10 valid args            | ✅     | Most calls per turn; strongest but priciest here                                                      | 2026-07-31 |
| `mistral-medium-3.5-128b`             | Scaleway | €1.50 – €7.50  | 256k | — not tested                                                | ✅     | Vision confirmed; tool calling unverified                                                             | 2026-07-31 |
| `glm-5.2`                             | Scaleway | €1.80 – €5.50  | 256k | — not tested                                                | ❌     | API rejects images: "not a multimodal model"                                                          | 2026-07-31 |
| `moonshotai/Kimi-K2.7-Code`           | Nebius   | $0.95 – $4.00  | 262k | ✅ 3/3 prompts · 0/114 bad IDs · 4/4 valid args²            | ❌     | Clean, but pricier than the Scaleway set                                                              | 2026-07-30 |
| `moonshotai/Kimi-K3`                  | Nebius   | $3.00 – $15.00 | 1M   | ✅ 3/3 prompts · ID coverage unavailable³ · 8/8 valid args² | ❌     | Flawless, but ~20× the cost of `gpt-oss-120b`                                                         | 2026-07-30 |
| `moonshotai/kimi-k3`                  | TensorX  | —              | —    | ⚠️ 2/3 prompts · ID coverage unavailable³ · 7/7 valid args² | —      | One prompt did not emit a call                                                                        | 2026-07-30 |
| `openai/gpt-oss-120b`                 | Nebius   | $0.15 – $0.60  | 128k | ❌ final argument chunk routed to the wrong index²          | ❌     | Broken on Nebius only — same model is fine on Scaleway                                                | 2026-07-30 |
| `moonshotai/Kimi-K2.6`                | Nebius   | —              | —    | ⚠️ 1/3 prompts²                                             | —      | Finished on `stop`, not `length` — likely a real failure, but re-test at 16k before trusting this row | 2026-07-30 |

¹ Nominal catalog context limit from models.dev, retrieved 2026-07-31; not measured here.  
² Measured with `max_tokens: 2000`; re-test failures at 16384 or the highest supported budget.  
³ The original notes did not preserve the inspected ID-delta count, so ID coverage is unavailable.

### Auto-lookup via models.dev

[models.dev](https://models.dev) publishes a machine-readable catalog at
<https://models.dev/api.json> (~3 MB, 176 providers, including `scaleway`, `nebius`, `groq` and
`openrouter`). Each model carries `tool_call`, `attachment` (vision), `reasoning`,
`cost.input`/`cost.output`, `limit.context` and `modalities`.

```bash
curl -s https://models.dev/api.json \
  | jq '.scaleway.models["gemma-4-26b-a4b-it"] | {tool_call, attachment, reasoning, cost, limit}'
```

**Use it to prefill a row, not to fill in the measured columns.** Checked against the models above,
it was wrong on two of seven:

| Model                              | models.dev   | Measured                                           |
| ---------------------------------- | ------------ | -------------------------------------------------- |
| `scaleway/gpt-oss-120b`            | vision true  | Refuses: "I don't have the ability to view images" |
| `scaleway/mistral-small-3.2-24b-…` | vision false | Correctly names the colour in an image             |

It also lists `nebius/openai/gpt-oss-120b` as vision `false` while marking the Scaleway copy
`true` — the same model, contradicting itself — and reports `tool_call: true` for every model
here, including `qwen3.6-35b-a3b` (silent on 2/3 prompts at `max_tokens: 2000`, but 3/3 at 16384) and Nebius's `gpt-oss-120b` (broken by the deployment bug below).

That's the general shape of it: models.dev describes a model's **nominal** capabilities, while
what breaks in practice is a property of the **deployment**. Catalog prices and context windows
can prefill a row, but must be labeled as metadata with a source and retrieval date; tool-calling
and vision require live tests.

Prices shown in the table were transcribed from public pricing aggregators on 2026-07-31 rather
than measured or verified against provider invoices. Because the original notes did not preserve
per-row source URLs, treat every price as unverified historical metadata and confirm it against the
provider's current pricing page before making a decision. New rows must include a source URL and a
separate price-as-of date.

The same model can behave differently on different providers — `gpt-oss-120b` is broken on Nebius
and clean on Scaleway. **Record the provider alongside the model; a model row without one is not
reproducible.**

Note that "emits calls" counts prompts that produced at least one tool call, not how many. Models
differ in style: `qwen3.5-397b-a17b` issued 3–4 parallel calls per turn where `gpt-oss-120b` issued
one. In a 50-step agent loop, one-call-then-observe is legitimate rather than weaker, so don't read
the count as a quality ranking.

### Known issue: vLLM misroutes the final argument chunk

On some vLLM deployments the closing `}` of a tool call's arguments is emitted under `index + 1`
with no `id`:

```
 1  [{"index":0,"id":"chatcmpl-tool-…","function":{"arguments":"","name":"create_node"},"type":"function"}]
 …  deltas 2–11 stream the arguments, all index 0
12  [{"index":1,"function":{"arguments":"}"}}]      ← wrong index, no id
```

This both crashes the stream _and_ leaves call 0's arguments unterminated. Do not blindly attach
an argument-only delta to the most recently opened call: concurrent or interleaved calls make that
ambiguous and can corrupt another call. A client-side workaround may reattach the fragment only
when exactly one serialized call is open; it must reject ambiguous streams. Synthesizing a missing
`id` alone converts a visible crash into a silent no-op.

Models that emit one complete tool call per chunk (Kimi-K3 on every provider tested) cannot hit
this bug at all.

**This is a deployment bug, not a model bug.** `gpt-oss-120b` misroutes on Nebius but streams
cleanly on Scaleway — 0 violations across 135 deltas. Before writing a client-side workaround,
check whether another provider serving the same model is unaffected.

### Known issue: reasoning models starve on a small output budget

A reasoning model can spend its **entire** output budget thinking and never emit a tool call. The
result is `finish_reason: length` with zero tool calls — no error, no partial output. From the
outside it is indistinguishable from a model that simply can't call tools.

Measured on `qwen3.6-35b-a3b`, same prompts, only `max_tokens` changed:

| `max_tokens` | Result                                          |
| ------------ | ----------------------------------------------- |
| 2000         | 1/3 prompts — the rest hit `length` mid-thought |
| 16384        | 3/3 prompts, 0 bad ids, 9/9 valid args          |

One prompt needed 10,417 characters of reasoning before its first tool call. **This page originally
scored two models as broken purely because the probe used 2000 tokens.** If a model produces no tool
calls, check `finish_reason` before concluding anything — `length` means starved, `stop` means it
genuinely declined.

`reasoning_effort` is the other lever, though supported values are provider-specific:

| Setting                                              | Reasoning | Tool calls |
| ---------------------------------------------------- | --------- | ---------- |
| default                                              | 6,583 ch  | ❌ 0       |
| `"reasoning_effort": "none"`                         | 0 ch      | ✅ 3       |
| `"reasoning_effort": "low"`                          | 5,088 ch  | ✅ 3       |
| `"chat_template_kwargs": {"enable_thinking": false}` | 5,133 ch  | ✅ 3       |

Only `"none"` actually eliminated reasoning on Scaleway; `"low"` had no measurable effect.
OpenPencil cannot send this today — see
[#454](https://github.com/open-pencil/open-pencil/issues/454).

### Known issue: reasoning models and the connection test

Some models (e.g. Kimi-K2.6) spend output tokens on `reasoning` before `content`. The connection
test uses `maxOutputTokens: 1`, so `content` comes back `null`. The test still passes because it
only checks that the request didn't throw — but don't tighten it to assert on returned text, or
reasoning models will fail it spuriously.

---

## Contributing results

Add a row, keep it dated, and say how you tested. Negative results are as useful as positive ones.

### 1. Test CORS for an OpenAI-compatible endpoint

The following recipes use the OpenAI-compatible `/chat/completions` contract, Bearer
authentication, and request body. Do not use them unchanged for a provider's native API: adapt the
endpoint, authentication, version headers, and body first. For example, Anthropic's native API uses
`/v1/messages`, `x-api-key`, `anthropic-version`, and
`anthropic-dangerous-direct-browser-access: true`.

Run these checks from a Bash-compatible shell. Curl is not subject to CORS, so this inspects the headers a browser
would enforce. A provider must pass both checks: the preflight must allow the origin, `POST` method,
and requested headers, and a successful POST must include `Access-Control-Allow-Origin`.

Read the key without placing it in shell history or the curl process arguments. The temporary curl
configuration is owner-readable only and is removed on exit.

```bash
set -euo pipefail
BASE="https://api.example.com/v1"
MODEL="MODEL"
ORIGIN="https://openpencil.dev"
read -rsp "API key: " API_KEY; printf '\n'
CURL_CONFIG="$(mktemp)"
PREFLIGHT_HEADERS="$(mktemp)"
POST_HEADERS="$(mktemp)"
chmod 600 "$CURL_CONFIG"
trap 'rm -f "$CURL_CONFIG" "$PREFLIGHT_HEADERS" "$POST_HEADERS"' EXIT
printf 'header = "Authorization: Bearer %s"\n' "$API_KEY" > "$CURL_CONFIG"
unset API_KEY

origin_allowed() {
  local file="$1"
  local value
  value="$(awk 'BEGIN { IGNORECASE=1 } /^access-control-allow-origin:/ { sub(/^[^:]+:[[:space:]]*/, ""); sub(/\r$/, ""); print; exit }' "$file")"
  [[ "$value" == "*" || "$value" == "$ORIGIN" ]]
}

# Browser preflight: verify the origin, POST method, and both requested headers.
preflight_status="$(curl -sS -D "$PREFLIGHT_HEADERS" -o /dev/null -w '%{http_code}' \
  -X OPTIONS "$BASE/chat/completions" \
  -H "Origin: $ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type")"
[[ "$preflight_status" =~ ^2[0-9][0-9]$ ]]
origin_allowed "$PREFLIGHT_HEADERS"
grep -iqE '^access-control-allow-methods:.*(^|[,[:space:]])POST([,[:space:]]|$)' "$PREFLIGHT_HEADERS"
grep -iqE '^access-control-allow-headers:.*(^|[,[:space:]])authorization([,[:space:]]|$)' "$PREFLIGHT_HEADERS"
grep -iqE '^access-control-allow-headers:.*(^|[,[:space:]])content-type([,[:space:]]|$)' "$PREFLIGHT_HEADERS"

# Successful response: use a valid key and model, then verify the origin header again.
post_status="$(curl --config "$CURL_CONFIG" -sS -D "$POST_HEADERS" -o /dev/null -w '%{http_code}' \
  -X POST "$BASE/chat/completions" \
  -H "Origin: $ORIGIN" \
  -H "content-type: application/json" \
  -d "{\"model\":\"$MODEL\",\"max_tokens\":5,\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}]}")"
[[ "$post_status" =~ ^2[0-9][0-9]$ ]]
origin_allowed "$POST_HEADERS"
```

These commands exit non-zero unless both responses satisfy the browser contract.

Also repeat the POST with an invalid key and record error-response CORS separately. It does not
prove whether successful requests work, but it determines whether users see useful authentication
errors or only an opaque network failure.

### 2. Test tool-call streaming

Ask the model to make several tool calls and save the raw SSE stream. Use at least 16384 output
tokens when supported; if the endpoint accepts less, record its highest supported budget.

```bash
STREAM_FILE="$(mktemp)"
HTTP_STATUS_FILE="$(mktemp)"
trap 'rm -f "$CURL_CONFIG" "$PREFLIGHT_HEADERS" "$POST_HEADERS" "$STREAM_FILE" "$HTTP_STATUS_FILE"' EXIT

curl --config "$CURL_CONFIG" -sS -N -X POST "$BASE/chat/completions" \
  -H "content-type: application/json" \
  -d "{\"model\":\"$MODEL\",\"stream\":true,\"max_tokens\":16384,
       \"messages\":[{\"role\":\"user\",\"content\":\"Draw a frog: green ellipse body, two white eye circles, a mouth line. Use create_node for each.\"}],
       \"tools\":[{\"type\":\"function\",\"function\":{\"name\":\"create_node\",\"description\":\"Create a node on the canvas\",
         \"parameters\":{\"type\":\"object\",\"properties\":{\"type\":{\"type\":\"string\",\"enum\":[\"ELLIPSE\",\"RECTANGLE\",\"LINE\",\"TEXT\"]},
         \"x\":{\"type\":\"number\"},\"y\":{\"type\":\"number\"},\"width\":{\"type\":\"number\"},\"height\":{\"type\":\"number\"},
         \"fill\":{\"type\":\"string\"}},\"required\":[\"type\",\"x\",\"y\"]}}}]}" \
  -o "$STREAM_FILE" -w '%{http_code}' > "$HTTP_STATUS_FILE"
[[ "$(cat "$HTTP_STATUS_FILE")" =~ ^2[0-9][0-9]$ ]]
```

Parse each SSE event as JSON, group fragments by tool-call index, require an ID on the first delta
for each index, and validate the concatenated arguments:

```bash
STREAM_FILE="$STREAM_FILE" node <<'JS'
const fs = require('node:fs')
const calls = new Map()
const finishReasons = new Set()
let malformedFirstDeltas = 0

for (const line of fs.readFileSync(process.env.STREAM_FILE, 'utf8').split(/\r?\n/)) {
  if (!line.startsWith('data:')) continue
  const data = line.slice(5).trim()
  if (!data || data === '[DONE]') continue
  const event = JSON.parse(data)
  const choice = event.choices?.[0]
  if (choice?.finish_reason) finishReasons.add(choice.finish_reason)
  for (const call of choice?.delta?.tool_calls ?? []) {
    const current = calls.get(call.index)
    if (!current) {
      if (typeof call.id !== 'string' || !call.id) malformedFirstDeltas++
      calls.set(call.index, { id: call.id, arguments: call.function?.arguments ?? '' })
    } else {
      current.arguments += call.function?.arguments ?? ''
    }
  }
}

let invalidArguments = 0
for (const [index, call] of calls) {
  try {
    JSON.parse(call.arguments)
  } catch {
    invalidArguments++
    console.error(`tool call ${index}: invalid arguments`)
  }
}
console.log({
  calls: calls.size,
  finishReasons: [...finishReasons],
  malformedFirstDeltas,
  invalidArguments
})
if (!calls.size) {
  console.error(
    finishReasons.has('length')
      ? 'no tool calls: output budget exhausted; retry with a larger budget'
      : 'no tool calls: model finished without calling a tool'
  )
  process.exitCode = 1
}
if (malformedFirstDeltas || invalidArguments) process.exitCode = 1
JS
```

Use more than one prompt. Failures are often intermittent and can depend on where JSON lands on a
chunk boundary. Also record `finish_reason`; a `length` result requires a larger-budget retest
before it can be classified as a tool-calling failure.

### 3. Add your row

Include the compatibility test date, exact model ID, base URL pattern or regional hostname,
output-token budget, reasoning configuration, and a one-line verdict. If something is broken, say
what the failure looks like from the user's side — that's what makes the row actionable.

Include the provider's list price, its source URL, and a separate price-as-of date. A model that
streams flawlessly but costs 25× the alternative is not the right default for an agent loop, and a
table without price provenance goes stale silently.

**Record the `max_tokens` you used.** A reasoning model starved of output budget produces no tool
calls and looks broken. Two models on this page were wrongly marked "avoid" for exactly that
reason. Use at least 16384 when supported, and check `finish_reason` before recording a failure.

### A note on regional catalogs

Some providers serve different models per region behind different hostnames. Nebius Token Factory,
for example, carries Kimi-K3 on `eu-west2` but not on `us-central1`. Always record the exact base
URL you tested — "provider X doesn't have model Y" is only true for the endpoint you checked.

---

## Security note

In the browser, credentials default to encrypted IndexedDB persistence so users do not have to
re-enter them; Settings also offers session-only storage, which keeps secrets in memory until the
tab closes. The desktop build uses the OS credential store. Browser scripts running on the origin
can still use a credential in place, so prefer scoped keys with spend caps where the provider
offers them.
