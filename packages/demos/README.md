# @open-pencil/demos

Scripted demo recording for OpenPencil using [webreel](https://github.com/vercel-labs/webreel) (fork: [@sld0ant/webreel-fork](https://www.npmjs.com/package/@sld0ant/webreel-fork)).

## Prerequisites

- Dev server running at `http://localhost:1420` — start with `bun run dev` or `bun run tauri dev`
- Chrome and ffmpeg are auto-downloaded to `~/.webreel` on first run (~500MB one-time)

## Usage

```bash
# List available demos
bun run demo:list

# Record all demos
bun run demo

# Record a specific demo
bun run demo --scenario toolbar

# Preview in visible browser (no recording, like playwright --headed)
bun run demo:preview
bun run demo:preview --scenario toolbar

# Pass flags through to webreel
bun run demo --verbose
bun run demo --watch
```

## Adding a new demo

Edit `webreel.config.json` and add a video entry to the `videos` object:

```json
{
  "videos": {
    "my-demo": {
      "url": "/",
      "waitFor": "[data-test-id=\"some-element\"]",
      "steps": [
        { "action": "pause", "ms": 500 },
        { "action": "click", "selector": "[data-test-id=\"button\"]" }
      ]
    }
  }
}
```

Use `data-test-id` selectors for stability. See the [webreel docs](https://webreel.dev) for all available actions.

## Output formats

- **WebM** (project default) — `"output": "my-demo.webm"`
- **MP4** — `"output": "my-demo.mp4"`
- **GIF** — `"output": "my-demo.gif"`

Videos are written to `videos/` and excluded from git.
