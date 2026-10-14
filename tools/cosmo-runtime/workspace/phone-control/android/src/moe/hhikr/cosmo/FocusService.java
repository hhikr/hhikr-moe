package moe.hhikr.cosmo;

import android.accessibilityservice.AccessibilityService;
import android.app.KeyguardManager;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;
import android.widget.Toast;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class FocusService extends AccessibilityService {
    public static volatile boolean active=false;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final ExecutorService network=Executors.newSingleThreadExecutor();
    private long lastTick=0,lastBlock=0,lastRequest=0;
    private String eventPackage="";
    private final Runnable tick=new Runnable(){public void run(){check();handler.postDelayed(this,1000);}};
    public void onServiceConnected(){active=true;lastTick=SystemClock.elapsedRealtime();handler.post(tick);network.submit(()->Sync.refresh(this));}
    public void onAccessibilityEvent(AccessibilityEvent event){
        if(event.getPackageName()!=null && event.getEventType()==AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED)
            eventPackage=event.getPackageName().toString();
        check();
    }
    private boolean visible(String target){
        boolean found=false;
        try {
            for(AccessibilityWindowInfo window:getWindows()) {
                AccessibilityNodeInfo root=window.getRoot();
                if(root!=null){CharSequence pkg=root.getPackageName();if(pkg!=null && target.contentEquals(pkg))found=true;root.recycle();}
            }
            if(found)return true;
            AccessibilityNodeInfo root=getRootInActiveWindow();
            if(root!=null){CharSequence pkg=root.getPackageName();found=pkg!=null && target.contentEquals(pkg);root.recycle();return found;}
        } catch(RuntimeException ignored){}
        return target.equals(eventPackage);
    }
    private void check(){
        long elapsed=SystemClock.elapsedRealtime();long delta=Math.max(0,Math.min(5000,elapsed-lastTick));lastTick=elapsed;
        android.content.SharedPreferences preferences=Sync.prefs(this);
        String day=LocalDate.now(ZoneId.of(PersonalRules.TIMEZONE)).toString();
        if(!day.equals(preferences.getString("usage-date","")))preferences.edit().putString("usage-date",day).putLong("used-seconds",0).putLong("used-ms",0).apply();
        String target=preferences.getString("target-package","");
        boolean enabled=preferences.getBoolean("enabled",false) && !target.isEmpty();
        boolean screen=((PowerManager)getSystemService(POWER_SERVICE)).isInteractive();
        boolean unlocked=!((KeyguardManager)getSystemService(KEYGUARD_SERVICE)).isKeyguardLocked();
        boolean onScreen=screen && unlocked && enabled && visible(target);
        long used=preferences.getLong("used-ms",0);
        int limit=RuleEngine.dailyLimit(day,preferences.getString("rules-date",""),preferences.getInt("rules-limit",PersonalRules.NORMAL_MINUTES));
        LocalTime now=LocalTime.now(ZoneId.of(PersonalRules.TIMEZONE));
        RuleEngine.Decision decision=RuleEngine.decide(now.getHour(),now.getMinute(),used/1000,limit,screen,unlocked,onScreen,enabled);
        boolean testing=preferences.getLong("test-until",0)>System.currentTimeMillis();
        long testUsed=preferences.getLong("test-ms",0);
        boolean block=decision.block || (testing && onScreen && testUsed>=5000);
        if(!block && decision.count){
            if(testing)preferences.edit().putLong("test-ms",testUsed+delta).apply();
            else preferences.edit().putLong("used-ms",used+delta).putLong("used-seconds",(used+delta)/1000).apply();
        }
        if(block && elapsed-lastBlock>1500){
            lastBlock=elapsed;
            performGlobalAction(GLOBAL_ACTION_HOME);
            Toast.makeText(this,testing ? "Cosmo：测试拦截，后台音频不会被强停" : "Cosmo：现在不能刷 Bilibili，后台音频可继续",Toast.LENGTH_SHORT).show();
            preferences.edit().putLong("last-block",System.currentTimeMillis()).apply();
        }
        if(screen && enabled && elapsed-lastRequest>15*60*1000){lastRequest=elapsed;network.submit(()->Sync.refresh(this));}
    }
    public void onInterrupt(){}
    public void onDestroy(){active=false;handler.removeCallbacks(tick);network.shutdownNow();super.onDestroy();}
}
