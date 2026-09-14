/**
 * CSV Utilities
 * ─────────────
 * Dependency-free RFC-4180-compatible parser/stringifier used by the
 * Wedding CRM import & export features (and covered by unit tests).
 *
 * parseCsv handles: quoted fields, embedded commas/newlines, escaped
 * double-quotes (""), CRLF and LF line endings, and a UTF-8 BOM.
 * toCsvRows converts an array of objects into CSV text with all values
 * safely quoted when needed.
 */

function parseCsv(text) {
  if (typeof text !== 'string') return [];
  // Strip UTF-8 BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {   // escaped quote
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;            // closing quote
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\r') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      i++;
      if (text[i] === '\n') i++;     // CRLF
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      i++;
      continue;
    }
    field += ch;
    i++;
  }

  // Final field/row (file not ending with a newline)
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop fully-empty trailing rows
  return rows.filter(r => r.some(cell => String(cell).trim() !== ''));
}

/**
 * Convert rows (array of arrays, first row = header) into objects keyed by
 * normalized header names: lowercased, non-alphanumerics collapsed to '_'.
 */
function rowsToObjects(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return [];
  const headers = rows[0].map(h =>
    String(h).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  );
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const obj = {};
    headers.forEach((h, idx) => {
      if (h) obj[h] = rows[r][idx] !== undefined ? String(rows[r][idx]).trim() : '';
    });
    out.push(obj);
  }
  return out;
}

function csvEscape(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function toCsv(headers, rowsOfArrays) {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rowsOfArrays) {
    lines.push(row.map(csvEscape).join(','));
  }
  return lines.join('\r\n');
}

module.exports = { parseCsv, rowsToObjects, csvEscape, toCsv };
