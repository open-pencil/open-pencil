//! The canvas a `.fig` file holds: a zip archive with a `canvas.fig` entry, or a bare canvas as
//! older files are. A canvas is an 8-byte header naming what it is for, a version, and
//! length-prefixed chunks: the Kiwi schema, deflated, then the message, Zstandard or deflated.
//! Follows `parseFigBuffer` in `packages/fig/src/archive/index.ts`.

use std::io::Read;

use crate::Error;

/// What a canvas is for, by its header.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    Design,
    Board,
    Slides,
}

impl Kind {
    fn of(bytes: &[u8]) -> Option<Kind> {
        match bytes.get(..8)? {
            b"fig-kiwi" => Some(Kind::Design),
            b"fig-jam." => Some(Kind::Board),
            b"fig-deck" => Some(Kind::Slides),
            _ => None,
        }
    }
}

/// A canvas with its chunks decompressed.
pub struct Canvas {
    pub kind: Kind,
    pub version: u32,
    /// The binary Kiwi schema.
    pub schema: Vec<u8>,
    /// The Kiwi message: every record of the document.
    pub message: Vec<u8>,
}

/// Opens a `.fig` file, zipped or bare.
pub fn read_canvas(file: &[u8]) -> Result<Canvas, Error> {
    if Kind::of(file).is_some() {
        return parse_canvas(file);
    }
    parse_canvas(&canvas_entry(file)?)
}

fn parse_canvas(bytes: &[u8]) -> Result<Canvas, Error> {
    let kind = Kind::of(bytes).ok_or(Error::NotFig)?;
    let word = |at: usize| -> Result<u32, Error> {
        let bytes = bytes.get(at..at + 4).ok_or(Error::Truncated)?;
        Ok(u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
    };
    let version = word(8)?;
    let mut chunks = Vec::new();
    let mut at = 12;
    while at < bytes.len() && chunks.len() < 2 {
        let length = word(at)? as usize;
        at += 4;
        let end = at.checked_add(length).filter(|&end| end <= bytes.len());
        chunks.push(&bytes[at..end.ok_or(Error::Truncated)?]);
        at += length;
    }
    // A recognized header with fewer than two chunks ends before its message.
    let [schema, message] = chunks[..] else {
        return Err(Error::Truncated);
    };
    Ok(Canvas {
        kind,
        version,
        schema: inflate(schema)?,
        message: decompress(message)?,
    })
}

const ZSTD_MAGIC: [u8; 4] = [0x28, 0xb5, 0x2f, 0xfd];

/// The most a chunk may decompress to: the index addresses the message with 32-bit offsets, and
/// a damaged or hostile chunk must not grow its output until allocation fails.
const MAX_DECOMPRESSED: u64 = u32::MAX as u64;

fn decompress(chunk: &[u8]) -> Result<Vec<u8>, Error> {
    if !chunk.starts_with(&ZSTD_MAGIC) {
        return inflate(chunk);
    }
    // A chunk may hold several frames; each decoder reads one and leaves the slice after it.
    let mut rest = chunk;
    let mut message = Vec::new();
    while !rest.is_empty() {
        let decoder =
            ruzstd::decoding::StreamingDecoder::new(&mut rest).map_err(|_| Error::Decompress)?;
        let budget = MAX_DECOMPRESSED - message.len() as u64;
        decoder
            .take(budget + 1)
            .read_to_end(&mut message)
            .map_err(|_| Error::Decompress)?;
        if message.len() as u64 > MAX_DECOMPRESSED {
            return Err(Error::TooLarge);
        }
    }
    Ok(message)
}

/// Raw deflate, without a zlib header.
fn inflate(chunk: &[u8]) -> Result<Vec<u8>, Error> {
    inflate_within(chunk, u32::MAX as usize)
}

fn inflate_within(chunk: &[u8], limit: usize) -> Result<Vec<u8>, Error> {
    use miniz_oxide::inflate::TINFLStatus;
    miniz_oxide::inflate::decompress_to_vec_with_limit(chunk, limit).map_err(|error| {
        if error.status == TINFLStatus::HasMoreOutput {
            Error::TooLarge
        } else {
            Error::Decompress
        }
    })
}

/// The archive entry that holds the canvas: `canvas.fig`, or `canvas` in older files, or else the
/// largest entry that is not an image or JSON.
fn canvas_entry(file: &[u8]) -> Result<Vec<u8>, Error> {
    let archive = rawzip::ZipArchive::from_slice(file).map_err(|_| Error::NotFig)?;
    let mut entries = Vec::new();
    for entry in archive.entries() {
        let entry = entry.map_err(|_| Error::Archive)?;
        let name = entry.file_path().as_bytes().to_vec();
        entries.push(Entry {
            name,
            size: entry.uncompressed_size_hint(),
            method: entry.compression_method(),
            wayfinder: entry.wayfinder(),
        });
    }
    let named = |wanted: &[u8]| entries.iter().find(|entry| entry.name == wanted);
    let chosen = named(b"canvas.fig")
        .or_else(|| named(b"canvas"))
        .or_else(|| {
            let mut largest: Option<&Entry> = None;
            for entry in entries.iter().filter(|entry| !is_likely_asset(&entry.name)) {
                if largest.is_none_or(|largest| largest.size < entry.size) {
                    largest = Some(entry);
                }
            }
            largest
        });
    let chosen = chosen.ok_or(Error::NoCanvas)?;
    let data = archive
        .get_entry(chosen.wayfinder)
        .map_err(|_| Error::Archive)?
        .data();
    match chosen.method {
        rawzip::CompressionMethod::STORE => Ok(data.to_vec()),
        rawzip::CompressionMethod::DEFLATE => {
            // The directory's size bounds what the entry may inflate to.
            let limit = usize::try_from(chosen.size).map_err(|_| Error::TooLarge)?;
            inflate_within(data, limit)
        }
        _ => Err(Error::Archive),
    }
}

struct Entry {
    name: Vec<u8>,
    size: u64,
    method: rawzip::CompressionMethod,
    wayfinder: rawzip::ZipArchiveEntryWayfinder,
}

fn is_likely_asset(name: &[u8]) -> bool {
    let lower = name.to_ascii_lowercase();
    [b".png".as_slice(), b".jpg", b".json"]
        .iter()
        .any(|suffix| lower.ends_with(suffix))
}
