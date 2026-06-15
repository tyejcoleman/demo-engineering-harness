// Self-contained convergence loop (assess/act/record, framework-agnostic):
// assess -> act -> record, until criteria pass or a guard trips. Flips a demo to "ready".

export function assess(state, criteria) {
  const results = criteria.map((c) => ({ id: c.id, pass: !!c.test(state) }));
  const unmet = results.filter((r) => !r.pass).map((r) => r.id);
  return { converged: unmet.length === 0, unmet, results };
}

export function converge(demo, opts = {}) {
  const guard = opts.maxIterations ?? 20;
  const state = { ...(demo.initialState || {}) };
  const criteria = demo.criteria || [];
  const trace = [];
  let iterations = 0;
  let report = assess(state, criteria);

  while (!report.converged && iterations < guard) {
    const target = report.unmet[0];
    const action = demo.act ? demo.act(state, target) : null;
    trace.push({ iteration: iterations, target, action, unmetBefore: report.unmet.slice() });
    iterations++;
    report = assess(state, criteria);
  }

  return { ready: report.converged, iterations, unmet: report.unmet, trace, state };
}
