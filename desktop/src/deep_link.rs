use std::path::{Component, Path, PathBuf};

use url::Url;

#[derive(Debug, PartialEq, Eq)]
pub struct DeepLinkOpen {
    pub file: String,
    pub node: Option<String>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum DeepLinkError {
    UnknownAction(String),
    MissingFile,
    AbsolutePath,
    ParentSegment,
    BadExtension,
}

pub fn parse_open_url(url: &Url) -> Result<DeepLinkOpen, DeepLinkError> {
    // openpencil://open?…  → host is the action.
    let action = url.host_str().unwrap_or("");
    if action != "open" {
        return Err(DeepLinkError::UnknownAction(action.to_string()));
    }
    let mut file = None;
    let mut node = None;
    for (k, v) in url.query_pairs() {
        match k.as_ref() {
            "file" => file = Some(v.into_owned()),
            "node" => node = Some(v.into_owned()),
            _ => {}
        }
    }
    let file = file
        .filter(|f| !f.is_empty())
        .ok_or(DeepLinkError::MissingFile)?;
    let is_windows_abs = file.len() > 1 && file.as_bytes()[1] == b':';
    if file.starts_with('/') || file.starts_with('\\') || is_windows_abs {
        return Err(DeepLinkError::AbsolutePath);
    }
    // `.` is refused here as well as in `path_ends_with_segments`: a link that carried one
    // would be queued and then could never match an open tab or a picked file.
    if file.split(['/', '\\']).any(|seg| seg == ".." || seg == ".") {
        return Err(DeepLinkError::ParentSegment);
    }
    let lower = file.to_ascii_lowercase();
    if !(lower.ends_with(".pen") || lower.ends_with(".fig")) {
        return Err(DeepLinkError::BadExtension);
    }
    Ok(DeepLinkOpen {
        file,
        node: node.filter(|n| !n.is_empty()),
    })
}

/// Whether `candidate` ends with `suffix` as a whole sequence of path segments.
///
/// The link carries a repository-relative path, the candidate is an absolute path
/// from an open tab or the file picker, and the two may disagree on case: on
/// macOS and Windows the default filesystem is case-insensitive, so `Web/Design`
/// and `web/design` name the same file and a case-sensitive comparison would
/// cancel a link that points at an already open document.
///
/// The rule is per-platform, not per-volume: ASCII-case-insensitive on macOS and
/// Windows, exact on Linux. Deliberately ASCII only — macOS folds the full Unicode
/// case table, matching that here would mean carrying a Unicode fold for a gain
/// nobody links against. A case-sensitive APFS volume is likewise not probed;
/// the cost of being wrong there is a link that focuses a same-named file in a
/// different directory case. Nothing is read and nothing is opened here: the command
/// resolves and compares path strings, never file contents.
///
/// `candidate` is canonicalized so a `..`-laden or symlink-prefixed tab path still
/// compares by its real segments, and the literal path is tried as well: a symlink
/// *inside* the trailing segments (a monorepo `packages/web -> ../apps/web`) makes
/// the two disagree, and the link should match either spelling. A candidate that
/// cannot be canonicalized at all — the file moved, or the volume went away — is
/// compared by its literal segments alone rather than failing the match.
///
/// `async` so `canonicalize` runs off the main thread: it hits the filesystem, and a
/// stale network mount can block for as long as its timeout.
#[tauri::command(async)]
pub fn path_matches_suffix(candidate: String, suffix: String) -> bool {
    let literal = PathBuf::from(&candidate);
    let canonical = literal.canonicalize().unwrap_or_else(|_| literal.clone());
    path_ends_with_segments(&canonical, &suffix) || path_ends_with_segments(&literal, &suffix)
}

fn segment_eq(left: &str, right: &str) -> bool {
    if cfg!(any(target_os = "macos", windows)) {
        left.eq_ignore_ascii_case(right)
    } else {
        left == right
    }
}

/// A suffix is a *relative* trailing path. `parse_open_url` already refuses an absolute
/// or `..`-bearing `file`, but this is the comparison every caller funnels through, so it
/// refuses them again rather than trusting its caller: an absolute suffix would otherwise
/// match on its segments alone, turning `/etc/hikyo.pen` into a relative lookup.
fn path_ends_with_segments(candidate: &Path, suffix: &str) -> bool {
    if suffix.starts_with('/') || suffix.starts_with('\\') || Path::new(suffix).is_absolute() {
        return false;
    }
    let wanted: Vec<&str> = suffix
        .split(['/', '\\'])
        .filter(|s| !s.is_empty())
        .collect();
    if wanted.is_empty() || wanted.iter().any(|seg| *seg == ".." || *seg == ".") {
        return false;
    }
    let actual: Vec<String> = candidate
        .components()
        .filter_map(|component| match component {
            Component::Normal(part) => Some(part.to_string_lossy().into_owned()),
            _ => None,
        })
        .collect();
    if actual.len() < wanted.len() {
        return false;
    }
    actual[actual.len() - wanted.len()..]
        .iter()
        .zip(&wanted)
        .all(|(have, want)| segment_eq(have, want))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(s: &str) -> Result<DeepLinkOpen, DeepLinkError> {
        parse_open_url(&Url::parse(s).unwrap())
    }

    #[test]
    fn open_with_file_and_node() {
        assert_eq!(
            parse("openpencil://open?file=web%2Fdesign%2Fhikyo.pen&node=Button%2FPrimary"),
            Ok(DeepLinkOpen {
                file: "web/design/hikyo.pen".into(),
                node: Some("Button/Primary".into())
            })
        );
    }

    #[test]
    fn node_is_optional() {
        assert_eq!(parse("openpencil://open?file=a.pen").unwrap().node, None);
    }

    #[test]
    fn unknown_action() {
        assert_eq!(
            parse("openpencil://export?file=a.pen"),
            Err(DeepLinkError::UnknownAction("export".into()))
        );
    }

    #[test]
    fn missing_file() {
        assert_eq!(parse("openpencil://open"), Err(DeepLinkError::MissingFile));
    }

    #[test]
    fn dot_segment_refused() {
        // The matcher refuses `.` too, so accepting it here would queue a link that can
        // never resolve against an open tab or a picked file.
        assert_eq!(
            parse("openpencil://open?file=web%2F.%2Fdesign.pen"),
            Err(DeepLinkError::ParentSegment)
        );
    }

    #[test]
    fn absolute_refused() {
        assert_eq!(
            parse("openpencil://open?file=%2FUsers%2Fx%2Fa.pen"),
            Err(DeepLinkError::AbsolutePath)
        );
        assert_eq!(
            parse("openpencil://open?file=C%3A%5Cx%5Ca.pen"),
            Err(DeepLinkError::AbsolutePath)
        );
    }

    #[test]
    fn parent_segment_refused() {
        assert_eq!(
            parse("openpencil://open?file=..%2Fa.pen"),
            Err(DeepLinkError::ParentSegment)
        );
        // The dots themselves percent-encoded: decoding happens before the check.
        assert_eq!(
            parse("openpencil://open?file=%2E%2E%2Fa.pen"),
            Err(DeepLinkError::ParentSegment)
        );
    }

    #[test]
    fn extension_checked() {
        assert_eq!(
            parse("openpencil://open?file=a.txt"),
            Err(DeepLinkError::BadExtension)
        );
        assert!(parse("openpencil://open?file=a.fig").is_ok());
    }

    #[test]
    fn suffix_matches_whole_trailing_segments() {
        assert!(path_ends_with_segments(
            Path::new("/r/hikyo/web/design/hikyo.pen"),
            "web/design/hikyo.pen"
        ));
        // A partial segment is not a segment: `redesign` must not satisfy `design`.
        assert!(!path_ends_with_segments(
            Path::new("/r/redesign/hikyo.pen"),
            "design/hikyo.pen"
        ));
        // A suffix longer than the path cannot match.
        assert!(!path_ends_with_segments(
            Path::new("/hikyo.pen"),
            "design/hikyo.pen"
        ));
        assert!(!path_ends_with_segments(Path::new("/r/hikyo.pen"), ""));
    }

    #[test]
    fn suffix_case_rule_follows_the_platform() {
        let folded = path_ends_with_segments(
            Path::new("/r/hikyo/Web/Design/Hikyo.pen"),
            "web/design/hikyo.pen",
        );
        assert_eq!(folded, cfg!(any(target_os = "macos", windows)));
    }

    #[test]
    fn suffix_accepts_backslash_separators() {
        assert!(path_ends_with_segments(
            Path::new("/r/web/design/hikyo.pen"),
            "web\\design\\hikyo.pen"
        ));
    }

    /// A unique directory under the system temp dir, removed by `TempTree::drop`.
    /// std only: the crate has no dev-dependency on a tempdir helper and one test
    /// does not earn one.
    struct TempTree(PathBuf);

    impl TempTree {
        fn new(tag: &str) -> Self {
            let unique = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("clock before the epoch")
                .as_nanos();
            let root = std::env::temp_dir().join(format!("openpencil-{tag}-{unique}"));
            std::fs::create_dir_all(&root).expect("create the temp tree");
            Self(root)
        }

        fn file(&self, relative: &str) -> PathBuf {
            let path = self.0.join(relative);
            std::fs::create_dir_all(path.parent().expect("a parent")).expect("create dirs");
            std::fs::write(&path, b"{}").expect("write the fixture");
            path
        }
    }

    impl Drop for TempTree {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    fn matches(candidate: &Path, suffix: &str) -> bool {
        path_matches_suffix(candidate.to_string_lossy().into_owned(), suffix.to_string())
    }

    #[test]
    fn command_matches_a_real_file_by_its_trailing_segments() {
        let tree = TempTree::new("exact");
        let file = tree.file("web/design/hikyo.pen");

        assert!(matches(&file, "web/design/hikyo.pen"));
        assert!(matches(&file, "hikyo.pen"));
        assert!(!matches(&file, "design/other.pen"));
        assert!(!matches(&file, "app/web/design/hikyo.pen"));
    }

    #[test]
    fn command_folds_case_only_where_the_filesystem_does() {
        let tree = TempTree::new("case");
        let file = tree.file("Web/Design/Hikyo.pen");

        assert_eq!(
            matches(&file, "web/design/hikyo.pen"),
            cfg!(any(target_os = "macos", windows))
        );
    }

    /// The reason the command compares the literal path as well as the canonical one:
    /// a symlink *inside* the trailing segments makes the two spellings disagree, and a
    /// link written against either of them must still find the file.
    #[cfg(unix)]
    #[test]
    fn command_matches_a_symlinked_trailing_directory() {
        let tree = TempTree::new("symlink");
        tree.file("apps/web/hikyo.pen");
        std::fs::create_dir_all(tree.0.join("packages")).expect("create packages");
        std::os::unix::fs::symlink(tree.0.join("apps/web"), tree.0.join("packages/web"))
            .expect("create the symlink");
        let through_link = tree.0.join("packages/web/hikyo.pen");

        // Only the literal spelling carries `packages`; `canonicalize` resolves it to `apps`.
        assert!(matches(&through_link, "packages/web/hikyo.pen"));
        assert!(matches(&through_link, "apps/web/hikyo.pen"));
    }

    #[test]
    fn command_falls_back_to_the_literal_path_when_the_file_is_gone() {
        // Nothing on disk, so `canonicalize` fails: the link must still match an open
        // tab whose document moved or whose volume went away.
        assert!(matches(
            Path::new("/r/hikyo/web/design/hikyo.pen"),
            "web/design/hikyo.pen"
        ));
    }

    #[test]
    fn command_refuses_an_absolute_or_dot_dot_suffix() {
        let tree = TempTree::new("relative");
        let file = tree.file("web/design/hikyo.pen");
        let absolute = file.to_string_lossy().into_owned();

        assert!(!matches(&file, &absolute));
        assert!(!matches(&file, "/web/design/hikyo.pen"));
        assert!(!matches(&file, "../design/hikyo.pen"));
        assert!(!matches(&file, "web/../design/hikyo.pen"));
        assert!(!matches(&file, "./hikyo.pen"));
        assert!(!matches(&file, ""));
    }
}
