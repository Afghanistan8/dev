// Turning what the contract stores into something readable.

export function shortAddress(value: string): string {
  if (!value || value.length < 12) return value || "—";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function shortHash(value: string, head = 10): string {
  if (!value) return "—";
  return value.length <= head + 4 ? value : `${value.slice(0, head)}…`;
}

/** The contract's own timestamp, `2026-10-17T14:25:04Z`, said plainly. */
export function moment(value: string): string {
  if (!value) return "—";
  return value.replace("T", " ").replace("Z", " UTC");
}

export function bytes(value: number | string): string {
  const held = Number(value);
  if (!Number.isFinite(held)) return "—";
  return `${held.toLocaleString("en-US")} bytes`;
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
