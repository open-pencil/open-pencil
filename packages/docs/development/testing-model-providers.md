---
title: Testing a Model Provider
description: How to check whether a provider works from the browser and streams tool calls the AI chat can use, and the failures to look for.
---

# Testing a Model Provider

The AI chat talks to the provider straight from the app, with no OpenPencil server in between. A provider works in the **web app** only if it sends CORS headers, and a model is only useful to the chat if it streams **tool calls** the AI SDK can parse. Providers document neither, and both change without notice, so test the deployment you care about rather than trusting a catalog or an old result. What users need to know is in [Models and Providers](/user-guide/models-and-providers).

## Browser access

The desktop app fetches through the native shell and is not subject to CORS; only the web app is.

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

### Test CORS for an OpenAI-compatible endpoint

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

## Tool calling

The chat is an agent loop, so a model is only usable if it reliably emits **streaming** tool calls. Two independent things go wrong:

- **`id` correctness** — if a streamed `tool_calls` delta introduces a new index without an `id`,
  `@ai-sdk/openai` throws `Expected 'id' to be a string.` and the stream dies.
- **Argument validity** — arguments are streamed in fragments and concatenated. If the fragments
  are misrouted, the result isn't valid JSON and the tool silently never fires.

Test with a generous output budget (at least 16384 tokens where supported) and record it with the result, along with any non-default reasoning setting. Check vision separately, by sending a solid-colour image and asking the model to name it.

### Test tool-call streaming

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

One prompt needed 10,417 characters of reasoning before its first tool call. If a model produces no tool
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

## Reporting results

Open an issue with the date, the exact model ID, the base URL or regional hostname, the output-token budget, the reasoning settings, `finish_reason`, and what the failure looks like to the user. Negative results are as useful as positive ones. Record the provider with the model: the same model can stream cleanly on one deployment and break on another.

### A note on regional catalogs

Some providers serve different models per region behind different hostnames. Nebius Token Factory,
for example, carries Kimi-K3 on `eu-west2` but not on `us-central1`. Always record the exact base
URL you tested — "provider X doesn't have model Y" is only true for the endpoint you checked.

### Catalog metadata is not a measurement

[models.dev](https://models.dev) publishes a machine-readable catalog at
<https://models.dev/api.json>, where each model carries `tool_call`, `attachment` (vision),
`reasoning`, prices, and context limits. It describes a model's **nominal** capabilities, while
what breaks in practice is a property of the **deployment**. When this was checked in July 2026 it
listed vision for a model that refused images and missed it for one that read them, gave the same
model different vision flags on two providers, and claimed tool calling for every model, including
one whose deployment broke tool calls. Use it to find candidates; test tool calling and vision live.
