// Neutralisiert Tabellen-Formeln (=, +, -, @, Tab, CR) und maskiert Trennzeichen.
export function csvCell(v: unknown, sep = ";"): string {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return s.includes(sep) || /["\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
