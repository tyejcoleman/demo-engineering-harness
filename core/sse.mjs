// Framework-agnostic SSE helpers. Imported by Next route handlers AND by node probes,
// so the demo's streaming behavior is verified by the same code that ships.

export function sseEvent(event, data) {
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  return `event: ${event}\ndata: ${payload}\n\n`;
}

export function sseComment(text) {
  return `: ${text}\n\n`;
}
