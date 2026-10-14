package moe.hhikr.cosmo;

import android.content.Context;
import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** System-browser authentication via the deployed site-auth gate and a fixed App Link. */
final class BrowserAuth {
    // Enabled after live gate/public association verification; phone acceptance is still required.
    static final boolean AVAILABLE=true;
    private static final String PENDING="native-pending";
    static synchronized String begin(Context context) throws Exception {
        if(!AVAILABLE)throw new IllegalStateException("Browser exchange unavailable");
        JSONObject pending=new JSONObject();String verifier=BrowserAuthPolicy.random();
        pending.put("verifier",verifier);pending.put("state",BrowserAuthPolicy.random());pending.put("started",System.currentTimeMillis());
        if(!Sync.savePrivate(context,PENDING,pending.toString()))throw new IllegalStateException("Pending storage failed");
        // The verifier stays encrypted in the App; only its S256 challenge leaves it.
        return Sync.ORIGIN+"/auth/native/authorize?code_challenge_method=S256&code_challenge="+BrowserAuthPolicy.challenge(verifier)
            +"&state="+pending.getString("state")+"&redirect_uri="+java.net.URLEncoder.encode(BrowserAuthPolicy.CALLBACK,"UTF-8");
    }
    static synchronized void cancel(Context context){Sync.prefs(context).edit().remove(PENDING).remove("native-exchange").putLong("native-generation",Sync.prefs(context).getLong("native-generation",0)+1).commit();}
    static boolean complete(Context context,String callback) {
        if(!AVAILABLE)return false;
        HttpURLConnection connection=null;
        try{
            JSONObject pending;String code;long generation;
            synchronized(BrowserAuth.class){
            generation=Sync.prefs(context).getLong("native-generation",0);
            pending=new JSONObject(Sync.readPrivate(context,PENDING));
            code=BrowserAuthPolicy.code(callback,pending.getString("state"),pending.getLong("started"),System.currentTimeMillis());
            if(code==null)return false;
            // Consume before exchanging. A lost response requires a fresh login; never replay.
            if(!Sync.prefs(context).edit().remove(PENDING).putBoolean("native-exchange",true).commit())return false;
            }
            JSONObject body=new JSONObject();body.put("code",code);body.put("code_verifier",pending.getString("verifier"));body.put("redirect_uri",BrowserAuthPolicy.CALLBACK);body.put("client_id","moe.hhikr.cosmo.focus");
            connection=(HttpURLConnection)new URL(Sync.ORIGIN+"/auth/native/token").openConnection();
            connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(12000);connection.setReadTimeout(12000);
            connection.setRequestMethod("POST");connection.setDoOutput(true);connection.setRequestProperty("Content-Type","application/json");connection.setRequestProperty("Accept","application/json");
            try(java.io.OutputStream stream=connection.getOutputStream()){stream.write(body.toString().getBytes(StandardCharsets.UTF_8));}
            if(connection.getResponseCode()!=200)return false;
            JSONObject result;
            try(java.io.InputStream stream=connection.getInputStream()){
                java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream();byte[] buffer=new byte[4096];int n;
                while((n=stream.read(buffer))!=-1){out.write(buffer,0,n);if(out.size()>100000)return false;}
                result=new JSONObject(out.toString("UTF-8"));
            }
            String access=result.getString("access_token");
            if(!"Bearer".equals(result.getString("token_type")) || access.isEmpty() || access.length()>16384 || access.indexOf('\r')>=0 || access.indexOf('\n')>=0)return false;
            // Only the access credential is retained. Expiry/401 requires browser reauthentication.
            synchronized(BrowserAuth.class){if(generation!=Sync.prefs(context).getLong("native-generation",0))return false;}
            if(!Sync.refreshWithBearer(context,access))return false;
            synchronized(BrowserAuth.class){
                if(generation!=Sync.prefs(context).getLong("native-generation",0))return false;
                return Sync.savePrivate(context,"native-access",access);
            }
        }catch(Exception e){return false;}
        finally{if(connection!=null)connection.disconnect();}
    }
}
