package moe.hhikr.cosmo;
import java.lang.reflect.Method;
/** Real permission decisions without depending on Android framework stubs. */
public final class PermissionSetupPolicyTest {
    public static void main(String[] args) throws Exception {
        Class<?> policy;
        try { policy=Class.forName("moe.hhikr.cosmo.PermissionSetupPolicy"); }
        catch(ClassNotFoundException missing){throw new AssertionError("notification permission setup policy is missing");}
        Method mode=policy.getDeclaredMethod("mode",int.class,boolean.class,boolean.class,boolean.class);
        check(mode,32,false,false,false,0);
        check(mode,33,false,false,false,1);
        check(mode,35,false,false,false,1);
        check(mode,35,true,true,false,0);
        check(mode,35,true,false,false,0);
        check(mode,35,false,true,true,1);
        check(mode,35,false,true,false,2);
        System.out.println("Permission setup policy: all seven assertions passed");
    }
    private static void check(Method mode,int sdk,boolean granted,boolean requested,boolean rationale,int expected)throws Exception {
        int actual=(Integer)mode.invoke(null,sdk,granted,requested,rationale);
        if(actual!=expected)throw new AssertionError("permission mode for SDK "+sdk+": expected "+expected+", got "+actual);
    }
}
