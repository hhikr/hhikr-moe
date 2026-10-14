package moe.hhikr.cosmo;
public final class LoginPolicyTest {
    public static void main(String[] args) {
        RuleEngineTest.check(LoginPolicy.trusted("https","cosmo.hhikr.moe",-1),"Cosmo allowed");
        RuleEngineTest.check(LoginPolicy.trusted("https","hhikr.moe",443),"identity allowed");
        for(String host:new String[]{null,"evil.example","cosmo.hhikr.moe.evil.example","other.hhikr.moe"})
            RuleEngineTest.check(!LoginPolicy.trusted("https",host,-1),"unknown host blocked");
        for(String scheme:new String[]{null,"http","file","intent","javascript"})
            RuleEngineTest.check(!LoginPolicy.trusted(scheme,"hhikr.moe",-1),"unsafe scheme blocked");
        RuleEngineTest.check(!LoginPolicy.trusted("https","hhikr.moe",8443),"other port blocked");
        System.out.println("Login navigation policy: all assertions passed");
    }
}
