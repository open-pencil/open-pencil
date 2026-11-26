//! Raw exports for WebAssembly hosts, with no binding generator: the host copies a file into
//! memory from `alloc`, opens it, and reads results as typed arrays over the module's memory.
//! One document and one expansion are held at a time.

use std::cell::RefCell;

use crate::Document;
use crate::expand::Unresolved;
use crate::index::NONE;

#[derive(Default)]
struct State {
    document: Option<Document>,
    error: String,
    /// Per occurrence of the last expanded page: GUID session, GUID local, parent, flags.
    occurrences: Vec<u32>,
    unresolved: Unresolved,
    placements: u32,
}

thread_local! {
    static STATE: RefCell<State> = RefCell::new(State::default());
}

/// Bytes for the host to fill, then hand to `open`, which frees them.
#[unsafe(no_mangle)]
pub extern "C" fn alloc(length: usize) -> *mut u8 {
    Box::into_raw(vec![0u8; length].into_boxed_slice()).cast()
}

/// Opens the `.fig` file the host wrote at `pointer`. Returns the record count, or -1 with
/// `error` describing why it could not be read.
///
/// # Safety
/// `pointer` and `length` must come from one `alloc` call, and the host must not use them after.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn open(pointer: *mut u8, length: usize) -> i32 {
    // SAFETY: the caller passes back the slice `alloc` leaked.
    let file = unsafe { Box::from_raw(core::ptr::slice_from_raw_parts_mut(pointer, length)) };
    STATE.with_borrow_mut(|state| {
        *state = State::default();
        match Document::open(&file) {
            Ok(document) => {
                let count = document.index.records.len() as i32;
                state.document = Some(document);
                count
            }
            Err(error) => {
                state.error = error.to_string();
                -1
            }
        }
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn error() -> *const u8 {
    STATE.with_borrow(|state| state.error.as_ptr())
}

#[unsafe(no_mangle)]
pub extern "C" fn error_length() -> usize {
    STATE.with_borrow(|state| state.error.len())
}

#[unsafe(no_mangle)]
pub extern "C" fn page_count() -> u32 {
    STATE.with_borrow(|state| {
        state
            .document
            .as_ref()
            .map_or(0, |document| document.index.pages.len() as u32)
    })
}

/// Half of a page's GUID: its session for `part` 0, its local id otherwise.
#[unsafe(no_mangle)]
pub extern "C" fn page_guid(page: u32, part: u32) -> u32 {
    STATE.with_borrow(|state| {
        let Some(document) = &state.document else {
            return NONE;
        };
        let Some(&record) = document.index.pages.get(page as usize) else {
            return NONE;
        };
        let guid = document.index.records[record as usize].guid;
        if part == 0 {
            (guid >> 32) as u32
        } else {
            guid as u32
        }
    })
}

/// Expands a page. Returns its occurrence count, or -1 for a page that does not exist.
#[unsafe(no_mangle)]
pub extern "C" fn expand_page(page: u32) -> i32 {
    STATE.with_borrow_mut(|state| {
        let Some(document) = &state.document else {
            return -1;
        };
        let Some(expansion) = document.expand_page(page as usize) else {
            return -1;
        };
        let records = &document.index.records;
        let mut rows = Vec::with_capacity(expansion.occurrences.len() * 4);
        for occurrence in &expansion.occurrences {
            let guid = records[occurrence.record as usize].guid;
            rows.extend([
                (guid >> 32) as u32,
                guid as u32,
                occurrence.parent,
                occurrence.flags,
            ]);
        }
        let count = expansion.occurrences.len() as i32;
        state.unresolved = expansion.unresolved;
        state.placements = expansion.placements.len() as u32;
        state.occurrences = rows;
        count
    })
}

/// The last expanded page's occurrences, four `u32`s each: the GUID's session and local id of
/// the record placed, the parent occurrence (`u32::MAX` at the page), and the flags.
#[unsafe(no_mangle)]
pub extern "C" fn occurrences() -> *const u32 {
    STATE.with_borrow(|state| state.occurrences.as_ptr())
}

/// How many property layers and derived entries the last expansion placed.
#[unsafe(no_mangle)]
pub extern "C" fn placements() -> u32 {
    STATE.with_borrow(|state| state.placements)
}

/// What the last expansion could not resolve, by `which`: unresolved property layers, derived
/// entries, structural layers, loops, missing components, swaps on non-instances.
#[unsafe(no_mangle)]
pub extern "C" fn unresolved(which: u32) -> u32 {
    STATE.with_borrow(|state| {
        let unresolved = &state.unresolved;
        match which {
            0 => unresolved.properties,
            1 => unresolved.derived,
            2 => unresolved.structural,
            3 => unresolved.loops,
            4 => unresolved.missing_components,
            5 => unresolved.swaps_on_non_instances,
            _ => NONE,
        }
    })
}
