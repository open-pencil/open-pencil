//! Byte-level knowledge of OpenType font files, independent of how fonts are discovered.

use std::io::{Read, Seek, SeekFrom};

const TTC_TAG: &[u8; 4] = b"ttcf";
const OUTLINE_TABLES: [&[u8; 4]; 3] = [b"glyf", b"CFF ", b"CFF2"];
const OFFSET_TABLE_SIZE: usize = 12;
const TABLE_RECORD_SIZE: usize = 16;

fn read_array<const N: usize>(reader: &mut impl Read) -> Option<[u8; N]> {
    let mut bytes = [0; N];
    reader.read_exact(&mut bytes).ok()?;
    Some(bytes)
}

fn read_u16(data: &[u8], offset: usize) -> Option<u16> {
    Some(u16::from_be_bytes(
        data.get(offset..offset + 2)?.try_into().ok()?,
    ))
}

fn read_u32(data: &[u8], offset: usize) -> Option<u32> {
    Some(u32::from_be_bytes(
        data.get(offset..offset + 4)?.try_into().ok()?,
    ))
}

/// Returns font data whose first table directory is face `index`, which renderers that read only
/// the first face of a collection (CanvasKit) accept. Table offsets in a collection are absolute,
/// so the tables themselves stay where they are.
pub fn standalone_face(data: &[u8], index: u32) -> Option<Vec<u8>> {
    if data.get(0..4)? != TTC_TAG {
        return (index == 0).then(|| data.to_vec());
    }
    let count = read_u32(data, 8)?;
    if index >= count {
        return None;
    }
    let face = read_u32(data, OFFSET_TABLE_SIZE + 4 * index as usize)? as usize;
    let num_tables = read_u16(data, face + 4)? as usize;
    let directory = OFFSET_TABLE_SIZE + num_tables * TABLE_RECORD_SIZE;
    let mut standalone = data.to_vec();
    standalone
        .get_mut(..directory)?
        .copy_from_slice(data.get(face..face + directory)?);
    Some(standalone)
}

/// Returns whether every face in a font file stores outlines only in a table the renderer cannot
/// draw, such as Apple's `hvgl` (PingFang on macOS 15 and later). Reads only the table directories.
pub fn has_only_unsupported_outlines(reader: &mut (impl Read + Seek)) -> Option<bool> {
    let header: [u8; 12] = read_array(reader)?;
    let face_offsets = if &header[0..4] == TTC_TAG {
        let count = u32::from_be_bytes(header[8..12].try_into().ok()?);
        (0..count)
            .map(|_| read_array::<4>(reader).map(|offset| u32::from_be_bytes(offset) as u64))
            .collect::<Option<Vec<_>>>()?
    } else {
        vec![0]
    };
    for offset in face_offsets {
        reader.seek(SeekFrom::Start(offset + 4)).ok()?;
        let num_tables = u16::from_be_bytes(read_array(reader)?);
        reader.seek(SeekFrom::Current(6)).ok()?;
        let mut tags = Vec::with_capacity(num_tables as usize);
        for _ in 0..num_tables {
            let record: [u8; 16] = read_array(reader)?;
            tags.push([record[0], record[1], record[2], record[3]]);
        }
        let drawable = tags.iter().any(|tag| OUTLINE_TABLES.contains(&tag));
        if drawable || !tags.contains(b"hvgl") {
            return Some(false);
        }
    }
    Some(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    fn face(tags: &[&[u8; 4]]) -> Vec<u8> {
        let mut data = 0x0001_0000u32.to_be_bytes().to_vec();
        data.extend((tags.len() as u16).to_be_bytes());
        data.extend([0; 6]);
        for tag in tags {
            data.extend(*tag);
            data.extend([0; 12]);
        }
        data
    }

    fn collection(faces: &[Vec<u8>]) -> Vec<u8> {
        let mut data = TTC_TAG.to_vec();
        data.extend(0x0001_0000u32.to_be_bytes());
        data.extend((faces.len() as u32).to_be_bytes());
        let mut offset = 12 + faces.len() * 4;
        for face in faces {
            data.extend((offset as u32).to_be_bytes());
            offset += face.len();
        }
        faces.iter().for_each(|face| data.extend(face));
        data
    }

    fn check(data: Vec<u8>) -> Option<bool> {
        has_only_unsupported_outlines(&mut Cursor::new(data))
    }

    #[test]
    fn detects_collections_with_only_hvgl_outlines() {
        let hvgl = face(&[b"cmap", b"fvar", b"hvgl", b"name"]);
        assert_eq!(check(collection(&[hvgl.clone(), hvgl])), Some(true));
    }

    #[test]
    fn accepts_fonts_with_drawable_outlines() {
        assert_eq!(check(face(&[b"cmap", b"glyf", b"loca"])), Some(false));
        assert_eq!(check(face(&[b"CFF ", b"cmap"])), Some(false));
        let mixed = collection(&[face(&[b"hvgl"]), face(&[b"CFF2"])]);
        assert_eq!(check(mixed), Some(false));
    }

    #[test]
    fn ignores_truncated_data() {
        assert_eq!(check(vec![0; 6]), None);
        let mut truncated = face(&[b"hvgl", b"cmap"]);
        truncated.truncate(20);
        assert_eq!(check(truncated), None);
    }

    #[test]
    fn moves_the_requested_face_to_the_front_of_a_collection() {
        let first = face(&[b"cmap", b"glyf"]);
        let second = face(&[b"CFF ", b"name", b"OS/2"]);
        let data = collection(&[first, second.clone()]);

        let standalone = standalone_face(&data, 1).unwrap();
        assert_eq!(standalone.len(), data.len());
        assert_eq!(&standalone[..second.len()], &second[..]);
        assert_eq!(standalone_face(&data, 2), None);
    }

    #[test]
    fn keeps_single_fonts_unchanged() {
        let single = face(&[b"cmap", b"glyf"]);
        assert_eq!(standalone_face(&single, 0), Some(single.clone()));
        assert_eq!(standalone_face(&single, 1), None);
    }
}
