package moe.hhikr.cosmo;

import java.net.URI;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

/** Proposed Android callback contract; not advertised until server review/deployment. */
public final class BrowserAuthPolicy {
    public static final String CALLBACK="https://cosmo.hhikr.moe/android/auth/callback";
    public static final long TTL_MS=600000;
    public static String random(){byte[] b=new byte[32];new SecureRandom().nextBytes(b);return Base64.getUrlEncoder().withoutPadding().encodeToString(b);}
    public static String challenge(String verifier){
        try{return Base64.getUrlEncoder().withoutPadding().encodeToString(MessageDigest.getInstance("SHA-256").digest(verifier.getBytes("US-ASCII")));}
        catch(Exception e){throw new IllegalStateException("PKCE unavailable");}
    }
    public static boolean live(long started,long now){return started>0 && now>=started && now-started<TTL_MS;}
    public static String code(String raw,String expectedState,long started,long now){
        if(!live(started,now) || expectedState==null || !expectedState.matches("[A-Za-z0-9_-]{43}"))return null;
        try{
            URI uri=new URI(raw);
            if(!"https".equals(uri.getScheme()) || !"cosmo.hhikr.moe".equals(uri.getRawAuthority())
                || !"/android/auth/callback".equals(uri.getRawPath()) || uri.getRawFragment()!=null)return null;
            String query=uri.getRawQuery();if(query==null || query.length()>1024)return null;
            Map<String,String> values=new HashMap<>();
            for(String part:query.split("&",-1)){
                String[] pair=part.split("=",-1);
                if(pair.length!=2 || !("state".equals(pair[0]) || "code".equals(pair[0])) || values.put(pair[0],pair[1])!=null)return null;
            }
            String state=values.get("state"),code=values.get("code");
            if(state==null || code==null || !code.matches("[A-Za-z0-9_-]{43}")
                || !MessageDigest.isEqual(expectedState.getBytes("US-ASCII"),state.getBytes("US-ASCII")))return null;
            return code;
        }catch(Exception e){return null;}
    }
}
