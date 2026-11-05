//! Lays an HTML document out with Blitz (Stylo + Taffy + Parley) and captures, for every
//! node, its border box, computed styles, inline fragments, and text lines. Sub-resources are
//! fetched by the host: Blitz's requests queue up, the host answers them, and the document is
//! pumped until nothing is pending.

use std::cell::RefCell;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use blitz_dom::{BaseDocument, DocumentConfig, Node, StyleThreading};
use blitz_html::HtmlDocument;
use blitz_traits::net::{Bytes, NetHandler, NetProvider, Request};
use blitz_traits::shell::{ColorScheme, Viewport};
use parley::fontique::{Blob, FontInfoOverride, GenericFamily};
use parley::{FontContext, PositionedLayoutItem};
use serde_json::{Map, Value, json};

/// Computed properties the importer reads. Everything else is left out to keep captures small.
/// Those in `default_styles` are reported only when they differ from their initial value; the
/// rest, such as `display`, `color`, sizes, and font properties, are always reported, since
/// their initial values depend on the element or are inherited.
const PROPERTIES: &[&str] = &[
    "display",
    "position",
    "visibility",
    "opacity",
    "z-index",
    "overflow-x",
    "overflow-y",
    "box-sizing",
    "width",
    "height",
    "min-width",
    "max-width",
    "min-height",
    "max-height",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "margin-top",
    "margin-right",
    "margin-bottom",
    "margin-left",
    "top",
    "right",
    "bottom",
    "left",
    "flex-direction",
    "flex-wrap",
    "flex-grow",
    "flex-shrink",
    "flex-basis",
    "justify-content",
    "align-items",
    "align-self",
    "align-content",
    "row-gap",
    "column-gap",
    "grid-template-columns",
    "grid-template-rows",
    "background-color",
    "background-image",
    "background-size",
    "background-position",
    "background-repeat",
    "background-clip",
    "border-top-width",
    "border-right-width",
    "border-bottom-width",
    "border-left-width",
    "border-top-style",
    "border-right-style",
    "border-bottom-style",
    "border-left-style",
    "border-top-color",
    "border-right-color",
    "border-bottom-color",
    "border-left-color",
    "border-top-left-radius",
    "border-top-right-radius",
    "border-bottom-right-radius",
    "border-bottom-left-radius",
    "outline-width",
    "outline-style",
    "outline-color",
    "outline-offset",
    "box-shadow",
    "filter",
    "backdrop-filter",
    "mix-blend-mode",
    "clip-path",
    "transform",
    "translate",
    "rotate",
    "scale",
    "transform-origin",
    "object-fit",
    "object-position",
    "aspect-ratio",
    "color",
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "font-stretch",
    "line-height",
    "letter-spacing",
    "word-spacing",
    "text-align",
    "text-transform",
    "text-decoration-line",
    "text-decoration-style",
    "text-decoration-color",
    "text-decoration-thickness",
    "text-underline-offset",
    "text-shadow",
    "text-indent",
    "white-space",
    "text-wrap-mode",
    "text-overflow",
    "vertical-align",
    "list-style-type",
    "content",
];

// ---------------------------------------------------------------------------------------------
// Network: a queue the host drains

struct Pending {
    url: String,
    handler: Box<dyn NetHandler>,
}

#[derive(Default)]
struct QueueNet {
    queued: Mutex<Vec<Pending>>,
}

impl NetProvider for QueueNet {
    fn fetch(&self, _doc_id: usize, request: Request, handler: Box<dyn NetHandler>) {
        let url = request.url.to_string();
        self.queued.lock().unwrap().push(Pending { url, handler });
    }
}

// ---------------------------------------------------------------------------------------------
// State

struct Session {
    doc: BaseDocument,
    net: Arc<QueueNet>,
    /// Requests the host is answering, by id: the URL asked for and who takes the answer.
    in_flight: HashMap<u32, (String, Box<dyn NetHandler>)>,
    next_id: u32,
}

thread_local! {
    static FONTS: RefCell<FontContext> = RefCell::new(empty_font_ctx());
    static SESSION: RefCell<Option<Session>> = const { RefCell::new(None) };
}

fn empty_font_ctx() -> FontContext {
    use parley::fontique::{Collection, CollectionOptions, SourceCache};
    FontContext {
        source_cache: SourceCache::new_shared(),
        collection: Collection::new(CollectionOptions {
            shared: false,
            system_fonts: false,
        }),
    }
}

/// Registers a font file; `alias` registers it under another family name as well, as browsers
/// alias `-apple-system` to the system font.
pub fn font_add(bytes: &[u8], alias: Option<&str>) -> usize {
    let decoded = blitz_dom::decode_font_bytes(bytes).into_owned();
    let blob = Blob::new(Arc::new(decoded) as _);
    FONTS.with_borrow_mut(|ctx| {
        // An override replaces the family name, so the alias is a second registration.
        if let Some(family) = alias {
            let over = FontInfoOverride {
                family_name: Some(family),
                width: None,
                style: None,
                weight: None,
                axes: None,
            };
            ctx.collection.register_fonts(blob.clone(), Some(over));
        }
        ctx.collection
            .register_fonts(blob, None)
            .iter()
            .map(|(_, faces)| faces.len())
            .sum()
    })
}

/// A font file as TrueType or OpenType: WOFF and WOFF2 decompressed, anything else as it is.
pub fn font_decode(bytes: &[u8]) -> Vec<u8> {
    blitz_dom::decode_font_bytes(bytes).into_owned()
}

/// Maps a generic family (`serif`, `sans-serif`, …) to registered families, in fallback order.
pub fn font_generic(generic: &str, families: &[&str]) -> bool {
    let Some(generic) = GenericFamily::parse(generic) else {
        return false;
    };
    FONTS.with_borrow_mut(|ctx| {
        let ids: Vec<_> = families
            .iter()
            .filter_map(|name| ctx.collection.family_id(name))
            .collect();
        let found = !ids.is_empty();
        ctx.collection
            .set_generic_families(generic, ids.into_iter());
        found
    })
}

pub fn fonts_reset() {
    FONTS.with_borrow_mut(|ctx| *ctx = empty_font_ctx());
}

pub fn open(html: &str, base_url: Option<&str>, width: u32, height: u32) {
    let net = Arc::new(QueueNet::default());
    let config = DocumentConfig {
        viewport: Some(Viewport::new(width, height, 1.0, ColorScheme::Light)),
        base_url: base_url.map(str::to_owned),
        net_provider: Some(net.clone() as Arc<dyn NetProvider>),
        font_ctx: Some(FONTS.with_borrow(|ctx| ctx.clone())),
        style_threading: StyleThreading::Sequential,
        ..DocumentConfig::default()
    };
    let doc = HtmlDocument::from_html(html, config).into_inner();
    SESSION.set(Some(Session {
        doc,
        net,
        in_flight: HashMap::new(),
        next_id: 0,
    }));
}

fn with_session<R>(f: impl FnOnce(&mut Session) -> R) -> R {
    SESSION.with_borrow_mut(|session| f(session.as_mut().expect("no open document")))
}

/// Applies answered resources and returns the requests still waiting for an answer.
pub fn pump() -> Vec<(u32, String)> {
    with_session(|s| {
        s.doc.handle_messages();
        let queued: Vec<Pending> = std::mem::take(&mut *s.net.queued.lock().unwrap());
        queued
            .into_iter()
            .map(|p| {
                let id = s.next_id;
                s.next_id += 1;
                s.in_flight.insert(id, (p.url.clone(), p.handler));
                (id, p.url)
            })
            .collect()
    })
}

pub fn provide(id: u32, resolved_url: &str, bytes: Vec<u8>) {
    with_session(|s| {
        if let Some((_, handler)) = s.in_flight.remove(&id) {
            handler.bytes(resolved_url.to_owned(), Bytes::from(bytes));
        }
    })
}

/// Answers a request the host could not fetch. Handlers take no errors, and a stylesheet in
/// `<head>` blocks rendering until it is answered, so it gets empty bytes: an empty stylesheet,
/// font, or image is ignored, as a browser ignores one that failed to load.
pub fn fail(id: u32) {
    with_session(|s| {
        if let Some((url, handler)) = s.in_flight.remove(&id) {
            handler.bytes(url, Bytes::new());
        }
    })
}

// ---------------------------------------------------------------------------------------------
// Capture

fn rect(x: f32, y: f32, w: f32, h: f32) -> Value {
    json!([x, y, w, h])
}

fn styles(doc: &BaseDocument, node: &Node) -> Value {
    let defaults = default_styles();
    let mut out = Map::new();
    for property in PROPERTIES {
        let value = doc.resolved_style_value(node.id, property);
        // Stylo answers a property it does not implement with an empty value.
        if value.is_empty() {
            continue;
        }
        // A property with a fixed initial value is left out at it; the host knows them.
        if defaults.get(*property).is_some_and(|d| *d == value) {
            continue;
        }
        out.insert((*property).into(), value.into());
    }
    Value::Object(out)
}

/// Initial values of the captured properties that are not inherited. An inherited property is
/// always reported, since a missing value would read as the parent's, not the initial one.
fn default_styles() -> &'static HashMap<&'static str, String> {
    use std::sync::OnceLock;
    static DEFAULTS: OnceLock<HashMap<&'static str, String>> = OnceLock::new();
    DEFAULTS.get_or_init(|| {
        [
            ("opacity", "1"),
            ("z-index", "auto"),
            ("overflow-x", "visible"),
            ("overflow-y", "visible"),
            ("position", "static"),
            ("flex-wrap", "nowrap"),
            ("flex-grow", "0"),
            ("flex-shrink", "1"),
            ("flex-basis", "auto"),
            ("background-color", "rgba(0, 0, 0, 0)"),
            ("background-image", "none"),
            ("background-size", "auto"),
            ("background-position", "0% 0%"),
            ("background-repeat", "repeat"),
            ("background-clip", "border-box"),
            ("border-top-style", "none"),
            ("border-right-style", "none"),
            ("border-bottom-style", "none"),
            ("border-left-style", "none"),
            ("border-top-width", "0px"),
            ("border-right-width", "0px"),
            ("border-bottom-width", "0px"),
            ("border-left-width", "0px"),
            ("border-top-left-radius", "0px"),
            ("border-top-right-radius", "0px"),
            ("border-bottom-right-radius", "0px"),
            ("border-bottom-left-radius", "0px"),
            ("outline-style", "none"),
            ("outline-width", "0px"),
            ("outline-offset", "0px"),
            ("box-shadow", "none"),
            ("filter", "none"),
            ("backdrop-filter", "none"),
            ("mix-blend-mode", "normal"),
            ("clip-path", "none"),
            ("transform", "none"),
            ("translate", "none"),
            ("rotate", "none"),
            ("scale", "none"),
            ("object-fit", "fill"),
            ("object-position", "50% 50%"),
            ("aspect-ratio", "auto"),
            ("text-shadow", "none"),
            ("text-decoration-line", "none"),
            ("text-overflow", "clip"),
            ("vertical-align", "baseline"),
            ("content", "normal"),
            ("grid-template-columns", "none"),
            ("grid-template-rows", "none"),
            ("top", "auto"),
            ("right", "auto"),
            ("bottom", "auto"),
            ("left", "auto"),
            ("margin-top", "0px"),
            ("margin-right", "0px"),
            ("margin-bottom", "0px"),
            ("margin-left", "0px"),
            ("padding-top", "0px"),
            ("padding-right", "0px"),
            ("padding-bottom", "0px"),
            ("padding-left", "0px"),
            ("min-width", "auto"),
            ("min-height", "auto"),
            ("max-width", "none"),
            ("max-height", "none"),
        ]
        .into_iter()
        .map(|(k, v)| (k, v.to_owned()))
        .collect()
    })
}

/// The lines of an inline formatting context: their boxes, baselines, and text.
fn lines(node: &Node, origin: (f32, f32)) -> Option<Value> {
    let inline = node.element_data()?.inline_layout_data.as_ref()?;
    let layout = node.unrounded_layout();
    let inset = layout.padding + layout.border;
    let (ox, oy) = (
        origin.0 + inset.left,
        origin.1 + inset.top + inline.block_offset,
    );
    let scale = inline.layout.scale();
    let lines: Vec<Value> = inline
        .layout
        .lines()
        .map(|line| {
            let m = line.metrics();
            let mut runs = Vec::new();
            for item in line.items() {
                match item {
                    PositionedLayoutItem::GlyphRun(run) => {
                        let range = run.run().text_range();
                        runs.push(json!({
                            "node": run.style().brush.id.as_u64(),
                            "x": ox + run.offset() / scale,
                            "width": run.advance() / scale,
                            "text": inline.text.get(range).unwrap_or_default(),
                        }));
                    }
                    PositionedLayoutItem::InlineBox(b) => runs.push(json!({
                        "box": b.id,
                        "x": ox + b.x / scale,
                        "width": b.width / scale,
                    })),
                }
            }
            // Floats push runs aside without moving the line's own offset, so the runs place it.
            let left = runs
                .iter()
                .filter_map(|r| r["x"].as_f64())
                .fold(f64::INFINITY, f64::min);
            let right = runs
                .iter()
                .filter_map(|r| Some(r["x"].as_f64()? + r["width"].as_f64()?))
                .fold(f64::NEG_INFINITY, f64::max);
            let (x, width) = if left.is_finite() && right.is_finite() {
                (left as f32, (right - left) as f32)
            } else {
                (ox + m.offset / scale, m.advance / scale)
            };
            json!({
                "x": x,
                "y": oy + m.block_min_coord / scale,
                "width": width,
                "height": (m.block_max_coord - m.block_min_coord) / scale,
                "baseline": oy + m.baseline / scale,
                "runs": runs,
            })
        })
        .collect();
    Some(Value::Array(lines))
}

fn capture_node(doc: &BaseDocument, node: &Node, out: &mut Vec<Value>, parent: Option<usize>) {
    let index = out.len();
    let mut entry = Map::new();
    entry.insert("id".into(), node.id.as_u64().into());
    if let Some(parent) = parent {
        entry.insert("parent".into(), parent.into());
    }

    if let Some(text) = node.text_data() {
        entry.insert("text".into(), text.content.clone().into());
        out.push(Value::Object(entry));
        return;
    }
    let Some(el) = node.element_data() else {
        // Document, comment, or doctype: walk its children only.
        for &child in &node.children {
            capture_node(doc, &doc.tree()[child], out, parent);
        }
        return;
    };

    let pos = node.absolute_position(0.0, 0.0);
    let size = node.final_layout().size;
    entry.insert("tag".into(), el.name.local.to_string().into());
    let attrs: Map<String, Value> = el
        .attrs()
        .iter()
        .map(|a| {
            // `xlink:href` and `href` are different attributes, so the prefix stays in the key.
            let key = match &a.name.prefix {
                Some(prefix) => format!("{prefix}:{}", a.name.local),
                None => a.name.local.to_string(),
            };
            (key, a.value.clone().into())
        })
        .collect();
    if !attrs.is_empty() {
        entry.insert("attrs".into(), Value::Object(attrs));
    }
    entry.insert("box".into(), rect(pos.x, pos.y, size.width, size.height));
    if let Some(image) = el.image_data() {
        let kind = match image {
            blitz_dom::node::ImageData::Raster(r) => format!("raster {}x{}", r.width, r.height),
            blitz_dom::node::ImageData::Svg(_) => "svg".to_owned(),
            _ => "other".to_owned(),
        };
        entry.insert("image".into(), kind.into());
    }
    entry.insert("style".into(), styles(doc, node));

    if let Some(fragments) = node.inline_fragment_boxes() {
        let root = node
            .inline_root_ancestor()
            .map(|r| r.absolute_position(0.0, 0.0));
        let (rx, ry) = root.map_or((0.0, 0.0), |p| (p.x, p.y));
        let rects: Vec<Value> = fragments
            .map(|r| rect(rx + r.left, ry + r.top, r.right - r.left, r.bottom - r.top))
            .collect();
        entry.insert("fragments".into(), Value::Array(rects));
    }
    if let Some(lines) = lines(node, (pos.x, pos.y)) {
        entry.insert("lines".into(), lines);
    }
    out.push(Value::Object(entry));

    let pseudo = |id: Option<blitz_traits::node_id::NodeId>| id.and_then(|id| doc.get_node(id));
    if let Some(before) = pseudo(el.before) {
        capture_pseudo(doc, before, "::before", out, index);
    }
    for &child in &node.children {
        capture_node(doc, &doc.tree()[child], out, Some(index));
    }
    if let Some(after) = pseudo(el.after) {
        capture_pseudo(doc, after, "::after", out, index);
    }
}

fn capture_pseudo(doc: &BaseDocument, node: &Node, tag: &str, out: &mut Vec<Value>, parent: usize) {
    let before = out.len();
    capture_node(doc, node, out, Some(parent));
    if let Some(Value::Object(entry)) = out.get_mut(before) {
        entry.insert("tag".into(), tag.into());
    }
}

pub fn capture() -> String {
    with_session(|s| {
        s.doc.handle_messages();
        s.doc.resolve(0.0);
        let doc = &s.doc;
        let mut nodes = Vec::new();
        capture_node(doc, doc.root_node(), &mut nodes, None);
        let (w, h) = doc.viewport().window_size;
        // Values the nodes leave out are these; the host fills them back in.
        let initial: Map<String, Value> = default_styles()
            .iter()
            .map(|(property, value)| ((*property).to_owned(), value.clone().into()))
            .collect();
        json!({ "engine": "blitz", "viewport": [w, h], "initial": initial, "nodes": nodes })
            .to_string()
    })
}

// ---------------------------------------------------------------------------------------------
// WASM ABI: strings and bytes cross as (pointer, length); results go through one output buffer.

#[cfg(target_arch = "wasm32")]
mod abi {
    use std::alloc::{Layout, alloc as raw_alloc, dealloc as raw_dealloc};
    use std::cell::RefCell;

    thread_local! {
        static OUTPUT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
    }

    fn set_output(bytes: Vec<u8>) -> usize {
        let len = bytes.len();
        OUTPUT.set(bytes);
        len
    }

    unsafe fn bytes<'a>(ptr: *const u8, len: usize) -> &'a [u8] {
        if len == 0 {
            &[]
        } else {
            unsafe { std::slice::from_raw_parts(ptr, len) }
        }
    }

    unsafe fn text<'a>(ptr: *const u8, len: usize) -> &'a str {
        std::str::from_utf8(unsafe { bytes(ptr, len) }).unwrap_or_default()
    }

    #[unsafe(no_mangle)]
    pub extern "C" fn alloc(len: usize) -> *mut u8 {
        unsafe { raw_alloc(Layout::from_size_align(len.max(1), 1).unwrap()) }
    }

    #[unsafe(no_mangle)]
    pub extern "C" fn dealloc(ptr: *mut u8, len: usize) {
        unsafe { raw_dealloc(ptr, Layout::from_size_align(len.max(1), 1).unwrap()) }
    }

    #[unsafe(no_mangle)]
    pub extern "C" fn output_ptr() -> *const u8 {
        OUTPUT.with_borrow(|out| out.as_ptr())
    }

    /// The decoded font in the output buffer; returns its length.
    #[unsafe(no_mangle)]
    pub extern "C" fn font_decode(ptr: *const u8, len: usize) -> usize {
        set_output(super::font_decode(unsafe { bytes(ptr, len) }))
    }

    #[unsafe(no_mangle)]
    pub extern "C" fn fonts_reset() {
        super::fonts_reset()
    }

    #[unsafe(no_mangle)]
    pub extern "C" fn font_add(
        ptr: *const u8,
        len: usize,
        alias: *const u8,
        alias_len: usize,
    ) -> usize {
        let alias = unsafe { text(alias, alias_len) };
        super::font_add(
            unsafe { bytes(ptr, len) },
            (!alias.is_empty()).then_some(alias),
        )
    }

    /// `families` is a newline-separated list.
    #[unsafe(no_mangle)]
    pub extern "C" fn font_generic(g: *const u8, g_len: usize, f: *const u8, f_len: usize) -> bool {
        let families: Vec<&str> = unsafe { text(f, f_len) }.lines().collect();
        super::font_generic(unsafe { text(g, g_len) }, &families)
    }

    #[unsafe(no_mangle)]
    pub extern "C" fn open(
        html: *const u8,
        html_len: usize,
        url: *const u8,
        url_len: usize,
        w: u32,
        h: u32,
    ) {
        let url = unsafe { text(url, url_len) };
        super::open(
            unsafe { text(html, html_len) },
            (!url.is_empty()).then_some(url),
            w,
            h,
        )
    }

    /// The pending requests as JSON `[[id, url], …]`.
    #[unsafe(no_mangle)]
    pub extern "C" fn pump() -> usize {
        set_output(serde_json::to_vec(&super::pump()).unwrap_or_default())
    }

    #[unsafe(no_mangle)]
    pub extern "C" fn provide(
        id: u32,
        url: *const u8,
        url_len: usize,
        data: *const u8,
        data_len: usize,
    ) {
        super::provide(
            id,
            unsafe { text(url, url_len) },
            unsafe { bytes(data, data_len) }.to_vec(),
        )
    }

    #[unsafe(no_mangle)]
    pub extern "C" fn fail(id: u32) {
        super::fail(id)
    }

    #[unsafe(no_mangle)]
    pub extern "C" fn capture() -> usize {
        set_output(super::capture().into_bytes())
    }
}
