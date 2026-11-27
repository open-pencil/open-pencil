//! Reads Figma `.fig` files: the canvas inside the archive, its Kiwi message indexed without
//! decoding it, pages with their instances expanded into occurrences that refer to the records
//! they place, and the field values each occurrence ends up with.
//!
//! This follows the TypeScript reader in OpenPencil's `packages/fig/src/document/` and
//! `packages/fig/src/instance-overrides/`, which stays the reference: `packages/fig/tests/crate/`
//! compares the two on the repository's fixtures.
//!
//! ```no_run
//! let file = std::fs::read("design.fig")?;
//! let document = open_pencil_fig::Document::open(&file)?;
//! for page in 0..document.index.pages.len() {
//!     let expansion = document.expand_page(page).expect("the page exists");
//!     let values = document.properties(&expansion)?;
//!     for layer in 0..expansion.occurrences.len() as u32 {
//!         let fields = values.of(layer)?;
//!         println!("{:?}", fields.get("name"));
//!     }
//! }
//! # Ok::<(), Box<dyn std::error::Error>>(())
//! ```

pub mod container;
pub mod expand;
pub mod index;
pub mod kiwi;
pub mod properties;
#[cfg(all(target_arch = "wasm32", feature = "exports"))]
mod wasm;

pub use container::{Canvas, Kind};
pub use expand::Expansion;
pub use index::Index;
pub use kiwi::{Schema, Value};
pub use properties::Properties;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Error {
    /// Neither a canvas nor a zip archive holding one.
    NotFig,
    /// A zip archive whose directory or entry could not be read.
    Archive,
    /// A zip archive with no entry that could hold the canvas.
    NoCanvas,
    /// A canvas that ends inside its header or a chunk.
    Truncated,
    /// A chunk that does not inflate or decode as Zstandard.
    Decompress,
    /// A chunk or archive entry that decompresses past what the reader accepts: more than its
    /// declared size, or more than 4 GiB.
    TooLarge,
    /// A schema that does not parse, or lacks a definition, field, or member the reader needs.
    Schema(&'static str),
    /// A message that ends early or holds a value its schema does not allow.
    Message,
    /// A record that is its own ancestor.
    ParentCycle,
    /// An expansion of another document, or an occurrence past an expansion's end.
    NoOccurrence,
}

impl core::fmt::Display for Error {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            Error::NotFig => f.write_str("not a .fig file"),
            Error::Archive => f.write_str("the zip archive could not be read"),
            Error::NoCanvas => f.write_str("the archive holds no canvas"),
            Error::Truncated => f.write_str("the canvas ends early"),
            Error::Decompress => f.write_str("a canvas chunk does not decompress"),
            Error::TooLarge => f.write_str("a canvas chunk decompresses past its limit"),
            Error::Schema(name) => write!(f, "the schema lacks {name}"),
            Error::Message => f.write_str("the message does not match its schema"),
            Error::ParentCycle => f.write_str("a layer is its own ancestor"),
            Error::NoOccurrence => f.write_str("no such occurrence in this document's expansion"),
        }
    }
}

impl std::error::Error for Error {}

pub type Result<T> = core::result::Result<T, Error>;

/// An opened document: its schema, its message, and the index over the message.
pub struct Document {
    pub kind: Kind,
    pub version: u32,
    pub schema: Schema,
    pub message: Vec<u8>,
    pub index: Index,
}

impl Document {
    /// Opens a `.fig` file, zipped or bare.
    pub fn open(file: &[u8]) -> Result<Document> {
        let canvas = container::read_canvas(file)?;
        let schema = Schema::parse(&canvas.schema).map_err(|_| Error::Schema("a valid schema"))?;
        let index = Index::build(&schema, &canvas.message)?;
        Ok(Document {
            kind: canvas.kind,
            version: canvas.version,
            schema,
            message: canvas.message,
            index,
        })
    }

    /// Expands the page at `page` in saved page order.
    pub fn expand_page(&self, page: usize) -> Option<Expansion<'_>> {
        Some(Expansion::page(&self.index, *self.index.pages.get(page)?))
    }

    /// The field values of an expanded page's occurrences.
    pub fn properties<'a>(&'a self, expansion: &'a Expansion<'a>) -> Result<Properties<'a>> {
        // Records are found by position, which only this document's expansions share.
        if !core::ptr::eq(expansion.index(), &self.index) {
            return Err(Error::NoOccurrence);
        }
        Properties::new(expansion, &self.index, &self.schema, &self.message)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const FILE: &[u8] = include_bytes!("../../../../tests/fixtures/circle-text.fig");

    #[test]
    fn refuses_occurrences_it_does_not_have() {
        let document = Document::open(FILE).unwrap();
        let other = Document::open(FILE).unwrap();
        let expansion = document.expand_page(0).unwrap();
        assert_eq!(
            other.properties(&expansion).err(),
            Some(Error::NoOccurrence)
        );
        let values = document.properties(&expansion).unwrap();
        let count = expansion.occurrences.len() as u32;
        assert!(values.of(count - 1).is_ok());
        assert_eq!(values.of(count).err(), Some(Error::NoOccurrence));
    }
}
