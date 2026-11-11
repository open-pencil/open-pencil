//! The file scope as this app configures it.
//!
//! `desktop/tauri.conf.json` turns on `requireLiteralLeadingDot`, so a `**` allow never reaches a
//! path component that starts with a dot: hidden files stay out of the general scope. The one
//! hidden folder the app writes itself is a project's `.opencanvas`, and these tests hold both
//! halves of that arrangement — the general scope does not reach it, and the folder is allowed by
//! name — against the same `glob` matcher the Tauri file scope matches a path with.

use std::path::{Path, MAIN_SEPARATOR as SEP};

use glob::{MatchOptions, Pattern};
use serde_json::Value;

/// The match options `tauri::fs::Scope` builds from `requireLiteralLeadingDot: true`.
fn options() -> MatchOptions {
    MatchOptions {
        require_literal_separator: true,
        require_literal_leading_dot: true,
        ..MatchOptions::default()
    }
}

/// The capability file this app ships, which is the source of every path the scope allows.
fn capability() -> Value {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("capabilities/default.json");
    let text = std::fs::read_to_string(&path)
        .unwrap_or_else(|error| panic!("{} ships with the crate: {error}", path.display()));
    serde_json::from_str(&text).expect("the capability file is JSON")
}

/// The `allow` patterns one permission carries, which is what the scope matches a path against.
fn allowed_paths(identifier: &str) -> Vec<String> {
    let capability = capability();
    let permissions = match capability["permissions"].as_array() {
        Some(permissions) => permissions,
        None => panic!("the capability file lists permissions"),
    };
    for permission in permissions {
        if permission["identifier"].as_str() != Some(identifier) {
            continue;
        }
        let entries = match permission["allow"].as_array() {
            Some(entries) => entries,
            None => return Vec::new(),
        };
        return entries
            .iter()
            .filter_map(|entry| entry["path"].as_str().map(str::to_owned))
            .collect();
    }
    Vec::new()
}

/// Whether one pattern admits this path.
fn matches(pattern: &str, path: &str) -> bool {
    Pattern::new(pattern)
        .unwrap_or_else(|error| panic!("{pattern} is a valid glob: {error}"))
        .matches_path_with(Path::new(path), options())
}

/// Whether any of the patterns a permission carries admits this path.
fn any_allows(identifier: &str, path: &str) -> bool {
    allowed_paths(identifier)
        .iter()
        .any(|pattern| matches(pattern, path))
}

/// A path inside a project, written the way this platform writes one.
fn project_path(inside: &str) -> String {
    format!("work{SEP}site{SEP}{inside}")
}

/// The permissions a document is read and written through, and the one that makes its folder.
const PERMISSIONS: [&str; 3] = [
    "fs:allow-read-file",
    "fs:allow-write-file",
    "fs:allow-mkdir",
];

#[test]
fn a_document_anywhere_is_reachable() {
    for identifier in PERMISSIONS {
        assert!(
            any_allows(identifier, &project_path("design.fig")),
            "{identifier} must reach a document outside the app's own folders"
        );
    }
}

#[test]
fn the_general_scope_stops_at_a_hidden_folder() {
    let hidden = [
        project_path(&format!(".opencanvas{SEP}drift.json")),
        project_path(&format!(".git{SEP}config")),
        project_path(&format!(".ssh{SEP}id_rsa")),
        ".bashrc".to_owned(),
    ];
    for identifier in PERMISSIONS {
        assert!(
            allowed_paths(identifier)
                .iter()
                .any(|pattern| pattern == "**"),
            "{identifier} keeps the general `**` scope, which the rest of the app relies on"
        );
        for path in &hidden {
            assert!(
                !matches("**", path),
                "`**` reached {path}; a hidden path must never get through the general scope"
            );
        }
        // The sidecar is the one hidden path the app writes, and it is allowed by name; the rest
        // of them are allowed by nothing at all.
        for path in &hidden[1..] {
            assert!(
                !any_allows(identifier, path),
                "{identifier} reached {path}, which no permission may allow"
            );
        }
    }
}

#[test]
fn a_project_sidecar_is_allowed_by_name() {
    let sidecar = project_path(&format!(".opencanvas{SEP}drift.json"));
    for identifier in ["fs:allow-read-file", "fs:allow-write-file"] {
        assert!(
            any_allows(identifier, &sidecar),
            "{identifier} must reach the project sidecar the live pages keep"
        );
    }
    assert!(
        any_allows("fs:allow-mkdir", &project_path(".opencanvas")),
        "the folder the sidecar lives in has to be creatable"
    );
}

#[test]
fn no_hidden_path_beyond_the_sidecar_is_allowed() {
    for identifier in PERMISSIONS {
        for pattern in allowed_paths(identifier) {
            if pattern == "**" || pattern.starts_with('$') {
                // The general scope and the app's own files under a home folder resolve outside a
                // project, and this test reads them as they are written.
                continue;
            }
            assert!(
                pattern.contains(".opencanvas"),
                "{identifier} allows {pattern}, which is a hidden path beyond the project sidecar"
            );
        }
    }
}
