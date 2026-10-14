package moe.hhikr.cosmo;

public final class RuleEngine {
    public static final class Decision {
        public final boolean block, count, forceStop;
        Decision(boolean block, boolean count) { this.block=block; this.count=count; this.forceStop=false; }
    }
    public static int dailyLimit(String today, String rulesDate, int savedLimit) {
        return today.equals(rulesDate) && (savedLimit==PersonalRules.REDUCED_MINUTES || savedLimit==PersonalRules.NORMAL_MINUTES) ? savedLimit : PersonalRules.NORMAL_MINUTES;
    }
    public static Decision decide(int hour, int minute, long usedSeconds, int limitMinutes,
            boolean interactive, boolean unlocked, boolean visible, boolean enabled) {
        if (hour<0 || hour>23 || minute<0 || minute>59 || usedSeconds<0 || limitMinutes<1)
            throw new IllegalArgumentException("Invalid clock or quota");
        boolean onScreen = interactive && unlocked && visible;
        int clock = hour*60+minute;
        boolean night = clock>=PersonalRules.NIGHT_START || clock<PersonalRules.NIGHT_END;
        boolean blocked = enabled && onScreen && (night || usedSeconds>=limitMinutes*60L);
        return new Decision(blocked, enabled && onScreen && !blocked);
    }
}
