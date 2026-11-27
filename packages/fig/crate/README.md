# open-pencil-fig

Reads Figma `.fig` files without a design editor: the canvas inside the archive, an index over
its Kiwi records that leaves their fields encoded, and pages with their component instances
expanded into the layers they show.

It is the Rust counterpart of the reader in [OpenPencil](https://github.com/open-pencil/open-pencil),
an open-source design editor, whose tests compare the two on every page of their fixtures.

```rust,no_run
let file = std::fs::read("design.fig")?;
let document = open_pencil_fig::Document::open(&file)?;
for page in 0..document.index.pages.len() {
    let expansion = document.expand_page(page).expect("the page exists");
    println!("page {page}: {} layers", expansion.occurrences.len());
}
# Ok::<(), Box<dyn std::error::Error>>(())
```

## Status

Expansion follows instances, swaps, component property assignments, and slot content, leaves out
an instance whose component would contain itself, and places each override on the layer it
addresses. Not yet ported: the document-wide repair of component loops, which decides in saved
order which instance of a loop is left out, and the layers' field values (overridden
properties, scaling, resizing, styles, variables).

The `exports` feature adds the raw functions a WebAssembly host calls; leave it off when
depending on the crate.

## License

MIT
