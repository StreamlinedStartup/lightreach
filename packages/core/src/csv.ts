/**
 * CSV parsing + column-mapping helpers for the lead import wizard.
 *
 * Supported target fields:
 *   firstName, lastName, email, company, openingLine
 *   + any extra columns are available as "custom fields"
 *
 * Usage flow:
 *   1. User uploads CSV  →  parseCSVHeaders() to get available columns
 *   2. User maps columns  →  ColumnMapping object
 *   3. mapCSVRows()  →  MappedLead[]  ready to insert
 */

import Papa from "papaparse";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The standard fields we map leads to. */
export const LEAD_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "company",
  "openingLine",
] as const;

export type LeadField = (typeof LEAD_FIELDS)[number];

/**
 * User-defined mapping: target field → source CSV column header.
 * Only `email` is required; others are optional.
 */
export type ColumnMapping = Partial<Record<LeadField, string>>;

/** A lead ready to be inserted, with any unmapped columns in `customFields`. */
export interface MappedLead {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  openingLine: string;
  customFields: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export interface ParseResult {
  headers: string[];
  rows: Record<string, string>[];
  errors: string[];
}

/**
 * Parse a CSV string and return headers + raw rows.
 * Call this on the raw file text after reading the upload.
 */
export function parseCSV(csvText: string): ParseResult {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => v.trim(),
  });

  return {
    headers: result.meta.fields ?? [],
    rows: result.data,
    errors: result.errors.map((e) => e.message),
  };
}

/**
 * Auto-detect a likely ColumnMapping from CSV headers by fuzzy matching
 * common names (case-insensitive). Returns partial mapping; user can
 * override any entry in the mapping UI.
 */
export function detectMapping(headers: string[]): ColumnMapping {
  const lower = headers.map((h) => h.toLowerCase());

  function find(...candidates: string[]): string | undefined {
    for (const c of candidates) {
      const idx = lower.findIndex((h) => h.includes(c));
      if (idx !== -1) return headers[idx];
    }
    return undefined;
  }

  return {
    firstName: find("first_name", "firstname", "first name", "fname"),
    lastName: find("last_name", "lastname", "last name", "lname", "surname"),
    email: find("email", "e-mail", "mail"),
    company: find("company", "organization", "organisation", "org", "employer"),
    openingLine: find("opening_line", "openingline", "opening line", "opener", "icebreaker"),
  };
}

/**
 * Apply a ColumnMapping to raw parsed rows, producing MappedLead objects.
 * Rows without a value for the mapped `email` column are skipped.
 */
export function mapCSVRows(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
): MappedLead[] {
  const mappedSourceCols = new Set(Object.values(mapping).filter(Boolean));

  return rows
    .map((row): MappedLead | null => {
      const email = pick(row, mapping.email);
      if (!email) return null; // email is required

      const customFields: Record<string, string> = {};
      for (const [col, val] of Object.entries(row)) {
        if (!mappedSourceCols.has(col) && val) {
          customFields[col] = val;
        }
      }

      return {
        firstName: pick(row, mapping.firstName) ?? "",
        lastName: pick(row, mapping.lastName) ?? "",
        email,
        company: pick(row, mapping.company) ?? "",
        openingLine: pick(row, mapping.openingLine) ?? "",
        customFields,
      };
    })
    .filter((r): r is MappedLead => r !== null);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pick(row: Record<string, string>, col: string | undefined): string | undefined {
  if (!col) return undefined;
  const val = row[col];
  return val && val.length > 0 ? val : undefined;
}
