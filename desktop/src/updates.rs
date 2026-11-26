//! Update checks on the channel the editor asks for: stable releases or nightly builds.
//!
//! The updater plugin's own `check` reads only the feed in `tauri.conf.json` and offers only newer
//! versions. This picks the channel's feed, and on the other channel than the running build's it
//! offers that channel's newest build even when it is older, so switching from nightly back to
//! stable takes effect at the next check. The update goes into the webview's resources as the
//! plugin's own check puts it, so the plugin's download and install commands take it from there.

use semver::Version;
use serde::{Deserialize, Serialize};
use tauri::{Manager, ResourceId, Runtime, State, Webview};
use tauri_plugin_updater::UpdaterExt;
use url::Url;

use crate::capabilities::DesktopCapabilities;

const STABLE_FEED: &str =
    "https://github.com/open-pencil/open-pencil/releases/latest/download/latest.json";
const NIGHTLY_FEED: &str =
    "https://github.com/open-pencil/open-pencil/releases/download/nightly/latest.json";
/// The pre-release label of nightly builds, which are versioned `X.Y.Z-nightly.YYYYMMDD`.
const NIGHTLY_LABEL: &str = "nightly";

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum UpdateChannel {
    Stable,
    Nightly,
}

impl UpdateChannel {
    /// The channel a build belongs to, read from its version.
    pub fn of(version: &Version) -> Self {
        if version.pre.as_str().split('.').next() == Some(NIGHTLY_LABEL) {
            Self::Nightly
        } else {
            Self::Stable
        }
    }

    fn feed(self) -> &'static str {
        match self {
            Self::Stable => STABLE_FEED,
            Self::Nightly => NIGHTLY_FEED,
        }
    }
}

/// Whether a build at `current` following `channel` is offered `remote`: a newer version on its
/// own channel, or any other version on the other one, which moves it to that channel.
pub fn offers(channel: UpdateChannel, current: &Version, remote: &Version) -> bool {
    if UpdateChannel::of(current) == channel {
        remote > current
    } else {
        remote != current
    }
}

/// What the plugin's JavaScript `Update` is built from, as the plugin's own check returns it.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMetadata {
    rid: ResourceId,
    current_version: String,
    version: String,
    date: Option<String>,
    body: Option<String>,
    raw_json: serde_json::Value,
}

#[tauri::command]
pub async fn check_for_update<R: Runtime>(
    webview: Webview<R>,
    capabilities: State<'_, DesktopCapabilities>,
    channel: UpdateChannel,
) -> Result<Option<UpdateMetadata>, String> {
    // Without self-updates the updater plugin is not registered, and asking it would panic.
    if !capabilities.self_update {
        return Err("This build does not update itself".into());
    }
    let feed = Url::parse(channel.feed()).map_err(|error| error.to_string())?;
    let updater = webview
        .updater_builder()
        .endpoints(vec![feed])
        .map_err(|error| error.to_string())?
        .version_comparator(move |current, release| offers(channel, &current, &release.version))
        .build()
        .map_err(|error| error.to_string())?;
    let Some(update) = updater.check().await.map_err(|error| error.to_string())? else {
        return Ok(None);
    };
    // The feed's own date, as the plugin's check reports it, without parsing it again.
    let date = update
        .raw_json
        .get("pub_date")
        .and_then(serde_json::Value::as_str)
        .map(str::to_owned);
    Ok(Some(UpdateMetadata {
        current_version: update.current_version.clone(),
        version: update.version.clone(),
        date,
        body: update.body.clone(),
        raw_json: update.raw_json.clone(),
        rid: webview.resources_table().add(update),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn version(text: &str) -> Version {
        Version::parse(text).expect("a test version")
    }

    #[test]
    fn reads_the_channel_from_the_version() {
        assert_eq!(UpdateChannel::of(&version("0.17.0")), UpdateChannel::Stable);
        assert_eq!(
            UpdateChannel::of(&version("0.17.0-beta.5")),
            UpdateChannel::Stable
        );
        assert_eq!(
            UpdateChannel::of(&version("0.17.0-nightly.20261116")),
            UpdateChannel::Nightly
        );
        assert_eq!(
            UpdateChannel::of(&version("0.17.0-nightly.20261116.2")),
            UpdateChannel::Nightly
        );
    }

    #[test]
    fn offers_only_newer_versions_on_the_build_own_channel() {
        let nightly = UpdateChannel::Nightly;
        let stable = UpdateChannel::Stable;
        assert!(offers(stable, &version("0.16.2"), &version("0.17.0")));
        assert!(!offers(stable, &version("0.17.0"), &version("0.17.0")));
        assert!(!offers(stable, &version("0.17.0"), &version("0.16.2")));
        assert!(offers(
            nightly,
            &version("0.17.0-nightly.20261116"),
            &version("0.17.0-nightly.20261117")
        ));
        assert!(!offers(
            nightly,
            &version("0.17.0-nightly.20261117"),
            &version("0.17.0-nightly.20261117")
        ));
    }

    #[test]
    fn moves_to_the_other_channel_even_to_an_older_version() {
        // A nightly switched to stable takes the current stable release at once.
        assert!(offers(
            UpdateChannel::Stable,
            &version("0.17.0-nightly.20261116"),
            &version("0.16.2")
        ));
        // A stable or beta build switched to nightly takes the newest nightly.
        assert!(offers(
            UpdateChannel::Nightly,
            &version("0.17.0-beta.5"),
            &version("0.17.0-nightly.20261116")
        ));
    }
}
