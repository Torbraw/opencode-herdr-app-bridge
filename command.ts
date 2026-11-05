type FocusCommand = { sessionID: string; nonce: string; created: number };

export function focusCommand(value: unknown): FocusCommand | undefined {
  if (typeof value !== "object" || value === null) return;
  if (!("sessionID" in value && "nonce" in value && "created" in value)) return;
  if (typeof value.sessionID !== "string" || typeof value.nonce !== "string") return;
  if (typeof value.created !== "number" || !Number.isFinite(value.created)) return;
  return { sessionID: value.sessionID, nonce: value.nonce, created: value.created };
}
