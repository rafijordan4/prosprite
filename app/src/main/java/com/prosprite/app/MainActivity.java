package com.prosprite.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import android.webkit.JavascriptInterface;
import android.content.ContentValues;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import java.io.File;
import java.io.FileOutputStream;

import java.io.ByteArrayInputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONObject;
import java.util.Iterator;
import java.io.InputStream;
import java.util.HashMap;

/**
 * ProSprite: seluruh UI ada di assets/www (HTML/CSS/JS).
 * File dilayani lewat origin palsu https://prosprite.local/ supaya IndexedDB,
 * fetch dan canvas jalan normal (tidak kena batasan file://).
 */
public class MainActivity extends Activity {
    private static final String HOST = "prosprite.local";
    private static final int REQ_FILE = 1001;

    private WebView web;
    private ValueCallback<Uri[]> filePathCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        web.setBackgroundColor(0xFF0B0F1A);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        setContentView(web);
        hideSystemUi();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(false);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (HOST.equals(u.getHost())) {
                    String path = u.getPath();
                    if (path == null || path.equals("/") || path.isEmpty()) path = "/index.html";
                    try {
                        InputStream in = getAssets().open("www" + path);
                        return new WebResourceResponse(mimeOf(path), "UTF-8", in);
                    } catch (Exception e) {
                        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found",
                                new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
                    }
                }
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Jangan biarkan WebView pindah ke situs lain
                return !HOST.equals(request.getUrl().getHost());
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), REQ_FILE);
                } catch (Exception e) {
                    filePathCallback = null;
                    return false;
                }
                return true;
            }
        });

        web.addJavascriptInterface(new Bridge(), "Native");
        web.loadUrl("https://" + HOST + "/index.html");
    }

    private static String mimeOf(String path) {
        String p = path.toLowerCase();
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".json")) return "application/json";
        return "application/octet-stream";
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE) {
            if (filePathCallback != null) {
                filePathCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
                filePathCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.onAndroidBack ? window.onAndroidBack() : false", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String v) {
                if (!"true".equals(v)) finish();
            }
        });
    }

    private void hideSystemUi() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }

    /** Jembatan HTTP untuk login GitHub (github.com tidak mengizinkan CORS). Hanya host GitHub. */
    public class Bridge {
        private boolean okHost(String url) {
            try {
                Uri u = Uri.parse(url);
                String h = u.getHost();
                return "https".equals(u.getScheme()) && h != null
                        && (h.equals("github.com") || h.equals("api.github.com"));
            } catch (Exception e) { return false; }
        }

        @JavascriptInterface
        public void openUrl(String url) {
            if (!"https://github.com/login/device".equals(url) && !(url != null && url.startsWith("https://github.com/login/device"))) return;
            try {
                Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
            } catch (Exception e) { /* abaikan */ }
        }

        /** Simpan file ke folder Download (untuk ekspor proyek dan foto layar). */
        @JavascriptInterface
        public void saveFile(final String name, final String base64, final String mime) {
            new Thread(new Runnable() {
                @Override public void run() {
                    boolean ok = false; String msg = name;
                    try {
                        String safe = name.replaceAll("[^A-Za-z0-9._-]", "_");
                        byte[] data = Base64.decode(base64, Base64.DEFAULT);
                        if (Build.VERSION.SDK_INT >= 29) {
                            ContentValues cv = new ContentValues();
                            cv.put(MediaStore.MediaColumns.DISPLAY_NAME, safe);
                            cv.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                            cv.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                            Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                            if (uri == null) throw new Exception("gagal membuat file");
                            OutputStream o = getContentResolver().openOutputStream(uri);
                            o.write(data); o.close();
                            ok = true;
                        } else {
                            File dir = getExternalFilesDir(null);
                            File f = new File(dir, safe);
                            FileOutputStream fo = new FileOutputStream(f);
                            fo.write(data); fo.close();
                            ok = true; msg = f.getAbsolutePath();
                        }
                    } catch (Exception e) { msg = String.valueOf(e.getMessage()); }
                    final String js = "window.__nativeSaved && window.__nativeSaved(" + ok + "," + JSONObject.quote(msg) + ")";
                    runOnUiThread(new Runnable() { @Override public void run() { if (web != null) web.evaluateJavascript(js, null); } });
                }
            }).start();
        }

        @JavascriptInterface
        public void http(final String id, final String method, final String url, final String headersJson, final String body) {
            new Thread(new Runnable() {
                @Override public void run() {
                    int status = 0; String text = "";
                    try {
                        if (!okHost(url)) throw new Exception("host tidak diizinkan");
                        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                        c.setRequestMethod("GET".equals(method) ? "GET" : "POST");
                        c.setConnectTimeout(15000); c.setReadTimeout(20000);
                        JSONObject h = new JSONObject(headersJson == null || headersJson.isEmpty() ? "{}" : headersJson);
                        Iterator<String> it = h.keys();
                        while (it.hasNext()) { String k = it.next(); c.setRequestProperty(k, h.getString(k)); }
                        if (body != null && !body.isEmpty() && !"GET".equals(method)) {
                            c.setDoOutput(true);
                            OutputStream o = c.getOutputStream(); o.write(body.getBytes("UTF-8")); o.close();
                        }
                        status = c.getResponseCode();
                        InputStream in = status >= 400 ? c.getErrorStream() : c.getInputStream();
                        if (in != null) {
                            java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
                            byte[] buf = new byte[4096]; int n;
                            while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
                            text = bo.toString("UTF-8");
                        }
                    } catch (Exception e) { status = 0; text = "{\"error\":\"network\",\"error_description\":" + JSONObject.quote(String.valueOf(e.getMessage())) + "}"; }
                    final String js = "window.__nativeHttp(" + JSONObject.quote(id) + "," + status + "," + JSONObject.quote(text) + ")";
                    runOnUiThread(new Runnable() { @Override public void run() { if (web != null) web.evaluateJavascript(js, null); } });
                }
            }).start();
        }
    }
}
