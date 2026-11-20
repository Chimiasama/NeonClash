package io.github.chimiasama.neonclash;

import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.FrameLayout;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebViewAssetLoader;

public final class MainActivity extends Activity {
    private WebView game;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
                .addPathHandler("/game/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        game = new WebView(this);
        game.setBackgroundColor(Color.rgb(11, 16, 28));
        WebSettings settings = game.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        game.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assets.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                return !"https".equals(url.getScheme())
                        || !WebViewAssetLoader.DEFAULT_DOMAIN.equals(url.getHost())
                        || url.getPath() == null || !url.getPath().startsWith("/game/");
            }
        });

        FrameLayout viewport = new FrameLayout(this);
        viewport.setBackgroundColor(Color.rgb(11, 16, 28));
        viewport.addView(game, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        ViewCompat.setOnApplyWindowInsetsListener(viewport, (view, insets) -> {
            Insets safe = insets.getInsets(WindowInsetsCompat.Type.systemBars()
                    | WindowInsetsCompat.Type.displayCutout() | WindowInsetsCompat.Type.mandatorySystemGestures());
            view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
            return WindowInsetsCompat.CONSUMED;
        });

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        setContentView(viewport);
        enterFullscreen();
        viewport.requestApplyInsets();
        game.loadUrl("https://" + WebViewAssetLoader.DEFAULT_DOMAIN + "/game/index.html?android=1");
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && game != null) enterFullscreen();
    }

    private void enterFullscreen() {
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), game);
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }

    @Override
    protected void onPause() {
        game.evaluateJavascript("window.NB?.Audio?.ctx?.suspend()", null);
        game.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        game.onResume();
        game.evaluateJavascript("if (window.NB?.Audio?.enabled) NB.Audio.ctx?.resume()", null);
    }

    @Override
    protected void onDestroy() {
        setContentView(new View(this));
        game.destroy();
        super.onDestroy();
    }
}
