package moe.hhikr.cosmo;
/** Runs with SDK stub types; enabled/disabled deployment selection and invalid returns stay safe. */
public final class BrowserAuthDisabledTest {
    public static void main(String[] args) throws Exception {
        boolean expected=args.length>0 && "enabled".equals(args[0]);
        if(BrowserAuth.AVAILABLE!=expected)throw new AssertionError("browser authentication deployment selection mismatch");
        if(BrowserAuth.complete(null,null))throw new AssertionError("empty callback rejected");
        if(BrowserAuth.complete(null,BrowserAuthPolicy.CALLBACK+"?code=invalid&state=invalid"))throw new AssertionError("injected callback rejected");
        if(!expected){
            boolean rejected=false;
            try{BrowserAuth.begin(null);}catch(IllegalStateException failure){rejected=true;}
            if(!rejected)throw new AssertionError("must not launch undeployed authorization endpoint");
        }
        System.out.println("Browser auth deployment gate: all assertions passed; expected="+expected);
    }
}
