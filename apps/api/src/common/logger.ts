/** Structured logging stub — swap for pino/OpenTelemetry in production. */
export function logInfo(event: string, fields: Record<string, unknown> = {}) {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ level: "info", event, ts: new Date().toISOString(), ...fields }));
}

export function logError(event: string, fields: Record<string, unknown> = {}) {
  // eslint-disable-next-line no-console
  console.error(JSON.stringify({ level: "error", event, ts: new Date().toISOString(), ...fields }));
}
