# OpenPencil Next: Browser-Native Design Tool

## Vision

A design tool where every element is real HTML/CSS rendered by a real browser engine.
Not a Figma clone. Not a browser wrapper. A new kind of application built from
WebKit's rendering primitives.

## Core Concept: Islands

An **island** is an independent rendering context — its own DOM, styles, layout,
and paint output. Components within an island share CSS context, compose via
Shadow DOM, and have real parent-child relationships. Components on the infinite
canvas that aren't composed together live in separate islands.

```
Infinite canvas
│
├── Island A ─ one Document, one render surface
│   └── <nav-bar>
│       ├── <logo>
│       └── <auth-button>
│
├── Island B ─ separate Document, separate surface
│   └── <hero-section>
│       ├── <heading>
│       └── <cta-button>
│
├── Island C ─ standalone component
│   └── <auth-button>     (same component class, isolated context)
│
├── Island D ─ full page composition
│   └── <app-shell>
│       ├── <nav-bar>     (shares CSS with siblings here)
│       ├── <hero-section>
│       └── <footer>
```

Drag a component OUT of an island → new island created (new rendering context).
Drag a component INTO an island → island destroyed, node joins target DOM.
The component definition (Web Component class + styles) is the same — only
the rendering context changes.

## WebKit Building Blocks

### What exists in Source/

| Component | Location | Role |
|-----------|----------|------|
| `WebCore::Page` | `Source/WebCore/page/Page.h` | A rendering context: DOM + CSS + layout + paint. **One per island.** |
| `WebCore::Document` | `Source/WebCore/dom/Document.h` | The DOM tree within a Page. |
| `WebCore::ShadowRoot` | `Source/WebCore/dom/ShadowRoot.h` | Shadow DOM for component style isolation. |
| `CustomElementRegistry` | `Source/WebCore/dom/CustomElementRegistry.h` | Web Component registration. |
| `TextureMapper` | `Source/WebCore/platform/graphics/texmap/TextureMapper.h` | GPU compositor. Draws textures with transforms. |
| `TextureMapperLayer` | `Source/WebCore/platform/graphics/texmap/TextureMapperLayer.h` | A compositing layer with position, size, transform, opacity, filters, children. |
| `CoordinatedPlatformLayer` | `Source/WebCore/platform/graphics/texmap/coordinated/` | Coordinated layer management between main thread and compositor thread. |
| `BitmapTexture` | `Source/WebCore/platform/graphics/texmap/BitmapTexture.h` | A GPU texture that TextureMapper can draw. |
| `LayerTreeHost` | `Source/WebKit/WebProcess/WebPage/CoordinatedGraphics/LayerTreeHost.h` | Orchestrates the compositor. Creates GraphicsLayers, manages the scene. |
| `ThreadedCompositor` | `Source/WebKit/WebProcess/WebPage/CoordinatedGraphics/ThreadedCompositor.h` | Runs compositing on a dedicated thread with its own GL context. |
| `PageOverlay` | `Source/WebCore/page/PageOverlay.h` | Drawable layer on top of a Page with mouse event interception. Two modes: View (fixed) and Document (scrolls). |
| `PageOverlayController` | `Source/WebCore/page/PageOverlayController.h` | Manages overlays. Handles repaint, mouse events, scale changes. |
| `InspectorOverlay` | `Source/WebCore/inspector/InspectorOverlay.h` | Draws selection rects, margin/padding guides, grid overlays — exactly like our meta-layer needs. |
| `WPE Platform` | `Source/WebKit/WPEPlatform/` | Headless rendering abstraction. Display, View, Buffer, Toplevel. No window system needed. |
| `WPEViewHeadless` | `Source/WebKit/WPEPlatform/wpe/headless/` | Renders to GPU buffers at 60fps without a display server. |
| `AcceleratedBackingStore` | `Source/WebKit/UIProcess/wpe/AcceleratedBackingStore.h` | Gets DMA-BUF / SHM buffers from WebKit's renderer. Manages buffer lifecycle. |
| `Skia` | `Source/ThirdParty/skia/` | WPE WebKit already uses Skia for painting (2024+). Same Skia we know. |
| `JavaScriptCore` | `Source/JavaScriptCore/` | JS engine. Each Page gets its own JS global object. |

### How they connect

```
                                    ┌──────────────────────┐
                                    │   Our Application    │
                                    │                      │
                                    │  ┌────────────────┐  │
                                    │  │  Island Manager │  │
                                    │  └───┬────────────┘  │
                                    │      │               │
              ┌────────────────────────────┼───────────────────────────────┐
              │                    │      │               │               │
         Island A              Island B   │          Island C        Meta-layer
              │                    │      │               │               │
    ┌─────────┴──────┐   ┌────────┴───┐  │     ┌─────────┴──────┐  ┌────┴──────┐
    │ WebCore::Page  │   │ WebCore::  │  │     │ WebCore::Page  │  │ PageOverlay│
    │ + Document     │   │ Page       │  │     │ + Document     │  │ on master  │
    │ + ShadowRoots  │   │ + Document │  │     │ + ShadowRoots  │  │ Page       │
    │ + Layout       │   │ + Layout   │  │     │ + Layout       │  └────┬──────┘
    │ + Paint→Skia   │   │ + Paint    │  │     │ + Paint→Skia   │       │
    └───────┬────────┘   └──────┬─────┘  │     └───────┬────────┘       │
            │                   │        │             │                │
            ▼                   ▼        │             ▼                ▼
    ┌───────────────────────────────────────────────────────────────────────────┐
    │                        TextureMapper (GPU Compositor)                     │
    │                                                                           │
    │   TextureMapperLayer A    TextureMapperLayer B    TextureMapperLayer C    │
    │   ┌──────────┐            ┌──────────────┐        ┌──────────┐           │
    │   │ pos: 100,200          │ pos: 600,500 │        │ pos: 100,700         │
    │   │ size: 400×60│         │ size: 800×400│        │ size: 120×40│        │
    │   │ texture: A  │         │ texture: B   │        │ texture: C  │        │
    │   └──────────┘            └──────────────┘        └──────────┘           │
    │                                                                           │
    │   Master transform: scale(zoom) × translate(panX, panY)                  │
    │                                                                           │
    │   Overlay layer (meta): selection rects, handles, guides, rulers          │
    │                                                                           │
    └──────────────────────────────────────────────────────────────────────┬─────┘
                                                                          │
                                                                    Screen/Window
```

## Architecture Layers

### Layer 1: Island Runtime

Each island = `WebCore::Page` + the minimum `PageConfiguration` clients.

We implement lightweight stubs for the required clients:

| Client | Our Implementation |
|--------|--------------------|
| `ChromeClient` | Minimal: reports viewport size, device scale. No browser chrome. |
| `EditorClient` | Full: enables contenteditable for text editing in design nodes. |
| `FrameLoaderClient` | Stub: we don't load URLs. We inject HTML directly into the Document. |
| `BackForwardClient` | Stub: no navigation history. |
| `ProgressTrackerClient` | Stub: no loading progress. |
| `SocketProvider` | Stub or real: depends on whether we want fetch() inside islands. |
| `CookieJar` | Stub: no cookies. |
| `DragClient` | Intercepted: we handle drag at the meta-layer level. |

Island lifecycle:
```
createIsland(html: string, css: string, size: {w, h}) → Island
  1. Build PageConfiguration with our stub clients
  2. Create WebCore::Page
  3. Get the Page's Document
  4. Parse and inject the HTML into Document
  5. Inject scoped CSS (design tokens + island styles)
  6. Force layout
  7. Render to BitmapTexture via Skia painting
  8. Register the texture as a TextureMapperLayer
  9. Position the layer in world space

destroyIsland(island: Island) → void
  1. Remove TextureMapperLayer from compositor
  2. Destroy WebCore::Page (releases Document, layout tree, paint state)
```

### Layer 2: Component System

Components are Web Components registered in every island's `CustomElementRegistry`.

```cpp
// Shared component definitions
struct ComponentDef {
    String tagName;        // "my-button", "nav-bar"
    String html;           // shadow root innerHTML
    String css;            // shadow root styles
    String js;             // optional: class definition with lifecycle callbacks
    Vector<String> slots;  // named slots this component accepts
    Vector<Property> props; // observed attributes → CSS custom properties
};

// When creating an island, register all known components:
for (auto& def : componentLibrary) {
    island.page->document().customElementRegistry()
        .define(def.tagName, def.classConstructor);
}
```

Shadow DOM within an island provides:
- **Style isolation**: each component's CSS doesn't leak
- **CSS custom properties pierce through**: design tokens (`--brand-primary`, `--spacing-md`) inherit naturally
- **Slots = children**: `<slot>` elements enable real DOM composition
- **Events bubble**: click inside a button inside a card inside a frame → bubbles through all shadow boundaries

### Layer 3: Compositor (The Infinite Canvas)

Built on `TextureMapper` + `TextureMapperLayer`.

The compositor manages:
- A root `TextureMapperLayer` with the **world transform** (pan + zoom matrix)
- Child `TextureMapperLayer`s, one per island, positioned in world space
- An overlay layer for the meta-layer (selection, handles, guides)

```cpp
class DesignCanvasCompositor {
    TextureMapper m_textureMapper;
    TextureMapperLayer m_rootLayer;     // world transform lives here
    TextureMapperLayer m_overlayLayer;  // meta-layer on top

    // World transform
    TransformationMatrix m_worldTransform;  // scale(zoom) * translate(pan)

    void addIsland(Island& island, FloatPoint worldPos, FloatSize size) {
        auto* layer = new TextureMapperLayer();
        layer->setPosition(worldPos);
        layer->setSize(size);
        layer->setContentsLayer(island.platformLayer());
        m_rootLayer.addChild(layer);
    }

    void setZoom(float zoom, FloatPoint origin) {
        // Zoom around origin point
        m_worldTransform = TransformationMatrix()
            .translate(origin.x(), origin.y())
            .scale(zoom)
            .translate(-origin.x(), -origin.y())
            .translate(m_panOffset.x(), m_panOffset.y());
        m_rootLayer.setTransform(m_worldTransform);
    }

    void paint() {
        m_textureMapper.beginPainting();
        m_rootLayer.prepareForPainting(m_textureMapper);
        m_rootLayer.paint(m_textureMapper);
        m_overlayLayer.paint(m_textureMapper);  // always on top
        m_textureMapper.endPainting();
    }
};
```

**Resolution management**: when zoom stabilizes, re-render island textures at
the effective resolution (zoom × base size) for crisp text. During zoom animation,
use the existing texture scaled — text looks slightly blurry for ~100ms, same as
every map application.

### Layer 4: Meta-Layer

The meta-layer handles all design-tool interactions. It intercepts pointer events
before they reach any island and draws selection UI on top of everything.

Built on `PageOverlay` (OverlayType::View — fixed to viewport, doesn't scroll).

```cpp
class DesignMetaLayer : public PageOverlayClient {
    // Selection state
    Vector<IslandNodeRef> m_selectedNodes;
    std::optional<DragState> m_dragState;
    std::optional<ResizeState> m_resizeState;

    void drawRect(PageOverlay&, GraphicsContext& gc, const IntRect&) override {
        // Draw selection rectangles
        for (auto& node : m_selectedNodes) {
            auto worldBounds = nodeWorldBounds(node);
            gc.setStrokeColor(Color::blue);
            gc.strokeRect(worldBounds, 1.0f / m_zoom);  // constant screen-space width
            drawResizeHandles(gc, worldBounds);
        }
        drawGuides(gc);
        drawRulers(gc);
        drawHoverHighlight(gc);
    }

    bool mouseEvent(PageOverlay&, const PlatformMouseEvent& event) override {
        auto worldPos = screenToWorld(event.position());

        // Hit-test: which island, which node?
        auto hit = hitTest(worldPos);

        if (event.type() == PlatformEvent::Type::MousePressed) {
            if (hit.resizeHandle) startResize(hit);
            else if (hit.node) startSelection(hit);
            else if (hit.empty) startMarquee(worldPos);
            return true;  // consume event
        }
        // ... drag, release, hover
    }
};
```

**Hit-testing**: transform world-space click → island local coords → call
`Document::elementFromPoint()` on that island's Document. WebKit does the
heavy lifting — it knows exactly which DOM element is at any coordinate,
accounting for z-index, overflow, transforms, etc.

### Layer 5: Property Panel & Tools

The property panel reads and writes real CSS on real DOM elements.

```cpp
// Reading properties (user selects a node)
auto* element = selectedNode.element;  // live DOM Element in island's Document
auto computed = element->document().domWindow()->getComputedStyle(*element);

propertyPanel.display = computed->display();        // "flex"
propertyPanel.gap = computed->gap();                // "16px"
propertyPanel.color = computed->color();            // "rgb(51, 51, 51)"
propertyPanel.fontSize = computed->fontSize();      // "14px"
propertyPanel.borderRadius = computed->borderRadius(); // "12px"

// Writing properties (user changes a value)
element->style()->setProperty("gap", "24px");
// Layout automatically recalculates
// Island texture automatically re-renders
// Compositor shows updated result at next frame
```

No translation layer. No property mapping. The design tool properties ARE CSS properties.

### Layer 6: Scene Graph (Persistence)

The scene graph is the serializable representation of the design.

```
DesignFile
├── components: ComponentDef[]           // Web Component definitions
├── designTokens: Record<string, string> // CSS custom properties
├── islands: Island[]
│   ├── id: string
│   ├── position: {x, y}                // world space
│   ├── size: {width, height}           // viewport size
│   └── tree: NodeTree                  // serialized DOM
│       ├── tagName: string
│       ├── attributes: Record<string, string>
│       ├── inlineStyles: Record<string, string>
│       ├── shadowCSS?: string
│       └── children: NodeTree[]
└── canvasState
    ├── zoom: number
    └── pan: {x, y}
```

**Export to code** = serialize island DOM. The design IS the code.
No translation, no "generate CSS" — it was CSS all along.

## Key Operations

### Drag Component Between Islands

```
User drags <auth-button> from Island A to free canvas at position (500, 800):

1. Meta-layer detects drag from Island A
2. Get the element's outerHTML + computed styles from Island A's Document
3. Remove element from Island A's DOM
4. Island A re-renders (layout recalculates without the removed node)
5. Create new Island C at (500, 800) with the element's HTML
6. Island C renders the standalone component
7. Register Island C's texture in compositor
```

### Drag Component Into Island

```
User drags Island C's <auth-button> into Island D's <nav-bar>:

1. Meta-layer detects drop target = Island D, parent = <nav-bar> element
2. Get the element's outerHTML from Island C
3. Destroy Island C (remove Page, remove compositor layer)
4. Parse HTML and insert into Island D's <nav-bar> DOM
5. Component is now a child of <nav-bar> — shares CSS context
6. Island D re-renders
```

### Responsive Preview

```
User resizes an island's viewport:

1. Update the Page's viewport size
2. CSS media queries fire automatically (the browser does this!)
3. Container queries fire automatically
4. Layout recalculates
5. Island texture re-renders at new size
6. Compositor shows the result

No simulation. Real responsive behavior from the real CSS engine.
```

### Text Editing

```
User double-clicks a text node:

1. Meta-layer passes focus through to the island's Page
2. The browser's native contenteditable activates
3. Cursor, selection, IME — all handled by WebKit
4. Text reflows in real-time with real CSS
5. On blur, meta-layer recaptures input
```

## Platform Strategy

### Phase 1: WPE WebKit (Linux first)

WPE is designed for exactly this: headless WebKit rendering to GPU buffers.

- `WPEDisplayHeadless` — no window system dependency
- `WPEViewHeadless` — renders to DMA-BUF / SHM buffers
- `AcceleratedBackingStore` — manages the buffer pipeline
- Skia painting engine — already integrated in WPE WebKit
- TextureMapper compositor — OpenGL ES, mature, handles transforms/opacity/filters

Build: custom WPE WebKit, compile as a library, link into our C++/Rust app.

The application window itself: either a single real WPE toplevel that we
own (for the panels + canvas viewport), or a native window (GTK, SDL, GLFW)
where we composite WebKit's output.

### Phase 2: macOS

Options:
- **WKWebView per island** — macOS has WKWebView with native CoreAnimation compositing.
  Each WKWebView renders to a CALayer. We composite CALayers ourselves in a Metal view.
  Higher-level API, less control, but works with Apple's WebKit.
- **Build WPE for macOS** — WPE's platform layer is abstractable. The headless backend
  works anywhere with EGL/OpenGL. Harder to build but gives us the same architecture.
- **WebKit from source for macOS** — compile WebCore + TextureMapper directly, bypass
  the Cocoa API layer. Maximum control, maximum build complexity.

Recommended: start with WKWebView per island for quick macOS support, migrate
to WPE-on-macOS for unified architecture later.

### Phase 3: Windows

- WebView2 (Chromium) per island — similar to macOS WKWebView approach
- Or build WPE with ANGLE for OpenGL-on-DirectX
- Or use CEF (Chromium Embedded Framework) off-screen rendering

### Phase 4: Cross-Platform Unified

Long-term: ship WPE WebKit on all platforms. One codebase, one compositor,
one architecture. WPE's platform layer is designed to be ported.

## What Changes vs. Current OpenPencil

| Current | Next |
|---------|------|
| Skia CanvasKit (WASM) for all rendering | WebKit for content rendering, TextureMapper/Skia for compositing |
| Yoga WASM for layout (flexbox subset) | Real CSS layout engine (flexbox, grid, container queries, everything) |
| Custom text shaping | WebKit's text engine (ICU, HarfBuzz, CoreText) |
| SceneNode flat map | DOM trees in isolated Pages |
| Kiwi binary .fig format | HTML/CSS-based format (with optional .fig import) |
| Custom component/override system | Web Components + Shadow DOM |
| "Export to code" = generate | "Export to code" = serialize what's already there |
| Vue 3 + TypeScript app | C++/Rust app with WebKit library |
| Tauri desktop wrapper | Native application, IS the browser |

## Implementation Language

The core must be **C++** (WebKit is C++). Options for the application layer:

- **Pure C++** — maximum integration, no FFI overhead
- **Rust + C++ FFI** — Rust for the app layer (scene graph, tools, file I/O),
  C++ for WebKit integration. rust-bindgen for the bridge.
- **C++ core + TypeScript UI** — the property panel / layers panel / toolbar
  could be one island that's the "app shell", rendering our UI in HTML/CSS.
  Meta-layer stays in C++.

The third option is interesting: **the design tool's UI is itself an island**.
Panels are Web Components. The infinite canvas + meta-layer is the native layer.
We eat our own dog food.

## Open Questions

1. **Island granularity**: one Page per top-level frame? Per component? Per page?
   Memory/performance testing needed. Each Page has overhead (JS context, style
   system, layout state). Hundreds might be fine; thousands might not.

2. **Shared component registry**: when a component class changes, every island
   that uses it needs to re-register and re-render. Mechanism: custom element
   upgrade? Full re-injection?

3. **Undo/redo**: DOM mutations as the undo unit? Or snapshot the serialized
   tree? DOM MutationObserver could track changes for undo.

4. **Collaboration (Yjs)**: sync what — the serialized tree, or DOM mutations?
   Could use DOM MutationObserver → Yjs doc, or serialize islands and sync
   the serialized form.

5. **Animation timeline**: CSS animations are real, but a design tool needs
   a timeline editor. How to introspect/control `Animation` objects from
   the meta-layer?

6. **Build complexity**: compiling WebKit from source is a multi-hour endeavor
   with many dependencies. CI/CD for 3 platforms will be challenging.
   Mitigation: start with one platform (Linux/WPE), get the architecture right.

## Minimal UI

The demo has almost no custom UI. The power is the browser engine underneath.

### Toolbar (4 buttons + zoom)

```
[+ Frame]  [+ Text]  [+ Code]  [⚙ Inspect]        zoom: 100%
```

- **+ Frame** — create a new island with a `<div>`, set its size by dragging
- **+ Text** — create a new island with `<p contenteditable>`
- **+ Code** — create a new island, paste raw HTML/CSS into it
- **Inspect** — toggle: click an island to attach DevTools

### Canvas

The infinite canvas. Islands rendered as GPU-composited surfaces.
Click → select (blue border). Drag → move. Drag between islands → reparent.

### DevTools as Property Panel

When an island is focused, **WebKit's built-in inspector connects to it**.
Not a custom property panel. The real DevTools: Elements, Styles, Computed,
Layout, Animations, Console.

```
┌───────────────────────────────────┐
│  [+ Frame] [+ Text] [+Code] [⚙]  │
├───────────────────────────────────┤
│         Infinite Canvas           │
│                                   │
│    ┌────────┐     ┌──────────┐   │
│    │Island A│     │ Island B │   │
│    │        │     │ selected▐│   │
│    └────────┘     └──────────┘   │
│                                   │
├───────────────────────────────────┤
│  🔍 Inspector (Island B)         │
│  Elements │ Styles │ Computed    │
│  ▼ <hero-section>                │
│    ▼ #shadow-root (open)         │
│      <h1>Welcome</h1>           │
│      <button>Get Started</button>│
│  ─────────────────────────────   │
│  display: flex;                  │
│  gap: 24px;                      │
│  padding: 48px;                  │
└───────────────────────────────────┘
```

Switching selected island switches the inspector target. Edit CSS in the
inspector → island re-renders live on the canvas.

This means **every CSS property is editable from day one**. Grid, container
queries, `:has()`, custom properties, animations — whatever the inspector
can show, the user can change.

### DevTools Connection (WebKit Inspector)

WebKit has a built-in remote inspector protocol:

- On macOS: `WKWebView` exposes `_inspector` (private API) or
  `WKWebViewConfiguration.preferences._developerExtrasEnabled`
  enables right-click → Inspect Element
- On WPE/GTK: `RemoteInspectorServer` listens on a socket,
  `webkit_web_view_get_inspector()` returns a `WebKitWebInspector`
- The inspector protocol (JSON-RPC over socket) has domains:
  DOM, CSS, Page, Console, Network, Animation, LayerTree, etc.

For the PoC on macOS: enable the inspector on each WKWebView.
When the user selects an island, programmatically show that island's
inspector in a split panel.

## First Milestone: Proof of Concept (macOS)

Platform: macOS with native WebKit (WKWebView) + Core Animation/Metal.
Language: Swift. This is the fastest path to validate the architecture.
WPE (Linux/cross-platform) comes after the concept is proven.

### What to build

A macOS app (no Xcode, Swift Package Manager) that demonstrates:

1. **Metal viewport** — a single Metal view that composites island textures
   with a pan/zoom transform matrix
2. **Islands as WKWebViews** — each island is a `WKWebView` rendered
   off-screen (hidden from the window, but its `CALayer` is captured
   or snapshotted for compositing)
3. **HTML injection** — `loadHTMLString()` to put content into each island
4. **Pan/zoom** — scroll wheel / trackpad to zoom and pan the canvas,
   applied as a transform on the compositor level
5. **Selection** — click on an island → blue selection border drawn by
   the meta-layer (Metal overlay)
6. **DevTools** — selecting an island opens WebKit's inspector for that
   WKWebView in a split panel below the canvas
7. **Drag** — move islands around the canvas
8. **Toolbar** — the 4 buttons: + Frame, + Text, + Code, Inspect toggle

### Architecture for macOS PoC

```
┌─────────────────────────────────────────────┐
│ NSWindow                                     │
│ ┌─────────────────────────────────────────┐ │
│ │ Toolbar (NSView / SwiftUI)              │ │
│ │ [+ Frame] [+ Text] [+ Code] [⚙]       │ │
│ ├─────────────────────────────────────────┤ │
│ │ NSSplitView                             │ │
│ │ ┌───────────────────────────────────┐   │ │
│ │ │ CanvasView (NSView)               │   │ │
│ │ │                                   │   │ │
│ │ │ Hidden WKWebViews (off-screen)    │   │ │
│ │ │ ┌─────┐ ┌─────┐ ┌─────┐         │   │ │
│ │ │ │ WK1 │ │ WK2 │ │ WK3 │         │   │ │
│ │ │ └─────┘ └─────┘ └─────┘         │   │ │
│ │ │                                   │   │ │
│ │ │ Canvas layer (Core Animation)     │   │ │
│ │ │ - world transform (pan/zoom)      │   │ │
│ │ │ - child CALayers (island renders) │   │ │
│ │ │ - overlay layer (selection/guides)│   │ │
│ │ │                                   │   │ │
│ │ ├───────────────────────────────────┤   │ │
│ │ │ Inspector panel (WKWebView)       │   │ │
│ │ │ Connected to selected island      │   │ │
│ │ └───────────────────────────────────┘   │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

Each island `WKWebView` is a real WebKit rendering context with its own
DOM, CSS, JS. Its rendered output is captured (via `takeSnapshot`,
layer mirroring, or `snapshotView`) and composited onto the canvas.

For live updates: `WKWebView`'s `CALayer` can be re-rendered via
`CALayerHost` or by positioning the actual WKWebView within the canvas
view and applying the world transform via Core Animation. This avoids
constant snapshotting — the WKWebViews ARE the canvas content, just
transformed by our pan/zoom matrix.

### File structure

```
open-pencil-next/
├── Package.swift
├── Sources/
│   ├── App/
│   │   ├── main.swift
│   │   └── AppDelegate.swift
│   ├── Canvas/
│   │   ├── CanvasView.swift        — the infinite canvas (NSView + Core Animation)
│   │   ├── IslandManager.swift     — creates/destroys WKWebView islands
│   │   ├── MetaLayer.swift         — selection borders, handles, guides (CALayer)
│   │   └── HitTesting.swift        — world-space → island → DOM element
│   ├── Islands/
│   │   ├── Island.swift            — island model (WKWebView + position + size)
│   │   ├── IslandRenderer.swift    — manages WKWebView lifecycle and content
│   │   └── ComponentRegistry.swift — shared Web Component definitions
│   ├── Inspector/
│   │   ├── InspectorPanel.swift    — split panel hosting WebKit inspector
│   │   └── InspectorBridge.swift   — connects inspector to selected island
│   ├── Toolbar/
│   │   └── ToolbarView.swift       — the 4 buttons
│   └── Model/
│       ├── SceneGraph.swift        — serializable scene (islands + nodes)
│       └── DesignTokens.swift      — CSS custom properties shared across islands
└── Tests/
    └── ...
```
