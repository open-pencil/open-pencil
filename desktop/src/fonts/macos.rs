//! macOS-only knowledge of installed fonts that the catalog cannot report.

use objc2_core_foundation::{CFArray, CFDictionary, CFRetained, CFString, CFURL};
use objc2_core_text::{kCTFontFamilyNameAttribute, kCTFontURLAttribute, CTFontDescriptor};
use std::collections::HashSet;
use std::fs::File;
use std::path::PathBuf;

/// Returns whether macOS lists `family` but stores all its faces in outline formats the renderer
/// cannot draw. Such fonts are left out of the catalog, so this separates them from missing ones.
pub fn family_has_only_unsupported_outlines(family: &str) -> bool {
    let paths = family_font_paths(family);
    !paths.is_empty()
        && paths.iter().all(|path| {
            File::open(path)
                .ok()
                .and_then(|mut file| super::sfnt::has_only_unsupported_outlines(&mut file))
                .unwrap_or(false)
        })
}

fn family_font_paths(family: &str) -> HashSet<PathBuf> {
    let name = CFString::from_str(family);
    // SAFETY: the family name attribute takes a CFString, and Core Text returns an array of font
    // descriptors whose URL attribute, when present, is a CFURL.
    unsafe {
        let attributes = CFDictionary::<CFString, CFString>::from_slices(
            &[kCTFontFamilyNameAttribute],
            &[&*name],
        );
        let descriptor = CTFontDescriptor::with_attributes(attributes.as_opaque());
        let Some(matches) = descriptor.matching_font_descriptors(None) else {
            return HashSet::new();
        };
        let matches: CFRetained<CFArray<CTFontDescriptor>> = CFRetained::cast_unchecked(matches);
        (0..matches.len())
            .filter_map(|index| matches.get(index))
            .filter_map(|descriptor| descriptor.attribute(kCTFontURLAttribute))
            .filter_map(|url| url.downcast::<CFURL>().ok())
            .filter_map(|url| url.to_file_path())
            .collect()
    }
}
