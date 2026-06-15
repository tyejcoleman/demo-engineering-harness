// Behavioral probe for Slice 8: the self-improvement loop (Critic + Queue + verify-gate).
import { runImprovementLoop, REQUIREMENTS } from "../core/loop.mjs";
import { createQueue, enqueue, ranked } from "../core/queue.mjs";
import { critique } from "../core/critic.mjs";

const checks = [];
const ok = (n, c) => checks.push([n, !!c]);

const r = runImprovementLoop();
ok("converges-to-100", r.converged === true && r.finalScore === 100);
ok("bounded", r.iterations <= REQUIREMENTS.length);
ok("learned-fixes", Array.isArray(r.learned) && r.learned.length >= 1);

// Queue de-dups by key (repeat bumps frequency, no duplicate item).
const q = createQueue();
const a = enqueue(q, { key: "x", severity: "high", label: "X" });
const b = enqueue(q, { key: "x", severity: "high", label: "X" });
ok("dedup", a === true && b === false && q.items.length === 1 && q.items[0].frequency === 2);

// Ranking: high severity outranks low.
const q2 = createQueue();
enqueue(q2, { key: "lo", severity: "low", label: "lo" });
enqueue(q2, { key: "hi", severity: "high", label: "hi" });
ok("rank-by-severity", ranked(q2)[0].key === "hi");

// Critic scores and lists the right gap.
const c = critique([{ key: "a", dim: "completeness" }, { key: "b", dim: "correctness" }], { a: true });
ok("critic", c.score === 50 && c.gaps.length === 1 && c.gaps[0].key === "b");

// Deterministic.
ok("deterministic", JSON.stringify(runImprovementLoop().events) === JSON.stringify(runImprovementLoop().events));

const failed = checks.filter(([, c]) => !c).map(([n]) => n);
console.log(failed.length === 0 ? "PASS" : "FAIL: " + failed.join(", "));
