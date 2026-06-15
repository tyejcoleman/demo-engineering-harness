// A cheap, always-on critic: scores a produced artifact on fixed dimensions and lists
// concrete gaps. Domain-agnostic — give it the requirements and what's present.

export const DIMENSIONS = ["completeness", "correctness", "coherence"];

// requirements: [{ key, dim, label, severity }]; present: Set or object of satisfied keys.
export function critique(requirements, present) {
  const has = (k) => (present instanceof Set ? present.has(k) : !!present[k]);

  const gaps = requirements
    .filter((r) => !has(r.key))
    .map((r) => ({ key: r.key, dim: r.dim, label: r.label, severity: r.severity || "med" }));

  const dimensions = {};
  for (const dim of DIMENSIONS) {
    const reqs = requirements.filter((r) => r.dim === dim);
    const ok = reqs.filter((r) => has(r.key)).length;
    dimensions[dim] = reqs.length ? ok / reqs.length : 1;
  }

  const satisfied = requirements.filter((r) => has(r.key)).length;
  const score = requirements.length ? Math.round((100 * satisfied) / requirements.length) : 100;
  return { score, dimensions, gaps };
}
