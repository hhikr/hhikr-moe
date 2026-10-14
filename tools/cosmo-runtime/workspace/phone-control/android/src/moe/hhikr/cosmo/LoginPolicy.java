package moe.hhikr.cosmo;

/** Exact official hosts only; credentials stay inside the WebView and Sync. */
public final class LoginPolicy {
    public static boolean trusted(String scheme, String host, int port) {
        return "https".equals(scheme) && (port == -1 || port == 443)
            && ("cosmo.hhikr.moe".equals(host) || "hhikr.moe".equals(host));
    }
}
