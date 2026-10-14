package moe.hhikr.cosmo;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.widget.Toast;

/** User-initiated setup only; no scheduled reminders or automatic grants. */
final class PermissionSetup {
    static final int REQUEST_CODE=2104;
    private static final String CHANNEL="execution-status";
    private static final String GUIDE="ColorOS 若提示未知来源应用限制：\n打开 Cosmo 专注的应用详情 → 权限管理 → 右上角 ⋮ → 解除所有授权限制。\n然后返回无障碍 → 已下载的应用 → Cosmo 专注，开启服务。\n如果权限管理仍灰色，请把页面截图发给 Cosmo。";
    private static NotificationManager manager(Context context){return (NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);}
    private static boolean granted(Context context){return Build.VERSION.SDK_INT<33 || context.checkSelfPermission(PermissionSetupPolicy.NOTIFICATION_PERMISSION)==PackageManager.PERMISSION_GRANTED;}
    static String state(Context context){
        if(granted(context) && manager(context).areNotificationsEnabled())return "通知已允许";
        return Sync.prefs(context).getBoolean("notification-requested",false)?"已请求通知权限，尚未允许":"通知尚未允许";
    }
    static void open(Activity activity){
        new AlertDialog.Builder(activity).setTitle("通知权限与无障碍设置")
            .setMessage(state(activity)+"\n通知用于手动查看执行状态。点击下方按钮时才申请；拒绝后仍可继续设置无障碍。\n\n"+GUIDE)
            .setPositiveButton(granted(activity)?"查看执行状态通知":"申请通知权限",(d,w)->requestOrShow(activity))
            .setNeutralButton("打开应用详情",(d,w)->appDetails(activity))
            .setNegativeButton("稍后",null).show();
    }
    private static void requestOrShow(Activity activity){
        int mode=PermissionSetupPolicy.mode(Build.VERSION.SDK_INT,granted(activity),
            Sync.prefs(activity).getBoolean("notification-requested",false),
            Build.VERSION.SDK_INT>=33 && activity.shouldShowRequestPermissionRationale(PermissionSetupPolicy.NOTIFICATION_PERMISSION));
        if(mode==PermissionSetupPolicy.REQUEST_PERMISSION){
            Sync.prefs(activity).edit().putBoolean("notification-requested",true).apply();
            activity.requestPermissions(new String[]{PermissionSetupPolicy.NOTIFICATION_PERMISSION},REQUEST_CODE);
        }else if(mode==PermissionSetupPolicy.OPEN_SETTINGS || !manager(activity).areNotificationsEnabled()){
            launch(activity,new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,activity.getPackageName()));
        }else showStatus(activity);
    }
    static void onResult(Activity activity,boolean allowed){
        if(allowed)showStatus(activity);
        else Toast.makeText(activity,"通知未允许，可继续打开应用详情解除授权限制",Toast.LENGTH_LONG).show();
        open(activity);
    }
    private static void appDetails(Activity activity){
        launch(activity,new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+activity.getPackageName())));
    }
    static void accessibility(Activity activity){
        Intent settings=new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
        if(FocusService.active){launch(activity,settings);return;}
        new AlertDialog.Builder(activity).setTitle("开启 Cosmo 专注的无障碍")
            .setMessage("在已下载的应用中选择 Cosmo 专注，允许它判断 Bilibili 是否可见并在超限时返回桌面。\n\n"+GUIDE)
            .setPositiveButton("打开无障碍设置",(d,w)->launch(activity,settings))
            .setNeutralButton("解除限制入口",(d,w)->appDetails(activity))
            .setNegativeButton("取消",null).show();
    }
    private static void launch(Activity activity,Intent intent){
        try{activity.startActivity(intent);}
        catch(android.content.ActivityNotFoundException missing){Toast.makeText(activity,"请手动进入系统设置 → 应用管理 → Cosmo 专注",Toast.LENGTH_LONG).show();}
    }
    private static void showStatus(Context context){
        if(!granted(context) || !manager(context).areNotificationsEnabled())return;
        NotificationManager notifications=manager(context);
        NotificationChannel channel=new NotificationChannel(CHANNEL,"执行状态",NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("仅在你点击查看时显示当时的服务和限制开关状态");notifications.createNotificationChannel(channel);
        Intent intent=new Intent(context,MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent open=PendingIntent.getActivity(context,0,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        String text="服务："+(FocusService.active?"已连接":"未连接")+"；限制："+(Sync.prefs(context).getBoolean("enabled",false)?"开启":"关闭");
        Notification notification=new Notification.Builder(context,CHANNEL).setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("Cosmo 专注 · 执行状态快照").setContentText(text).setSubText("点击查看实时状态")
            .setContentIntent(open).setOnlyAlertOnce(true).setAutoCancel(true).build();
        try{notifications.notify(2104,notification);}catch(SecurityException revoked){Toast.makeText(context,"通知权限已关闭，请在应用设置检查",Toast.LENGTH_LONG).show();}
    }
}
