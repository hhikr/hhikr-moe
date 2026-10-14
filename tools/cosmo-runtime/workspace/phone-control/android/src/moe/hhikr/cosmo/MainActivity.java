package moe.hhikr.cosmo;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.*;
import org.json.JSONObject;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private final ExecutorService network=Executors.newSingleThreadExecutor();
    private TextView status;
    private boolean loginOpen=false;
    private WebView loginWeb;
    private boolean browserOpen=false;
    private Runnable browserTimeout;
    private final android.os.Handler handler=new android.os.Handler(android.os.Looper.getMainLooper());
    private Runnable loginTimeout;
    private int loginGeneration=0;
    private int dp(int value){return (int)(value*getResources().getDisplayMetrics().density);}
    private void content(View view){
        view.setOnApplyWindowInsetsListener((v,insets)->{v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});
        setContentView(view);view.requestApplyInsets();
    }
    private void closeLogin(){loginGeneration++;if(loginTimeout!=null)handler.removeCallbacks(loginTimeout);if(loginWeb!=null){loginWeb.stopLoading();loginWeb.destroy();loginWeb=null;}}
    public void onCreate(Bundle state){super.onCreate(state);android.webkit.CookieManager.getInstance().setAcceptCookie(true);home();handleReturn(getIntent());}
    public void onResume(){super.onResume();if(Sync.prefs(this).getBoolean("browser-screen",false))browserScreen();else if(!loginOpen)home();}
    private void message(String text){runOnUiThread(()->{if(status!=null)status.setText(text);});}
    private Button button(LinearLayout layout,String title,View.OnClickListener listener){
        Button b=new Button(this);b.setText(title);b.setAllCaps(false);b.setMinHeight(dp(48));b.setOnClickListener(listener);layout.addView(b);return b;
    }
    private void section(LinearLayout box,String title){TextView label=new TextView(this);label.setText(title);label.setTextSize(19);label.setTypeface(null,android.graphics.Typeface.BOLD);label.setPadding(0,dp(20),0,dp(8));box.addView(label);}
    private void home(){
        closeLogin();loginOpen=false;browserOpen=false;if(browserTimeout!=null)handler.removeCallbacks(browserTimeout);
        ScrollView scroll=new ScrollView(this);LinearLayout box=new LinearLayout(this);box.setOrientation(LinearLayout.VERTICAL);
        int pad=(int)(20*getResources().getDisplayMetrics().density);box.setPadding(pad,pad,pad,pad);scroll.addView(box);content(scroll);
        TextView heading=new TextView(this);heading.setText("Cosmo 专注");heading.setTextSize(28);heading.setPadding(0,0,0,dp(12));box.addView(heading);
        TextView description=new TextView(this);description.setTextSize(16);description.setLineSpacing(dp(3),1);description.setText(PersonalRules.DESCRIPTION);box.addView(description);
        status=new TextView(this);status.setTextSize(17);status.setBackgroundColor(0xffedf2f7);status.setPadding(dp(12),pad,dp(12),pad);box.addView(status);updateStatus();
        section(box,"设备设置");
        button(box,"1. 选择手机上的 Bilibili",v->chooseApp());
        button(box,"通知权限／解除 ColorOS 授权限制",v->PermissionSetup.open(this));
        button(box,"2. 开启无障碍执行权限",v->PermissionSetup.accessibility(this));
        button(box,"3. 允许后台运行／电池设置",v->{try{startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,Uri.parse("package:"+getPackageName())));}catch(Exception e){startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));}});
        button(box,"打开 Bilibili 设置，手动关闭画中画／小窗",v->{String target=Sync.prefs(this).getString("target-package","");if(target.isEmpty()){message("先选择 Bilibili");return;}startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+target)));});
        section(box,"账号与规则");
        button(box,BrowserAuth.AVAILABLE?"4. 使用系统浏览器登录":"4. 浏览器登录网站（App 登录待发布）",v->browserScreen());
        button(box,"兼容：站内 WebView 登录（不支持 Google）",v->{Sync.prefs(this).edit().remove("native-access").apply();login();});
        button(box,"立即同步规则",v->network.submit(()->{Sync.refresh(this);runOnUiThread(this::updateStatus);}));
        Switch enabled=new Switch(this);enabled.setText("启用 Bilibili 前台限制（随时可关闭）");enabled.setChecked(Sync.prefs(this).getBoolean("enabled",false));
        enabled.setOnCheckedChangeListener((view,on)->{
            if(on && (Sync.prefs(this).getString("target-package","").isEmpty() || !FocusService.active)){
                view.setChecked(false);message("先选择 Bilibili 并连接无障碍服务；当前没有实际拦截");return;
            }
            Sync.prefs(this).edit().putBoolean("enabled",on).apply();updateStatus();network.submit(()->Sync.refresh(this));
        });box.addView(enabled);
        section(box,"手机验收");
        button(box,"测试：前台使用 5 秒后返回桌面",v->{
            if(!FocusService.active || !Sync.prefs(this).getBoolean("enabled",false)){message("先连接执行服务并启用限制");return;}
            Sync.prefs(this).edit().putLong("test-until",System.currentTimeMillis()+60000).putLong("test-ms",0).apply();
            message("一分钟测试窗口已启动。打开 Bilibili，前台可见约 5 秒后应回桌面；测试不扣日常额度。再验证锁屏音频持续。关闭限制可随时终止。");
        });
        button(box,"确认设备测试已通过",v->new AlertDialog.Builder(this).setTitle("只有实测通过才确认")
            .setMessage("你是否已验证：前台超限能返回桌面、关闭画中画后无可见绕过、后台／锁屏音频持续，关闭限制可恢复？这只保存你本人的验收声明，不伪装自动检测。")
            .setPositiveButton("已全部验证",(dialog,which)->{if(!FocusService.active){message("执行服务未连接，不能确认");return;}Sync.prefs(this).edit().putBoolean("verified",true).apply();network.submit(()->{Sync.refresh(this);runOnUiThread(this::updateStatus);});})
            .setNegativeButton("还没完成",null).show());
        section(box,"每日任务");
        button(box,"提交昨晚睡眠记录",v->sleepForm());
        TextView privacy=new TextView(this);privacy.setText("权限说明：无障碍只订阅窗口变化，代码仅读取窗口所属应用，不遍历文字、不记录输入、不截图。服务器只收到所选包名、当天 Bilibili 累计秒数、执行状态与本人验收声明。登录由你在网页完成，凭据不交给助手。通知权限用于手动查看执行状态。ColorOS 如拦截无障碍，进入 Cosmo 专注的应用详情 → 权限管理 → 右上角菜单 → 解除所有授权限制。");privacy.setPadding(0,pad,0,0);box.addView(privacy);
    }
    private void updateStatus(){
        if(status==null)return;
        android.content.SharedPreferences p=Sync.prefs(this);
        String day=LocalDate.now(ZoneId.of(PersonalRules.TIMEZONE)).toString();
        int limit=RuleEngine.dailyLimit(day,p.getString("rules-date",""),p.getInt("rules-limit",PersonalRules.NORMAL_MINUTES));
        long seconds=day.equals(p.getString("usage-date",""))?p.getLong("used-seconds",0):0;
        status.setText("限制开关："+(p.getBoolean("enabled",false)?"开启":"关闭")+"\n执行服务："+(FocusService.active?"已连接":"未连接，未实际拦截")+"\n目标："+p.getString("target-package","未选择")+
            "\n今日前台："+(seconds/60)+" 分 "+(seconds%60)+" 秒 / "+limit+" 分钟\n"+p.getString("sync-state","尚未登录同步；仅本地基线")+
            "\n通知："+PermissionSetup.state(this)+"\n设备验收："+(p.getBoolean("verified",false)?"本人已确认":"未验证"));
    }
    private void chooseApp(){
        Intent intent=new Intent(Intent.ACTION_MAIN);intent.addCategory(Intent.CATEGORY_LAUNCHER);
        ArrayList<ResolveInfo> candidates=new ArrayList<>();
        for(ResolveInfo item:getPackageManager().queryIntentActivities(intent,0)) {
            String pkg=item.activityInfo.packageName;String label=item.loadLabel(getPackageManager()).toString();
            if(pkg.toLowerCase().contains("bili") || label.contains("哔哩"))candidates.add(item);
        }
        candidates.sort(Comparator.comparing(item->item.loadLabel(getPackageManager()).toString()));
        if(candidates.isEmpty()){message("未找到 Bilibili 启动项，请确认当前用户已安装 Bilibili，暂不启用限制");return;}
        String[] names=new String[candidates.size()];for(int i=0;i<names.length;i++)names[i]=candidates.get(i).loadLabel(getPackageManager())+"\n"+candidates.get(i).activityInfo.packageName;
        new AlertDialog.Builder(this).setTitle("只选择你实际使用的 Bilibili").setItems(names,(dialog,index)->{
            Sync.prefs(this).edit().putString("target-package",candidates.get(index).activityInfo.packageName).putBoolean("verified",false).apply();updateStatus();
        }).show();
    }
    private void browserScreen(){
        closeLogin();loginOpen=false;browserOpen=true;
        Sync.prefs(this).edit().putBoolean("browser-screen",true).apply();
        if(browserTimeout!=null)handler.removeCallbacks(browserTimeout);
        ScrollView scroll=new ScrollView(this);LinearLayout box=new LinearLayout(this);box.setOrientation(LinearLayout.VERTICAL);box.setPadding(dp(20),dp(16),dp(20),dp(16));scroll.addView(box);content(scroll);
        section(box,"系统浏览器登录");
        TextView info=new TextView(this);info.setTextSize(17);info.setLineSpacing(dp(4),1);box.addView(info);
        long started=Sync.prefs(this).getLong("browser-started",0);
        String result=Sync.prefs(this).getString("browser-result","");
        boolean waiting=BrowserAuthPolicy.live(started,System.currentTimeMillis());
        if(started>0 && !waiting){BrowserAuth.cancel(this);Sync.prefs(this).edit().remove("browser-started").apply();result="等待已结束或设备时间已变化，请重新开始。";}
        info.setText((waiting?"等待你从浏览器返回（最多 10 分钟）。":"浏览器登录尚未开始或等待已结束。")
            +"\n"+result+"\n"+(BrowserAuth.AVAILABLE?"返回后需验证授权码并完整同步。":"此预览版本尚未启用 App 登录。可以在浏览器登录网站，但 App 身份不会自动同步。"));
        button(box,waiting?"重新开始浏览器登录":"打开系统浏览器",v->{
            BrowserAuth.cancel(this);
            try{
                String url=BrowserAuth.AVAILABLE?BrowserAuth.begin(this):Sync.ORIGIN;
                Sync.prefs(this).edit().putLong("browser-started",System.currentTimeMillis()).putString("browser-result","").commit();
                Intent intent=new Intent(Intent.ACTION_VIEW,Uri.parse(url));intent.addCategory(Intent.CATEGORY_BROWSABLE);startActivity(intent);browserScreen();
            }catch(Exception e){BrowserAuth.cancel(this);Sync.prefs(this).edit().remove("browser-started").putString("browser-result","无法打开浏览器或准备安全请求，请检查默认浏览器后重试。").apply();browserScreen();}
        });
        button(box,"我已返回：检查 App 同步",v->{
            if(!BrowserAuth.AVAILABLE){info.setText("浏览器返回不等于 App 登录。服务器授权兑换尚不可用；没有读取浏览器 cookie，也没有将网站登录标记为 App 成功。");return;}
            info.setText("正在检查 App 已有身份的完整同步…");network.submit(()->{boolean success=Sync.refresh(this);runOnUiThread(()->{if(browserOpen)info.setText(success?"App 已有身份完整同步成功；不证明刚才浏览器登录已兑换。":"App 同步未完成，请重新进行安全登录。");});});
        });
        button(box,"取消并返回主页",v->{cancelBrowser();home();});
        if(waiting){browserTimeout=()->{if(browserOpen){BrowserAuth.cancel(this);Sync.prefs(this).edit().remove("browser-started").putString("browser-result","等待已超时，请重新开始。").apply();browserScreen();}};handler.postDelayed(browserTimeout,Math.max(1,BrowserAuthPolicy.TTL_MS-(System.currentTimeMillis()-started)));}
    }
    private void cancelBrowser(){BrowserAuth.cancel(this);Sync.prefs(this).edit().remove("browser-started").remove("browser-screen").remove("browser-result").commit();if(browserTimeout!=null)handler.removeCallbacks(browserTimeout);}
    public void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);handleReturn(intent);}
    private void handleReturn(Intent intent){
        if(intent==null || intent.getData()==null)return;
        final String callback=intent.getDataString();intent.setData(null); // Never log callback or retain it in the Activity Intent.
        if(!BrowserAuth.AVAILABLE){Sync.prefs(this).edit().putString("browser-result","已拒绝登录返回：安全兑换尚未启用，未更新认证状态。").apply();browserScreen();return;}
        Sync.prefs(this).edit().putString("browser-result","正在验证返回并完整同步…").apply();browserScreen();
        final long attempt=Sync.prefs(this).getLong("native-generation",0);
        network.submit(()->{boolean success=BrowserAuth.complete(this,callback);runOnUiThread(()->{
            if(!browserOpen || attempt!=Sync.prefs(this).getLong("native-generation",0))return;
            if(success){cancelBrowser();home();}else{Sync.prefs(this).edit().putString("browser-result","返回校验、授权兑换或完整同步未完成，请重新开始。重复返回不会再次兑换。").apply();browserScreen();}
        });});
    }
    private void login(){
        closeLogin();loginOpen=true;final int generation=loginGeneration;
        LinearLayout box=new LinearLayout(this);box.setOrientation(LinearLayout.VERTICAL);
        TextView stage=new TextView(this);stage.setTextSize(16);stage.setPadding(dp(16),dp(12),dp(16),dp(12));
        stage.setText("仅允许 HTTPS：cosmo.hhikr.moe、hhikr.moe。请在原站自行登录。");box.addView(stage);
        ProgressBar progress=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);progress.setMax(100);box.addView(progress);
        LinearLayout actions=new LinearLayout(this);actions.setOrientation(LinearLayout.HORIZONTAL);box.addView(actions);
        WebView web=new WebView(this);loginWeb=web;box.addView(web,new LinearLayout.LayoutParams(-1,0,1));
        button(actions,"返回",v->home());
        button(actions,"重试",v->{web.stopLoading();web.loadUrl(Sync.ORIGIN);});
        button(actions,"浏览器检查",v->{
            new AlertDialog.Builder(this).setMessage("打开同一官方入口检查手机网络。浏览器登录不会自动同步到 App，请返回此页登录。")
                .setPositiveButton("打开",(d,w)->{try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(Sync.ORIGIN)));}catch(android.content.ActivityNotFoundException e){stage.setText("没有可用浏览器");}}).setNegativeButton("取消",null).show();
        });
        web.getSettings().setJavaScriptEnabled(true);web.getSettings().setDomStorageEnabled(true);
        Sync.prefs(this).edit().putString("webview-user-agent",web.getSettings().getUserAgentString()).apply();
        web.getSettings().setAllowFileAccess(false);web.getSettings().setAllowContentAccess(false);
        web.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        final boolean[] failed={false};
        web.setWebChromeClient(new android.webkit.WebChromeClient(){public void onProgressChanged(WebView view,int value){progress.setProgress(value);}});
        web.setWebViewClient(new WebViewClient(){
            private void fail(String text){failed[0]=true;if(loginTimeout!=null)handler.removeCallbacks(loginTimeout);progress.setVisibility(View.GONE);stage.setText(text+"。可重试、返回或用浏览器检查；尚未确认登录同步成功。");}
            private boolean navigation(Uri uri){
                if(LoginPolicy.trusted(uri.getScheme(),uri.getHost(),uri.getPort()))return false;
                stage.setText("已阻止非信任地址或协议。只允许两个官方站点的 HTTPS 导航。");return true;
            }
            public boolean shouldOverrideUrlLoading(WebView view,android.webkit.WebResourceRequest request){return navigation(request.getUrl());}
            public boolean shouldOverrideUrlLoading(WebView view,String url){return navigation(Uri.parse(url));}
            public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon){
                Uri destination=Uri.parse(url);if(!LoginPolicy.trusted(destination.getScheme(),destination.getHost(),destination.getPort())){view.stopLoading();fail("已阻止非信任导航");return;}
                if(loginTimeout!=null)handler.removeCallbacks(loginTimeout);failed[0]=false;progress.setVisibility(View.VISIBLE);progress.setProgress(0);
                stage.setText("正在加载官方登录页面："+ ("hhikr.moe".equals(Uri.parse(url).getHost())?"hhikr.moe":"cosmo.hhikr.moe"));
                loginTimeout=()->{if(loginOpen && generation==loginGeneration){fail("加载超过 30 秒，手机网络原因尚未确定");view.stopLoading();}};handler.postDelayed(loginTimeout,30000);
            }
            public void onReceivedError(WebView view,android.webkit.WebResourceRequest request,android.webkit.WebResourceError error){if(request.isForMainFrame())fail("页面加载失败（错误码 "+error.getErrorCode()+"）");}
            public void onReceivedHttpError(WebView view,android.webkit.WebResourceRequest request,android.webkit.WebResourceResponse response){if(request.isForMainFrame())fail("官方页面返回 HTTP "+response.getStatusCode());}
            public void onReceivedSslError(WebView view,android.webkit.SslErrorHandler ssl,android.net.http.SslError error){ssl.cancel();fail("TLS 证书验证失败，已安全停止");}
            public void onPageFinished(WebView view,String url){
                if(loginTimeout!=null)handler.removeCallbacks(loginTimeout);if(failed[0] || !loginOpen || generation!=loginGeneration)return;
                progress.setVisibility(View.GONE);stage.setText("页面已加载，请完成原站登录。登录后将核验规则与设备状态同步。");
                Uri uri=Uri.parse(url);if(!LoginPolicy.trusted(uri.getScheme(),uri.getHost(),uri.getPort()) || !"cosmo.hhikr.moe".equals(uri.getHost()))return;
                view.evaluateJavascript("JSON.stringify(window.__HERMES_SESSION_TOKEN__ || '')",value->{
                    if(!loginOpen || generation!=loginGeneration || failed[0])return;
                    try{String token=new org.json.JSONArray("["+value+"]").getString(0);token=new org.json.JSONArray("["+token+"]").getString(0);if(!token.isEmpty())Sync.saveToken(MainActivity.this,token);}catch(Exception ignored){}
                    android.webkit.CookieManager.getInstance().flush();stage.setText("正在核验登录并同步规则、设备状态…");
                    network.submit(()->{boolean success=Sync.refresh(MainActivity.this);runOnUiThread(()->{
                        if(!loginOpen || generation!=loginGeneration)return;
                        if(success)home();else stage.setText(Sync.prefs(MainActivity.this).getString("sync-state","同步未完成")+"。请完成登录或重试。");
                    });});
                });
            }
        });content(box);web.loadUrl(Sync.ORIGIN);
    }
    public void onDestroy(){if(browserTimeout!=null)handler.removeCallbacks(browserTimeout);closeLogin();network.shutdownNow();super.onDestroy();}
    private void sleepForm(){
        LinearLayout form=new LinearLayout(this);form.setOrientation(LinearLayout.VERTICAL);
        EditText sleep=new EditText(this);sleep.setHint("估计入睡 HH:MM，例如 00:10");form.addView(sleep);
        EditText wake=new EditText(this);wake.setHint("实际离床 HH:MM，例如 "+PersonalRules.WAKE_HINT);form.addView(wake);
        EditText energy=new EditText(this);energy.setHint("精神 1–5，5 最好");energy.setInputType(2);form.addView(energy);
        EditText notes=new EditText(this);notes.setHint("夜醒、午睡、不适等，可选");form.addView(notes);
        new AlertDialog.Builder(this).setTitle("报告日期："+LocalDate.now(ZoneId.of(PersonalRules.TIMEZONE))).setView(form)
            .setPositiveButton("提交",(dialog,index)->network.submit(()->{
                try{JSONObject payload=new JSONObject();payload.put("instance_id","daily-sleep-"+LocalDate.now(ZoneId.of(PersonalRules.TIMEZONE)));
                    payload.put("sleep_time",sleep.getText().toString().trim());payload.put("wake_time",wake.getText().toString().trim());
                    payload.put("energy",Integer.parseInt(energy.getText().toString().trim()));payload.put("notes",notes.getText().toString());
                    JSONObject response=Sync.request(this,"/api/plugins/cosmo-tasks/sleep/report",payload);
                    String code=response.getJSONObject("task").getString("status");
                    String label="completed".equals(code)?"已完成":("awaiting_confirmation".equals(code)?"待核实迟交／缺失记录":"已保存，待补充睡前或离床记录");
                    message("睡眠记录已保存："+label);
                }catch(Exception error){message("未保存，请检查时间、登录和当天任务是否已启动："+error.getClass().getSimpleName());}
            })).setNegativeButton("取消",null).show();
    }
    public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] grantResults){
        super.onRequestPermissionsResult(requestCode,permissions,grantResults);
        if(requestCode==PermissionSetup.REQUEST_CODE){
            PermissionSetup.onResult(this,grantResults.length>0 && grantResults[0]==android.content.pm.PackageManager.PERMISSION_GRANTED);
            updateStatus();
        }
    }
    public void onBackPressed(){if(browserOpen){cancelBrowser();home();}else if(loginOpen)home();else super.onBackPressed();}
}
