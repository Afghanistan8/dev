// Canonical JSON, byte-for-byte the same string the contract hashes.
//
// The contract computes every digest over `_canon(...)`, which is Python's
// json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).
// A client that recomputed a digest over JSON.stringify would disagree with the
// chain on key order and on every non-ASCII character, so the spelling is
// reproduced here exactly: keys sorted, no spaces, and the whole string plain
// ASCII with \uXXXX escapes.

export function canon(value) {
  return spell(value);
}

function spell(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isFinite(value) ? JSON.stringify(value) : "null";
  if (typeof value === "string") return quote(value);
  if (Array.isArray(value)) return "[" + value.map(spell).join(",") + "]";
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    return "{" + keys.map((k) => quote(k) + ":" + spell(value[k])).join(",") + "}";
  }
  throw new Error("cannot canonicalise a " + typeof value);
}

function quote(text) {
  let out = '"';
  for (const ch of text) {
    const code = ch.codePointAt(0);
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
export function utf8Bytes(text) {
  return new TextEncoder().encode(text);
}

/** sha256 of a string, lowercase hex. Node's webcrypto, so no dependency. */
export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", utf8Bytes(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function baselineHash(content) {
  return sha256Hex(content);
}

/**
 * The digest over the frozen criteria, matching `criteria_digest` in
 * contracts/dev.py: the baseline hash, each requirement's id, statement and
 * severity, and the aggregation rules.
 */
export async function criteriaDigest(baselineHashValue, requirements, rules) {
  const rows = [...requirements]
    .map((r) => [String(r.requirement_id ?? r[0]), String(r.statement ?? r[1]),
                 String(r.severity ?? r[2])])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return sha256Hex(canon({
    baseline_hash: String(baselineHashValue ?? ""),
    requirements: rows,
    rules: String(rules),
  }));
}

/**
 * The digest the validators must agree about, matching `decisive_digest`:
 * requirement id, the answered status, and the status the grounding rule made
 * of it -- and nothing else.
 */
export async function decisiveDigest(findings) {
  const rows = [...findings]
    .map((f) => [String(f.requirement_id), String(f.status), String(f.effective_status)])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return sha256Hex(canon(rows));
}
