/**
 * Escape a single CSV value:
 * - Wraps in quotes if it contains commas, double-quotes, or newlines
 * - Doubles any internal double-quotes
 */
function escapeCsvValue(value: string): string {
  if (
    value.includes(',') ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r')
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Build a CSV string and trigger a browser download.
 */
export function exportToCsv(
  filename: string,
  headers: string[],
  rows: string[][],
): void {
  const csvLines: string[] = [];

  // Header row
  csvLines.push(headers.map(escapeCsvValue).join(','));

  // Data rows
  for (const row of rows) {
    csvLines.push(row.map(escapeCsvValue).join(','));
  }

  const csvContent = csvLines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
