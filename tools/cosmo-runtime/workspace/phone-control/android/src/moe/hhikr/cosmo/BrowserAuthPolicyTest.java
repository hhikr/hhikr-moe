package moe.hhikr.cosmo;
public final class BrowserAuthPolicyTest {
    private static void check(boolean value,String name){if(!value)throw new AssertionError(name);}
    public static void main(String[] args){
        check(BrowserAuthPolicy.challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk").equals("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"),"RFC7636 S256 vector");
        String state=BrowserAuthPolicy.random(),code=BrowserAuthPolicy.random();
        check(!state.equals(BrowserAuthPolicy.random()) && state.length()==43,"fresh independent state");
        String url=BrowserAuthPolicy.CALLBACK+"?code="+code+"&state="+state;
        check(code.equals(BrowserAuthPolicy.code(url,state,1000,2000)),"valid bounded callback");
        for(String bad:new String[]{url+"&state="+state,url+"&token=secret",url+"#fragment",url.replace("https:","http:"),url.replace("cosmo.hhikr.moe","evil.example"),url.replace("/android/auth/callback","/other"),url.replace("cosmo.hhikr.moe","cosmo.hhikr.moe:443"),url.replace("cosmo.hhikr.moe","user@cosmo.hhikr.moe"),url.replace("code="+code,"code=%41"),url.replace("code="+code,"code="),url+"&",url.replace(state,BrowserAuthPolicy.random())})
            check(BrowserAuthPolicy.code(bad,state,1000,2000)==null,"reject invalid callback");
        check(BrowserAuthPolicy.code(url,state,1000,601000)==null,"expiry boundary");
        check(BrowserAuthPolicy.code(url,state,1000,999)==null,"clock rollback");
        check(BrowserAuthPolicy.code(url,"",1000,2000)==null,"cancel/replay with consumed state");
        check(BrowserAuthPolicy.code(url,state,0,2000)==null,"no pending request");
        System.out.println("Browser auth policy: all assertions passed");
    }
}
