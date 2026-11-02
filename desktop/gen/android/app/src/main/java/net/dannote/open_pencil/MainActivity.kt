package net.dannote.open_pencil

import android.content.res.Resources
import android.view.ViewGroup
import android.webkit.WebView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  /**
   * Tauri sizes the WebView to the whole window, insets included, so the status bar
   * paints over the top of the editor. Re-applying the top inset as a margin keeps the
   * toolbar below the bar on devices that draw a persistent one, without touching the
   * activity layout for the rest of the window.
   */
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
