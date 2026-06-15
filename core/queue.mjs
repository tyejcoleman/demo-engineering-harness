// Persistent, de-duped improvement backlog. De-dup by key so the same gap never piles up;
// a repeat occurrence bumps frequency instead. Ranked by severity × frequency (impact × how often).

export function createQueue() {
  return { items: [], seen: new Set() };
}

export function enqueue(queue, item) {
  if (queue.seen.has(item.key)) {
    const existing = queue.items.find((i) => i.key === item.key);
    if (existing) existing.frequency = (existing.frequency || 1) + 1;
    return false;
  }
  queue.seen.add(item.key);
  queue.items.push({ ...item, frequency: 1, status: "open" });
  return true;
}

const SEV = { high: 3, med: 2, low: 1 };

export function ranked(queue) {
  return queue.items
    .filter((i) => i.status === "open")
    .slice()
    .sort((a, b) => (SEV[b.severity] || 2) * (b.frequency || 1) - (SEV[a.severity] || 2) * (a.frequency || 1));
}

export function resolve(queue, key) {
  const it = queue.items.find((i) => i.key === key);
  if (it) it.status = "done";
  return !!it;
}
