import { PULSE_MS, homeRingPulse } from "../src/lib/rings/homePulse.js";
const ok = (c, m) => { if (!c) { console.error("FAIL:", m); process.exit(1); } };
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
ok(PULSE_MS === 3000, "one pulse every 3 s");
ok(near(homeRingPulse(0), 0) && near(homeRingPulse(3000), 0) && near(homeRingPulse(6000), 0), "rests at each cycle start");
ok(near(homeRingPulse(1500), 1), "peaks mid-cycle");
ok(homeRingPulse(300) < 0.01 && homeRingPulse(2700) < 0.01, "rests most of the cycle (slow, single swell)");
console.log("check-home-pulse: ok");
