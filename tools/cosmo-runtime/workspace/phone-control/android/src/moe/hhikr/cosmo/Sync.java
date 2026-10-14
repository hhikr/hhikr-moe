package moe.hhikr.cosmo;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.webkit.CookieManager;
import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public final class Sync {
    public static final String ORIGIN="https://cosmo.hhikr.moe";
    public static SharedPreferences prefs(Context context) {return context.getSharedPreferences("cosmo-focus",Context.MODE_PRIVATE);}
    private static SecretKey key() throws Exception {
        KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);
        if (!store.containsAlias("cosmo-api-session")) {
            KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder("cosmo-api-session",KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
            generator.generateKey();
        }
        return (SecretKey)store.getKey("cosmo-api-session",null);
    }
    static boolean savePrivate(Context context,String name,String value){
        try{
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());
            String data=Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)+":"+Base64.encodeToString(cipher.doFinal(value.getBytes(StandardCharsets.UTF_8)),Base64.NO_WRAP);
            return prefs(context).edit().putString(name,data).commit();
        }catch(Exception e){return false;}
    }
    static String readPrivate(Context context,String name){
        try{
            String[] parts=prefs(context).getString(name,"").split(":");
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(parts[0],Base64.NO_WRAP)));
            return new String(cipher.doFinal(Base64.decode(parts[1],Base64.NO_WRAP)),StandardCharsets.UTF_8);
        }catch(Exception e){return "";}
    }
    public static void saveToken(Context context,String token) {
        try {
            if (token==null || token.isEmpty()) {prefs(context).edit().remove("api-session").apply();return;}
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());
            byte[] ciphertext=cipher.doFinal(token.getBytes(StandardCharsets.UTF_8));
            prefs(context).edit().putString("api-session",Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)+":"+Base64.encodeToString(ciphertext,Base64.NO_WRAP)).apply();
        } catch(Exception error) {prefs(context).edit().putString("sync-state","登录凭据保存失败，请重新登录").apply();}
    }
    private static String token(Context context) {
        try {
            String data=prefs(context).getString("api-session","");if(data.isEmpty())return "";
            String[] parts=data.split(":");Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(parts[0],Base64.NO_WRAP)));
            return new String(cipher.doFinal(Base64.decode(parts[1],Base64.NO_WRAP)),StandardCharsets.UTF_8);
        } catch(Exception error) {return "";}
    }
    public static JSONObject request(Context context,String path,JSONObject body) throws Exception {
        if (!path.startsWith("/api/plugins/cosmo-tasks/")) throw new IllegalArgumentException("Unsupported endpoint");
        return requestWithBearer(context,path,body,readPrivate(context,"native-access"));
    }
    private static JSONObject requestWithBearer(Context context,String path,JSONObject body,String bearer) throws Exception {
        HttpURLConnection connection=(HttpURLConnection)new URL(ORIGIN+path).openConnection();
        connection.setConnectTimeout(12000);connection.setReadTimeout(12000);connection.setInstanceFollowRedirects(false);
        connection.setRequestProperty("Accept","application/json");
        connection.setRequestProperty("Origin",ORIGIN);
        String agent=prefs(context).getString("webview-user-agent","");
        if(!agent.isEmpty())connection.setRequestProperty("User-Agent",agent);
        if(!bearer.isEmpty()){connection.setRequestProperty("Authorization","Bearer "+bearer);}else{
        String cookie=CookieManager.getInstance().getCookie(ORIGIN);
        if(cookie!=null)connection.setRequestProperty("Cookie",cookie);
        String session=token(context);if(!session.isEmpty())connection.setRequestProperty("X-Hermes-Session-Token",session);
        }
        if(body!=null) {
            connection.setRequestMethod("POST");connection.setDoOutput(true);connection.setRequestProperty("Content-Type","application/json");
            try(java.io.OutputStream stream=connection.getOutputStream()){stream.write(body.toString().getBytes(StandardCharsets.UTF_8));}
        }
        int status=connection.getResponseCode();
        if(status!=200){connection.disconnect();throw new java.io.IOException(status==401 || status==302 ? "需要登录／登录已过期" : "同步接口返回 "+status);}
        try(java.io.InputStream stream=connection.getInputStream()){
            java.io.ByteArrayOutputStream output=new java.io.ByteArrayOutputStream();byte[] buffer=new byte[4096];int count;
            while((count=stream.read(buffer))!=-1){output.write(buffer,0,count);if(output.size()>100000)throw new java.io.IOException("响应过大");}
            return new JSONObject(output.toString("UTF-8"));
        } finally {connection.disconnect();}
    }
    public static synchronized boolean refresh(Context context) {return refreshWithBearer(context,readPrivate(context,"native-access"));}
    static synchronized boolean refreshWithBearer(Context context,String bearer) {
        try {
            JSONObject rules=requestWithBearer(context,"/api/plugins/cosmo-tasks/rules",null,bearer);
            String date=rules.getString("date");java.time.LocalDate.parse(date);int limit=rules.getInt("daily_limit_minutes");
            if(limit!=PersonalRules.REDUCED_MINUTES && limit!=PersonalRules.NORMAL_MINUTES)throw new java.io.IOException("不支持的限额");
            prefs(context).edit().putString("rules-date",date).putInt("rules-limit",limit)
                .putString("sync-state","规则已下载，正在上传设备状态").apply();
            JSONObject report=new JSONObject();report.put("client_version","0.2.2");report.put("date",date);
            report.put("used_seconds",date.equals(prefs(context).getString("usage-date","")) ? prefs(context).getLong("used-seconds",0) : 0);
            report.put("enabled",prefs(context).getBoolean("enabled",false));report.put("service_active",FocusService.active);
            report.put("rules_applied",FocusService.active && prefs(context).getBoolean("enabled",false) && !prefs(context).getString("target-package","").isEmpty());report.put("device_test_passed",prefs(context).getBoolean("verified",false));
            report.put("target_package",prefs(context).getString("target-package",""));
            requestWithBearer(context,"/api/plugins/cosmo-tasks/device-status",report,bearer);
            prefs(context).edit().putString("sync-state","已完整同步："+date+"，前台额度 "+limit+" 分钟").putLong("last-sync",System.currentTimeMillis()).apply();
            return true;
        } catch(Exception error){prefs(context).edit().putString("sync-state",error instanceof java.io.IOException && error.getMessage()!=null && (error.getMessage().startsWith("同步接口返回 ") || error.getMessage().equals("需要登录／登录已过期")) ? error.getMessage() : "同步未完成，请检查网络和登录后重试").apply();return false;}
    }
}
