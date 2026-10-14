package moe.hhikr.cosmo;
/** Decide what a user-initiated notification setup action should do. */
final class PermissionSetupPolicy {
    static final int SHOW_STATUS=0, REQUEST_PERMISSION=1, OPEN_SETTINGS=2;
    static final String NOTIFICATION_PERMISSION="android.permission.POST_NOTIFICATIONS";
    static int mode(int sdk,boolean granted,boolean requested,boolean rationale) {
        if(sdk<33 || granted)return SHOW_STATUS;
        return requested && !rationale ? OPEN_SETTINGS : REQUEST_PERMISSION;
    }
}
