// Minimal MySQL-dump INSERT parser.
// Handles: multiple INSERTs, backticked identifiers, single-quoted strings with
// backslash escapes and doubled single quotes, NULL, numbers.
export type ParsedInsert = {
  table: string;
  columns: string[];
  rows: (string | null)[][];
};

export function parseInserts(sql: string): ParsedInsert[] {
  const out: ParsedInsert[] = [];
  const re = /INSERT\s+INTO\s+`?([A-Za-z0-9_]+)`?\s*\(([^)]+)\)\s*VALUES\s*/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const table = m[1];
    const columns = m[2]
      .split(",")
      .map((c) => c.trim().replace(/^`|`$/g, ""));
    const start = re.lastIndex;
    const parsed = parseTuples(sql, start);
    out.push({ table, columns, rows: parsed.rows });
    re.lastIndex = parsed.endIndex;
  }
  return out;
}

function parseTuples(sql: string, start: number): { rows: (string | null)[][]; endIndex: number } {
  const rows: (string | null)[][] = [];
  let i = start;
  const n = sql.length;
  const skipWs = () => {
    while (i < n && /\s/.test(sql[i])) i++;
  };
  while (i < n) {
    skipWs();
    if (sql[i] !== "(") break;
    i++; // consume (
    const tuple: (string | null)[] = [];
    while (i < n) {
      skipWs();
      // value
      if (sql[i] === "'") {
        i++;
        let s = "";
        while (i < n) {
          const c = sql[i];
          if (c === "\\" && i + 1 < n) {
            const nx = sql[i + 1];
            const map: Record<string, string> = { n: "\n", r: "\r", t: "\t", "0": "\0", "\\": "\\", "'": "'", '"': '"' };
            s += map[nx] ?? nx;
            i += 2;
          } else if (c === "'" && sql[i + 1] === "'") {
            s += "'";
            i += 2;
          } else if (c === "'") {
            i++;
            break;
          } else {
            s += c;
            i++;
          }
        }
        tuple.push(s);
      } else {
        // NULL / number / bare literal until , or )
        let s = "";
        while (i < n && sql[i] !== "," && sql[i] !== ")") { s += sql[i++]; }
        const trimmed = s.trim();
        tuple.push(/^null$/i.test(trimmed) ? null : trimmed);
      }
      skipWs();
      if (sql[i] === ",") { i++; continue; }
      if (sql[i] === ")") { i++; break; }
      break;
    }
    rows.push(tuple);
    skipWs();
    if (sql[i] === ",") { i++; continue; }
    if (sql[i] === ";") { i++; break; }
    break;
  }
  return { rows, endIndex: i };
}

/** Map a parsed insert to array of row objects keyed by original column names. */
export function toRowObjects(parsed: ParsedInsert): Record<string, string | null>[] {
  return parsed.rows.map((r) => {
    const o: Record<string, string | null> = {};
    parsed.columns.forEach((c, idx) => { o[c] = r[idx] ?? null; });
    return o;
  });
}