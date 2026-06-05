# Image vectorization APIs (Recraft + fal)

References:

- Recraft: https://www.recraft.ai/docs/api-reference/endpoints#vectorize-image
- Recraft Studio (product UX): https://www.recraft.ai/docs/recraft-studio/format-conversions-and-scaling/vectorizing.md
- fal (same engine): https://fal.ai/models/fal-ai/recraft/vectorize/api

## What the API does

**Raster → SVG**, not “generate a new image”. You upload a PNG/JPG/WEBP; the service returns an **SVG file URL** (`image.url` / `image` object with `content_type: image/svg+xml`).

### Recraft direct

```
POST https://external.api.recraft.ai/v1/images/vectorize
Authorization: Bearer <token>
Content-Type: multipart/form-data
  file: <image bytes>
```

Optional form fields (documented on endpoints page):

| Field | Values | Purpose |
|-------|--------|---------|
| `response_format` | `url` (default), `b64_json` | How the SVG is returned |
| `svg_compression` | `on` / `off` (default off) | Smaller SVG payload |
| `limit_num_shapes` | `on` / `off` (default off) | Cap shape count |
| `max_num_shapes` | integer | Max paths when limiting |

**Input limits** (API enforces; our `preprocessForVectorize` mirrors these):

- Max **5 MB** file size
- Max **16 MP** resolution
- Max dimension **4096 px**
- Min dimension **256 px** (short side)

**Pricing:** $0.01 / 10 API units per vectorization (Recraft pricing doc).

### fal

Same Recraft vectorize model via `fal-ai/recraft/vectorize`:

- Input: `image_url` (HTTPS URL or data URI)
- Output: `{ image: { url, content_type: "image/svg+xml", ... } }`

## SVG output shape (critical for import)

Live sample (`euro_shield` 577×721 PNG) returns SVG like:

```xml
<svg viewBox="0 0 1639 2048" width="577" height="721" preserveAspectRatio="none">
  <path transform="translate(0,0)" fill="rgb(...)" d="M 816.274 0 ..."/>
  <!-- one <path> per detected shape (~14 for this image) -->
</svg>
```

Implications for OpenPencil:

1. **Path coordinates live in `viewBox` user space** (here 1639×2048), not in `width`/`height` pixels.
2. **`width` / `height` attributes** are the **display size** matching the input image aspect; map viewBox → node bounds for 1:1 placement.
3. **`preserveAspectRatio="none"`** — non-uniform scale is intentional when viewBox aspect ≠ output size.
4. **Multiple `<path>` elements** — one VECTOR child per path; each needs **tight node bounds** (not full image width/height).
5. **`transform` on paths** — often `translate(0,0)`; non-identity transforms must be applied to path `d` before import.

Studio-only features (color reduction slider, swatches) are **not** on the vectorize API we call; simplifying output may require `limit_num_shapes` / `max_num_shapes` API params instead.

## OpenPencil pipeline

1. `preprocessForVectorize` — upscale short side to ≥256, cap 4096 / 16MP / 5MB
2. `recraftVectorize` / `falVectorize` — fetch SVG text
3. `svgToVectorPaths` — parse paths, map **viewBox** → target bounds (scale vertices **and** segment tangents), union content bounds
4. `placement.ts` — per-path `computeAccurateBounds`, normalize to local coords
5. Replace image node with FRAME + VECTOR children (one undo step)