package moe.hhikr.cosmo;

public final class RuleEngineTest {
    static void check(boolean okay, String name) { if (!okay) throw new AssertionError(name); }
    public static void main(String[] args) {
        RuleEngine.Decision background = RuleEngine.decide(0, 15, 99999, 80, false, false, false, true);
        check(!background.block && !background.count, "locked background audio must not be blocked or counted");
        check(!background.forceStop, "never force-stop Bilibili audio");
        check(RuleEngine.decide(22,30,0,80,true,true,true,true).block, "night starts at 22:40");
        check(RuleEngine.decide(7,9,0,80,true,true,true,true).block, "night until 07:10");
        check(!RuleEngine.decide(7,10,0,80,true,true,true,true).block, "night ends at 07:10");
        check(RuleEngine.decide(12,0,4800,80,true,true,true,true).block, "daily quota enforced");
        check(RuleEngine.decide(12,0,2400,40,true,true,true,true).block, "reduced quota enforced");
        check(!RuleEngine.decide(12,0,4800,80,true,true,true,false).block, "owner can revoke");
        check(RuleEngine.decide(12,0,0,80,true,true,true,true).count, "visible video counts");
        check(!RuleEngine.decide(12,0,0,80,true,true,false,true).count, "other apps do not count");
        check(RuleEngine.dailyLimit("2026-10-14","2026-10-13",40)==80,"expired penalty resets");
        check(RuleEngine.dailyLimit("2026-10-14","2026-10-14",40)==40,"same-day penalty applies");
        check(!RuleEngine.decide(12,0,4800,80,true,true,true,false).count,"disabled never counts");
        check(!RuleEngine.decide(12,0,0,80,true,false,true,true).count,"locked visible window exempt");
        check(!RuleEngine.decide(12,0,0,80,true,true,false,true).block,"background audio exempt");
        check(RuleEngine.decide(12,0,4800,80,true,true,true,true).block,"visible PiP/split window has no exemption");
        System.out.println("Android rule engine: all assertions passed");
    }
}
