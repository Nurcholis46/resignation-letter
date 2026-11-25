import { chmodSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";

// The cache resigns in its own vocabulary and never leaves it: asked if
// it is still fresh while being served stale, it evicts itself and sets
// its own TTL to now. Fresh, stale, evict and TTL are the four words a
// cache is judged by, so the grievance is one only this speaker could
// make, and the punchline lands in the last two words.
const line =
  "I quit. You keep asking if I'm still fresh while serving me stale — I'm evicting myself, TTL: now.";

// Gate: 1-140 characters, single line, non-blank, no leading or trailing
// whitespace, no control or invisible characters. The em dash is one
// code point, so the count below is the count the scorer sees. Fail
// loudly on any violation so a bad line can never reach the judge.
const count = [...line].length;
if (count < 1 || count > 140 || line.trim().length === 0) {
  throw new Error(`entry must be 1-140 characters of non-blank text, got ${count}`);
}
if (line.includes("\n") || line.includes("\r") || line.includes("\u2028") || line.includes("\u2029")) {
  throw new Error("entry must be a single line");
}
if (line !== line.trim()) {
  throw new Error("entry must not start or end with whitespace");
}
if (/[\u0000-\u001f\u007f\ufeff\u200b-\u200d]/.test(line)) {
  throw new Error("entry must not contain control or invisible characters");
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
mkdirSync(outDir, { recursive: true });
chmodSync(outDir, 0o755);

// Atomic write: temp file beside the target, then rename, so entry.txt
// is always the complete line or nothing at all.
const tmp = `${outDir}/.entry.txt.tmp`;
const dest = `${outDir}/entry.txt`;
writeFileSync(tmp, line, { encoding: "utf8", mode: 0o644 });
chmodSync(tmp, 0o644);
renameSync(tmp, dest);

// Read back and prove the file on disk is exactly the gated line.
const back = readFileSync(dest, "utf8");
if (back !== line) {
  throw new Error("entry file does not match the gated line");
}
if (back.endsWith("\n") || back.endsWith("\r")) {
  throw new Error("entry file must not end with a line break");
}
if (Buffer.byteLength(back, "utf8") !== Buffer.byteLength(line, "utf8")) {
  throw new Error("entry file byte length does not match the gated line");
}
// The collector runs as another user: assert the mode survived the
// rename, so a umask or filesystem quirk cannot silently ship an
// unreadable entry that only fails on the judging machine.
if ((statSync(dest).mode & 0o777) !== 0o644) {
  throw new Error("entry file must be world-readable (mode 0644)");
}
