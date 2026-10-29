package net.dannote.open_pencil

import android.content.res.Resources
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.WebView
import androidx.appcompat.app.AlertDialog
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Surface any startup crash on screen so it can be reported.
    val previousHandler = Thread.getDefaultUncaughtExceptionHandler()
    Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
      try {
        val text = android.util.Log.getStackTraceString(throwable).take(3000)
        runOnUiThread {
          try {
            AlertDialog.Builder(this)
              .setTitle("OpenPencil 崩溃报告")
              .setMessage(text)
              .setPositiveButton("关闭") { _, _ -> android.os.Process.killProcess(android.os.Process.myPid()) }
              .show()
          } catch (_: Exception) {
            previousHandler?.uncaughtException(thread, throwable)
          }
        }
      } catch (_: Exception) {
        previousHandler?.uncaughtException(thread, throwable)
      }
    }
    super.onCreate(savedInstanceState)
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    val resId = Resources.getSystem().getIdentifier("status_bar_height", "dimen", "android")
    val statusBarHeight = if (resId > 0) Resources.getSystem().getDimensionPixelSize(resId) else 0

    fun applyMargin(h: Int) {
      if (h <= 0) return
      val lp = webView.layoutParams
      if (lp is ViewGroup.MarginLayoutParams) {
        if (lp.topMargin != h) {
          lp.topMargin = h
          webView.layoutParams = lp
        }
      } else {
        webView.layoutParams = ViewGroup.MarginLayoutParams(webView.layoutParams).apply { topMargin = h }
      }
    }

    webView.post { applyMargin(statusBarHeight) }
    webView.viewTreeObserver.addOnGlobalLayoutListener(object : android.view.ViewTreeObserver.OnGlobalLayoutListener {
      override fun onGlobalLayout() {
        applyMargin(statusBarHeight)
        webView.viewTreeObserver.removeOnGlobalLayoutListener(this)
      }
    })
    ViewCompat.setOnApplyWindowInsetsListener(webView) { view, insets ->
      val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
      applyMargin(bars.top)
      insets
    }
  }
}
