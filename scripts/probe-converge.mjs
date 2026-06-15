// Behavioral probe for Slice 3: the convergence loop.
// PASS only if it actually reaches ready, is bounded, records a trace, and the guard
// prevents infinite loops on an unsatisfiable demo.
import { converge } from "../core/converge.mjs";

const checks = [];
const ok = (n, c) => checks.push([n, !!c]);

// Toy demo: 3 criteria; act() flips one unmet field true per iteration.
const demo = {
  initialState: { scaffold: false, ui: false, probe: false },
  criteria: [
    { id: "scaffold", test: (s) => s.scaffold },
    { id: "ui", test: (s) => s.ui },
    { id: "probe", test: (s) => s.probe },
  ],
  act: (s, target) => {
    s[target] = true;
    return `set ${target}=true`;
  },
};

const r = converge(demo, { maxIterations: 10 });
ok("reaches-ready", r.ready === true);
ok("bounded", r.iterations <= 3);
ok("trace-recorded", Array.isArray(r.trace) && r.trace.length === 3);
ok("trace-has-actions", r.trace.every((t) => typeof t.action === "string"));

// Guard: an unsatisfiable demo stops at the guard and reports not-ready (no infinite loop).
const stuck = converge(
  { initialState: {}, criteria: [{ id: "never", test: () => false }], act: () => "noop" },
  { maxIterations: 5 }
);
ok("guard-stops", stuck.ready === false && stuck.iterations === 5);

const failed = checks.filter(([, c]) => !c).map(([n]) => n);
console.log(failed.length === 0 ? "PASS" : "FAIL: " + failed.join(", "));
