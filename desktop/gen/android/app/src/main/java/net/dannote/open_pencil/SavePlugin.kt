package net.dannote.open_pencil

import android.app.Activity
import android.net.Uri
import android.provider.OpenableColumns
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.File
import kotlin.concurrent.thread

@InvokeArg
class CopyToUriArgs {
  var uri: String = ""
  var sourcePath: String = ""
}

@InvokeArg
class UriArgs {
  var uri: String = ""
}

/**
 * Writes a file the webview produced into a document the user picked with the system
 * "save as" sheet.
 *
 * The directory picker (ACTION_CREATE_DOCUMENT) hands back a `content://` URI, which
 * `std::fs` cannot open — the desktop save path works on paths. Only the platform can
 * resolve that URI, so the copy happens here through the ContentResolver.
 */
class SavePlugin(private val activity: Activity) : Plugin(activity) {
  @Command
  fun copyToUri(invoke: Invoke) {
    val args = try {
      invoke.parseArgs(CopyToUriArgs::class.java)
    } catch (ex: Exception) {
      invoke.reject(ex.message ?: "save failed", null, null, null)
      return
    }

    val source = File(args.sourcePath)
    if (!source.isFile) {
      invoke.reject("source file not found: ${args.sourcePath}", null, null, null)
      return
    }

    // A design file is tens of megabytes and the provider on the other end may be a cloud
    // drive, so the copy and the provider's open both run off the main thread: this method
    // is called on it, and blocking there for longer than a few seconds is an ANR.
    thread(name = "openpencil-save") {
      try {
        val resolver = activity.contentResolver
        val uri = Uri.parse(args.uri)
        // "wt" truncates, which matters when the user picked a file that already exists.
        // Not every provider implements it, so fall back to the plain write mode.
        val target = try {
          resolver.openOutputStream(uri, "wt")
        } catch (_: Exception) {
          resolver.openOutputStream(uri)
        }
        if (target == null) {
          invoke.reject("cannot open for writing: ${args.uri}", null, null, null)
          return@thread
        }

        target.use { out -> source.inputStream().use { it.copyTo(out, 64 * 1024) } }
        invoke.resolve()
      } catch (ex: Exception) {
        invoke.reject(ex.message ?: "save failed", null, null, null)
      }
    }
  }

  /**
   * The name the picked document has in the provider, such as "Final.fig".
   *
   * The save sheet lets the person rename the file, and a `content://` URI carries no name of
   * its own, so the editor asks here instead of keeping the name the document had before.
   */
  @Command
  fun displayName(invoke: Invoke) {
    try {
      val args = invoke.parseArgs(UriArgs::class.java)
      val uri = Uri.parse(args.uri)
      val name = activity.contentResolver
        .query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
        ?.use { cursor ->
          if (!cursor.moveToFirst()) return@use null
          val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
          if (index < 0) null else cursor.getString(index)
        }
      if (name.isNullOrEmpty()) {
        invoke.reject("cannot read the document name: ${args.uri}", null, null, null)
        return
      }
      val payload = JSObject()
      payload.put("name", name)
      invoke.resolve(payload)
    } catch (ex: Exception) {
      invoke.reject(ex.message ?: "cannot read the document name", null, null, null)
    }
  }
}
