import "server-only";

export type ImportRow = Record<string, string>;

export function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function pickValue(record: ImportRow, keys: string[]) {
  for (const key of keys) {
    const value = record[normalizeKey(key)];
    if (value && value.trim()) return value.trim();
  }
  return "";
}

function parseCsv(text: string): ImportRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length < 2) return [];
  const headers = rows[0].map(normalizeKey);
  return rows
    .slice(1)
    .filter((cells) => cells.some((cell) => cell.trim().length > 0))
    .map((cells) => {
      const record: ImportRow = {};
      headers.forEach((header, index) => {
        record[header] = (cells[index] ?? "").trim();
      });
      return record;
    });
}

export async function readTabularFile(file: File): Promise<ImportRow[]> {
  const name = file.name.toLowerCase();

  try {
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(Buffer.from(await file.arrayBuffer()) as never);
      const sheet = workbook.worksheets[0];
      if (!sheet) throw new Error("The workbook contains no sheets.");

      const headerRow = sheet.getRow(1);
      const headers: string[] = [];
      headerRow.eachCell((cell, col) => {
        headers[col] = normalizeKey(String(cell.value ?? ""));
      });

      const records: ImportRow[] = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const record: ImportRow = {};
        headers.forEach((header, col) => {
          if (!header) return;
          record[header] = String(row.getCell(col).text ?? "").trim();
        });
        if (Object.values(record).some((value) => value.length > 0)) {
          records.push(record);
        }
      });
      return records;
    }

    return parseCsv(await file.text());
  } catch (error) {
    if (error instanceof Error && error.message === "The workbook contains no sheets.") {
      throw error;
    }
    throw new Error("Could not read the file. Use a valid CSV or XLSX workbook.");
  }
}
