//! Running a helper program without anything of it reaching the screen.

use std::process::Command;

/// Windows gives a spawned console program a console window of its own unless it is asked not to,
/// which flashes a black window over the editor while the panel waits for `git`, `gh`, or a
/// project's application. Everything the app runs reports through pipes, so no program needs one.
#[cfg(windows)]
pub(crate) fn hide_console_window(command: &mut Command) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    command.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
pub(crate) fn hide_console_window(_command: &mut Command) {}
