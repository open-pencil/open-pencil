//! Parsing `openpencil://` links into what the app should open, join, or hand to sign-in.

use url::Url;

#[derive(Debug, PartialEq, Eq)]
pub struct DeepLinkOpen {
    pub file: String,
    pub node: Option<String>,
}

/// A collaboration room to open, from `openpencil://join?room=<id>`.
#[derive(Debug, PartialEq, Eq)]
pub struct DeepLinkJoin {
    pub room: String,
}

/// An OpenPencil Cloud invitation or a document shared by link, from
/// `openpencil://cloud?url=<link>#<secret>`: the web link on its server, `/<invitations|share>/<id>`,
/// with its secret in the deep link's fragment. The server is the web link's origin.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct CloudLink {
    pub kind: CloudLinkKind,
    pub id: String,
    pub server: String,
    pub secret: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum CloudLinkKind {
    Invitations,
    Share,
}

#[derive(Debug, PartialEq, Eq)]
pub enum DeepLink {
    Open(DeepLinkOpen),
    Join(DeepLinkJoin),
    OAuth(OAuthCallback),
    Cloud(CloudLink),
}

#[derive(Debug, PartialEq, Eq)]
pub enum DeepLinkError {
    UnknownAction(String),
    MissingFile,
    AbsolutePath,
    ParentSegment,
    BadExtension,
    BadRoom,
    BadOAuthProvider,
    BadCloudLink,
}

/// Room IDs are 32 lowercase base36 characters (`ROOM_ID_LENGTH` and `ROOM_ID_CHARS` in
/// `src/constants.ts`); anything else is refused before it reaches the frontend.
const ROOM_ID_LENGTH: usize = 32;

fn is_room_id(room: &str) -> bool {
    room.len() == ROOM_ID_LENGTH
        && room
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit())
}

pub fn parse_deep_link(url: &Url) -> Result<DeepLink, DeepLinkError> {
    // openpencil://<action>?…  → host is the action.
    match url.host_str().unwrap_or("") {
        "open" => parse_open_url(url).map(DeepLink::Open),
        "join" => parse_join_url(url).map(DeepLink::Join),
        "oauth" => parse_oauth_url(url)
            .map(DeepLink::OAuth)
            .ok_or(DeepLinkError::BadOAuthProvider),
        "cloud" => parse_cloud_url(url)
            .map(DeepLink::Cloud)
            .ok_or(DeepLinkError::BadCloudLink),
        action => Err(DeepLinkError::UnknownAction(action.to_string())),
    }
}

fn parse_join_url(url: &Url) -> Result<DeepLinkJoin, DeepLinkError> {
    let room = url
        .query_pairs()
        .find(|(key, _)| key == "room")
        .map(|(_, value)| value.into_owned())
        .filter(|room| is_room_id(room))
        .ok_or(DeepLinkError::BadRoom)?;
    Ok(DeepLinkJoin { room })
}

/// Invitation and share IDs are UUIDs, and their secrets 32 to 128 hex characters (the Cloud
/// sharing contract); the web link must be an `http` or `https` address without credentials,
/// query, or fragment.
fn parse_cloud_url(url: &Url) -> Option<CloudLink> {
    if !matches!(url.path(), "" | "/") {
        return None;
    }
    let link = url
        .query_pairs()
        .find(|(key, _)| key == "url")
        .and_then(|(_, value)| Url::parse(&value).ok())
        .filter(|link| {
            matches!(link.scheme(), "http" | "https")
                && link.host_str().is_some()
                && link.username().is_empty()
                && link.password().is_none()
                && link.query().is_none()
                && link.fragment().is_none()
        })?;
    let mut segments = link.path_segments()?;
    let kind = match segments.next()? {
        "invitations" => CloudLinkKind::Invitations,
        "share" => CloudLinkKind::Share,
        _ => return None,
    };
    let id = segments.next().filter(|id| is_uuid(id))?.to_owned();
    if segments.next().is_some() {
        return None;
    }
    let secret = url
        .fragment()
        .filter(|secret| is_secret(secret))?
        .to_owned();
    Some(CloudLink {
        kind,
        id,
        server: link.origin().ascii_serialization(),
        secret,
    })
}

fn is_uuid(value: &str) -> bool {
    value.len() == 36
        && value.bytes().enumerate().all(|(index, byte)| match index {
            8 | 13 | 18 | 23 => byte == b'-',
            _ => byte.is_ascii_hexdigit(),
        })
}

fn is_secret(value: &str) -> bool {
    (32..=128).contains(&value.len()) && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

/// An OAuth redirect relayed by the web app's callback page: `openpencil://oauth/<provider>?…`.
/// The query goes to the webview untouched; the attempt that started sign-in checks its state.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct OAuthCallback {
    pub provider: String,
    pub query: String,
}

pub fn parse_oauth_url(url: &Url) -> Option<OAuthCallback> {
    if url.host_str() != Some("oauth") {
        return None;
    }
    let provider = url.path().strip_prefix('/')?;
    if provider.is_empty() || !provider.bytes().all(|byte| byte.is_ascii_lowercase()) {
        return None;
    }
    Some(OAuthCallback {
        provider: provider.to_owned(),
        query: url
            .query()
            .map(|query| format!("?{query}"))
            .unwrap_or_default(),
    })
}

pub fn parse_open_url(url: &Url) -> Result<DeepLinkOpen, DeepLinkError> {
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
    // `.` is refused here as well as in `paths::path_ends_with_segments`: a link that carried one
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

#[cfg(test)]
mod tests {
    use super::*;

    fn oauth(url: &str) -> Option<OAuthCallback> {
        parse_oauth_url(&Url::parse(url).unwrap())
    }

    #[test]
    fn passes_an_oauth_redirect_through_with_its_provider() {
        assert_eq!(
            oauth("openpencil://oauth/openrouter?code=abc&state=xyz"),
            Some(OAuthCallback {
                provider: "openrouter".to_owned(),
                query: "?code=abc&state=xyz".to_owned(),
            })
        );
    }

    #[test]
    fn refuses_an_oauth_link_without_a_plain_provider() {
        assert_eq!(oauth("openpencil://oauth?code=abc"), None);
        assert_eq!(oauth("openpencil://oauth/open/router?code=abc"), None);
        assert_eq!(oauth("openpencil://open?file=a.pen"), None);
    }

    const CLOUD_ID: &str = "0b6f4f9e-3c1a-4d7e-9a52-6f1c2d3e4f50";
    const CLOUD_SECRET: &str = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";

    fn cloud(url: &str) -> Result<DeepLink, DeepLinkError> {
        parse_deep_link(&Url::parse(url).unwrap())
    }

    #[test]
    fn cloud_links_carry_kind_id_server_and_secret() {
        assert_eq!(
            cloud(&format!(
                "openpencil://cloud?url=https%3A%2F%2Fcloud.example.com%2Finvitations%2F{CLOUD_ID}#{CLOUD_SECRET}"
            )),
            Ok(DeepLink::Cloud(CloudLink {
                kind: CloudLinkKind::Invitations,
                id: CLOUD_ID.into(),
                server: "https://cloud.example.com".into(),
                secret: CLOUD_SECRET.into(),
            }))
        );
        assert!(matches!(
            cloud(&format!(
                "openpencil://cloud?url=http%3A%2F%2F192.168.1.20%3A3000%2Fshare%2F{CLOUD_ID}#{CLOUD_SECRET}"
            )),
            Ok(DeepLink::Cloud(CloudLink { kind: CloudLinkKind::Share, ref server, .. }))
                if server == "http://192.168.1.20:3000"
        ));
        // The editor builds links with ufo, which leaves `:` and `/` in a query value as they are.
        assert!(matches!(
            cloud(&format!(
                "openpencil://cloud?url=https://cloud.example.com/share/{CLOUD_ID}#{CLOUD_SECRET}"
            )),
            Ok(DeepLink::Cloud(CloudLink { ref server, .. })) if server == "https://cloud.example.com"
        ));
    }

    #[test]
    fn cloud_links_refuse_anything_else() {
        let site = "https%3A%2F%2Fcloud.example.com";
        for url in [
            format!("openpencil://cloud?url={site}%2Fdocuments%2F{CLOUD_ID}#{CLOUD_SECRET}"),
            format!("openpencil://cloud?url={site}%2Fshare%2Fnot-a-uuid#{CLOUD_SECRET}"),
            format!("openpencil://cloud?url={site}%2Fshare%2F{CLOUD_ID}%2Fextra#{CLOUD_SECRET}"),
            format!("openpencil://cloud?url={site}%2Fshare%2F{CLOUD_ID}"),
            format!("openpencil://cloud?url={site}%2Fshare%2F{CLOUD_ID}#short"),
            format!("openpencil://cloud?url={site}%2Fshare%2F{CLOUD_ID}#{}", "g".repeat(64)),
            format!("openpencil://cloud?url={site}%2Fshare%2F{CLOUD_ID}%3Fx%3D1#{CLOUD_SECRET}"),
            format!("openpencil://cloud?url={site}%2Fshare%2F{CLOUD_ID}%23{CLOUD_SECRET}"),
            format!("openpencil://cloud/share/{CLOUD_ID}?url={site}%2Fshare%2F{CLOUD_ID}#{CLOUD_SECRET}"),
            format!("openpencil://cloud#{CLOUD_SECRET}"),
            format!("openpencil://cloud?url=file%3A%2F%2F%2Fshare%2F{CLOUD_ID}#{CLOUD_SECRET}"),
            format!(
                "openpencil://cloud?url=https%3A%2F%2Fa%3Ab%40cloud.example.com%2Fshare%2F{CLOUD_ID}#{CLOUD_SECRET}"
            ),
        ] {
            assert_eq!(cloud(&url), Err(DeepLinkError::BadCloudLink), "{url}");
        }
    }

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

    const ROOM: &str = "abcdefghijklmnopqrstuvwxyz012345";

    #[test]
    fn join_with_room() {
        assert_eq!(
            parse_deep_link(&Url::parse(&format!("openpencil://join?room={ROOM}")).unwrap()),
            Ok(DeepLink::Join(DeepLinkJoin { room: ROOM.into() }))
        );
    }

    #[test]
    fn join_refuses_a_room_that_is_not_a_room_id() {
        for url in [
            "openpencil://join".to_string(),
            "openpencil://join?room=".to_string(),
            "openpencil://join?room=short".to_string(),
            format!("openpencil://join?room={}", ROOM.to_uppercase()),
            format!("openpencil://join?room={ROOM}x"),
            format!("openpencil://join?room={}%2F", &ROOM[..31]),
        ] {
            assert_eq!(
                parse_deep_link(&Url::parse(&url).unwrap()),
                Err(DeepLinkError::BadRoom),
                "{url}"
            );
        }
    }

    #[test]
    fn deep_link_routes_open_and_refuses_other_actions() {
        assert!(matches!(
            parse_deep_link(&Url::parse("openpencil://open?file=a.pen").unwrap()),
            Ok(DeepLink::Open(_))
        ));
        assert_eq!(
            parse_deep_link(&Url::parse("openpencil://export?file=a.pen").unwrap()),
            Err(DeepLinkError::UnknownAction("export".into()))
        );
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
}
