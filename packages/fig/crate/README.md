# open-pencil-fig

Reads Figma `.fig` files without a design editor: the canvas inside the archive, an index over
its Kiwi records that leaves their fields encoded, pages with their component instances expanded
into the layers they show, and each layer's field values.

It is the Rust counterpart of the reader in [OpenPencil](https://github.com/open-pencil/open-pencil),
an open-source design editor, whose tests compare the two on every page of their fixtures.

```rust,no_run
let file = std::fs::read("design.fig")?;
let document = open_pencil_fig::Document::open(&file)?;
for page in 0..document.index.pages.len() {
    let expansion = document.expand_page(page).expect("the page exists");
    let values = document.properties(&expansion)?;
    for layer in 0..expansion.occurrences.len() as u32 {
        let fields = values.of(layer)?;
        println!("{:?}", fields.get("name"));
    }
}
# Ok::<(), Box<dyn std::error::Error>>(())
```

## Status

Expansion follows instances, swaps, component property assignments, and slot content, leaves out
an instance whose component would contain itself, and places each override on the layer it
addresses. A layer's fields are its component's under its own record, the values its component
properties bind, and the overrides its owners place, with instances' uniform scale, resize
constraints, saved sizes, and saved derived data applied in order.

Not yet ported: styles, which give a layer the fields of the styles it names and which a text's
claimed fields give way to; references to library variables and styles, which stay as saved; and
the document-wide repair of component loops, which decides in saved order which instance of a
loop is left out.

The `exports` feature adds the raw functions a WebAssembly host calls; leave it off when
depending on the crate.

## License

MIT
