/**
 * Template variable rendering  —  {{variableName}}  or  {{variableName|fallback}}
 *
 * Syntax:
 *   {{firstName}}             → value of "firstName" or empty string
 *   {{firstName|there}}       → value of "firstName" or "there" if missing/empty
 *   {{company|your company}}  → value of "company" or "your company"
 *
 * Variable names are case-insensitive for matching against the data object.
 */

export type VariableMap = Record<string, string | undefined | null>;

/**
 * Render all `{{var}}` / `{{var|fallback}}` placeholders in `template`
 * using values from `vars`.
 */
export function renderVariables(template: string, vars: VariableMap): string {
  return template.replace(
    /\{\{([^}|]+)(?:\|([^}]*))?\}\}/g,
    (_match, name: string, fallback?: string) => {
      const key = name.trim().toLowerCase();
      const value = findValue(vars, key);
      if (value) return value;
      return fallback?.trim() ?? "";
    },
  );
}

/**
 * Extract all unique variable names referenced in a template string.
 * Returns lowercase names, e.g. ["firstname", "company"].
 */
export function extractVariables(template: string): string[] {
  const names = new Set<string>();
  const re = /\{\{([^}|]+)(?:\|[^}]*)?\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(template)) !== null) {
    names.add(match[1]!.trim().toLowerCase());
  }
  return [...names];
}

/**
 * Return a list of variable names referenced in `template` that are NOT
 * present (or are empty) in `vars`. Useful for editor warnings.
 */
export function missingVariables(template: string, vars: VariableMap): string[] {
  return extractVariables(template).filter((name) => !findValue(vars, name));
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function findValue(vars: VariableMap, lcKey: string): string | undefined {
  // Try exact lowercase key first, then scan for case-insensitive match
  const direct = vars[lcKey];
  if (direct) return direct;

  for (const [k, v] of Object.entries(vars)) {
    if (k.toLowerCase() === lcKey && v) return v;
  }

  return undefined;
}
