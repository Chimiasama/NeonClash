package io.github.chimiasama.neonclash;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowInsets;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

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

        if (Build.VERSION.SDK_INT >= 30) {
            game.setOnApplyWindowInsetsListener((view, insets) -> {
                Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return WindowInsets.CONSUMED;
            });
        }
        setContentView(game);
        game.loadUrl("https://" + WebViewAssetLoader.DEFAULT_DOMAIN + "/game/index.html");
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
        setContentView(new android.view.View(this));
        game.destroy();
        super.onDestroy();
    }
}
