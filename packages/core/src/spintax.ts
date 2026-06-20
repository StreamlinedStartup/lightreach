/**
 * Spintax expansion  —  {option A|option B|option C}
 *
 * Supports unlimited nesting:
 *   "Hello {world|{good|great} day}" → one of:
 *     "Hello world" / "Hello good day" / "Hello great day"
 *
 * Two modes:
 *   - random (default) — picks a random variant each call
 *   - seeded           — deterministic; use the same seed to get the same output
 */

/** Expand spintax randomly (non-deterministic). */
export function expandSpintax(text: string): string {
  return expand(text, () => Math.random());
}

/**
 * Expand spintax deterministically using a numeric seed.
 * Useful for preview / test-send reproducibility.
 */
export function expandSpintaxSeeded(text: string, seed: number): string {
  // Simple mulberry32 PRNG
  let s = seed >>> 0;
  const rand = () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return expand(text, rand);
}

/**
 * Return the set of all unique variants produced by a spintax string.
 * Warning: count grows exponentially — use only for small expressions.
 */
export function enumerateSpintax(text: string): string[] {
  return enumerate(text);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// Placeholder tokens that won't appear in normal text
const OPEN_TOKEN = "\x00\x01";
const CLOSE_TOKEN = "\x00\x02";

/** Replace {{…}} with safe tokens so spintax doesn't consume inner braces. */
function guardVariables(text: string): string {
  return text.replace(/\{\{/g, OPEN_TOKEN).replace(/\}\}/g, CLOSE_TOKEN);
}

function restoreVariables(text: string): string {
  return text.replace(new RegExp(OPEN_TOKEN, "g"), "{{").replace(new RegExp(CLOSE_TOKEN, "g"), "}}");
}

function expand(text: string, rand: () => number): string {
  // Protect {{variable}} placeholders so their inner braces aren't consumed
  let result = guardVariables(text);

  const re = /\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(result)) !== null) {
    const options = match[1]!.split("|");
    const chosen = options[Math.floor(rand() * options.length)]!;
    result = result.slice(0, match.index) + chosen + result.slice(match.index + match[0].length);
    re.lastIndex = match.index; // re-scan from same position (chosen may contain new braces)
  }

  return restoreVariables(result);
}

function enumerate(text: string): string[] {
  const guarded = guardVariables(text);
  const re = /\{([^{}]*)\}/;
  const match = re.exec(guarded);
  if (!match) return [restoreVariables(guarded)];

  const options = match[1]!.split("|");
  const results: string[] = [];

  for (const option of options) {
    const candidate = guarded.slice(0, match.index) + option + guarded.slice(match.index + match[0].length);
    results.push(...enumerate(restoreVariables(candidate)));
  }

  return [...new Set(results)];
}
