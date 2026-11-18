# @open-pencil/std

OpenPencil's own standard library, beside [es-toolkit](https://es-toolkit.dev): small helpers every OpenPencil package needs that es-toolkit doesn't have. It has no dependencies and runs in browsers, Node, Bun, and Cloudflare Workers.

| Import | What it has |
| --- | --- |
| `@open-pencil/std/timing` | Lengths of time (`SECOND_MS` to `DAY_MS`), deadline tiers (`DEADLINE_MS`), `withDeadline`, `untilAborted`, `anySignal`, `sleep`, and retry backoff (`BACKOFF`, `backoffDelay`). |
| `@open-pencil/std/random` | `randomHex`, `randomInt`, and `randomIndex`, from `crypto.getRandomValues`. |
| `@open-pencil/std/arrays` | `appendAll`, `insertAll`, `minOf`, and `maxOf`, which never spread an array into arguments, so large inputs don't overflow the stack. |
| `@open-pencil/std/json` | The `JSONValue`, `JSONObject`, `JSONArray`, and `JSONPrimitive` types. |
