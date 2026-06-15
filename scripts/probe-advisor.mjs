// Behavioral probe for Slice 6: the production-conversion advisor (the closer).
import { productionPlan } from "../core/advisor.mjs";

const checks = [];
const ok = (n, c) => checks.push([n, !!c]);

const p = productionPlan();
ok("has-areas", Array.isArray(p.areas) && p.areas.length >= 5);
ok("steps-present", p.areas.every((a) => Array.isArray(a.steps) && a.steps.length >= 1));
ok("covers-grounding", p.areas.some((a) => /retriev|ground/i.test(a.area)));
ok("covers-tools", p.areas.some((a) => /tool|integration/i.test(a.area)));
ok("covers-quality", p.areas.some((a) => /quality|improv/i.test(a.area)));

const failed = checks.filter(([, c]) => !c).map(([n]) => n);
console.log(failed.length === 0 ? "PASS" : "FAIL: " + failed.join(", "));
