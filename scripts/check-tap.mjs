// Node check: globe tap guard (a drag, long press or pinch never starts an entry).
// Run: node scripts/check-tap.mjs
import { makeTapGuard, TAP } from "../src/components/map/scene/tapGuard.js";
let failed = 0; const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) failed++; };
let t = 1000; const clock = () => t;
const tap = (fn) => { const g = makeTapGuard(clock); fn(g); return g.isTap(); };
ok(tap((g) => { g.down(1, 100, 100); t += 120; g.up(1, 102, 101); }), "short still press is a tap");
ok(!tap((g) => { g.down(1, 100, 100); g.move(1, 140, 100); t += 100; g.up(1, 100, 100); }), "drag that returns to start is not a tap");
ok(!tap((g) => { g.down(1, 100, 100); t += 100; g.up(1, 100 + TAP.maxPx, 100); }), `move of ${TAP.maxPx}px is not a tap`);
ok(tap((g) => { g.down(1, 100, 100); t += 100; g.up(1, 105, 100); }), "move of 5px is a tap");
ok(!tap((g) => { g.down(1, 100, 100); t += TAP.maxMs; g.up(1, 100, 100); }), `press of ${TAP.maxMs}ms is not a tap`);
ok(!tap((g) => { g.down(1, 100, 100); g.down(2, 200, 200); g.up(2, 200, 200); t += 50; g.up(1, 100, 100); }), "any second finger (pinch) is not a tap");
ok(!tap((g) => { g.sheetChanged(); t += 100; g.down(1, 100, 100); t += 50; g.up(1, 100, 100); }), "tap while the sheet animates is ignored");
ok(tap((g) => { g.sheetChanged(); t += 400; g.down(1, 100, 100); t += 50; g.up(1, 100, 100); }), "tap after the sheet settles counts");
ok(!makeTapGuard(clock).isTap(), "no gesture is not a tap");
process.exit(failed ? 1 : 0);
