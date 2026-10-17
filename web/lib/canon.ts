// Canonical JSON, byte-for-byte the same string the contract hashes.
//
// The contract computes every digest over `_canon(...)`, which is Python's
// json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).
// A client that recomputed a digest over JSON.stringify would disagree with the
// chain on key order and on every non-ASCII character, so the spelling is
// reproduced here exactly: keys sorted, no spaces, and the whole string plain
// ASCII with \uXXXX escapes.
//
// This is the same code as scripts/canon.mjs, kept in step with it by
// tests/canon.test.ts, and with contracts/dev.py by the live run.

export function canon(value: unknown): string {
  return spell(value);
}

function spell(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    return Number.isFinite(value) ? JSON.stringify(value) : "null";
  }
  if (typeof value === "bigint") return spell(Number(value));
  if (typeof value === "string") return quote(value);
  if (Array.isArray(value)) return "[" + value.map(spell).join(",") + "]";
  if (value instanceof Map) {
    const out: Record<string, unknown> = {};
    for (const [key, held] of value) out[String(key)] = held;
    return spell(out);
  }
  if (typeof value === "object") {
    const held = value as Record<string, unknown>;
    const keys = Object.keys(held).sort();
    return "{" + keys.map((k) => quote(k) + ":" + spell(held[k])).join(",") + "}";
  }
  throw new Error("cannot canonicalise a " + typeof value);
}

function quote(text: string): string {
  let out = '"';
  for (const ch of text) {
    const code = ch.codePointAt(0) as number;
    if (ch === '"') out += '\\"';
    else if (ch === "\\") out += "\\\\";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (ch === "\b") out += "\\b";
    else if (ch === "\f") out += "\\f";
    else if (code < 0x20) out += "\\u" + code.toString(16).padStart(4, "0");
    else if (code < 0x80) out += ch;
    else if (code <= 0xffff) out += "\\u" + code.toString(16).padStart(4, "0");
    else {
      const high = Math.floor((code - 0x10000) / 0x400) + 0xd800;
      const low = ((code - 0x10000) % 0x400) + 0xdc00;
      out += "\\u" + high.toString(16).padStart(4, "0");
      out += "\\u" + low.toString(16).padStart(4, "0");
    }
  }
  return out + '"';
}

/** The UTF-8 bytes of a string, which is what the contract hashes. */
export function utf8Bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** sha256 of a string, lowercase hex. WebCrypto, so no dependency. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", utf8Bytes(text) as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The baseline hash: sha256 of the baseline bytes. Mirrors `_digest_of`. */
export async function baselineHash(content: string): Promise<string> {
  return sha256Hex(content);
}

/**
 * The digest over the frozen criteria, matching `criteria_digest` in
 * contracts/dev.py: the baseline hash, each requirement's id, statement and
 * severity, and the aggregation rules.
 */
export async function criteriaDigest(
  baselineHashValue: string,
  requirements: ReadonlyArray<readonly [string, string, string] | { requirement_id: string; statement: string; severity: string }>,
  rules: string,
): Promise<string> {
  const rows = requirements
    .map((r) => {
      if (Array.isArray(r)) return [String(r[0]), String(r[1]), String(r[2])];
      const held = r as { requirement_id: string; statement: string; severity: string };
      return [String(held.requirement_id), String(held.statement), String(held.severity)];
    })
    .sort((a, b) => (a[0]! < b[0]! ? -1 : a[0]! > b[0]! ? 1 : 0));
  return sha256Hex(
    canon({
      baseline_hash: String(baselineHashValue ?? ""),
      requirements: rows,
      rules: String(rules),
    }),
  );
}

/**
 * The digest the validators must agree about, matching `decisive_digest`:
 * requirement id, the answered status, and the status the grounding rule made
 * of it -- and nothing else.
 */
export async function decisiveDigest(
  findings: ReadonlyArray<{ requirement_id: string; status: string; effective_status: string }>,
): Promise<string> {
  const rows = findings
    .map((f) => [String(f.requirement_id), String(f.status), String(f.effective_status)])
    .sort((a, b) => (a[0]! < b[0]! ? -1 : a[0]! > b[0]! ? 1 : 0));
  return sha256Hex(canon(rows));
}
