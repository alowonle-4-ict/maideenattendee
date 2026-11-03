import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import type { ReportMeta } from "@/lib/exports/attendance";

export interface PdfColumn {
  header: string;
  width: number;
  align?: "left" | "right" | "center";
}

export interface PdfReportInput {
  meta: ReportMeta;
  columns: PdfColumn[];
  rows: (string | number)[][];
  totals?: { label: string; value: string }[];
  footnote?: string;
}

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const ROW_HEIGHT = 18;
const HEADER_HEIGHT = 21;

const NAVY = rgb(0.12, 0.16, 0.35);
const BRAND = rgb(0.31, 0.27, 0.9);
const INK = rgb(0.13, 0.15, 0.2);
const MUTED = rgb(0.42, 0.45, 0.5);
const LIGHT = rgb(0.955, 0.965, 0.985);
const WHITE = rgb(1, 1, 1);

function fitText(text: string, maxWidth: number, size: number, font: PDFFont) {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  if (font.widthOfTextAtSize(clean, size) <= maxWidth) return clean;
  let value = clean;
  while (value.length > 1 && font.widthOfTextAtSize(`${value}…`, size) > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value}…`;
}

function metaLines(meta: ReportMeta) {
  const details: string[] = [];
  if (meta.course) details.push(`${meta.course.code} — ${meta.course.title}`);
  if (meta.lecturer) details.push(`Lecturer: ${meta.lecturer}`);
  if (meta.className) details.push(meta.className);
  if (meta.classDate) details.push(meta.classDate);
  if (meta.academicSession) details.push(meta.academicSession);
  if (meta.semester) details.push(meta.semester);
  return details;
}

export async function buildPdfReport(input: PdfReportInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${input.meta.reportTitle} — ${input.meta.institution}`);
  doc.setAuthor("MaideenAttendee");
  doc.setCreator("MaideenAttendee");
  doc.setProducer("MaideenAttendee");

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const totalWeight = input.columns.reduce((sum, column) => sum + column.width, 0) || 1;
  const widths = input.columns.map((column) => (column.width / totalWeight) * CONTENT_WIDTH);

  const details = metaLines(input.meta);
  const totalsLine = (input.totals ?? [])
    .map((total) => `${total.label}: ${total.value}`)
    .join("   ·   ");

  const pages: PDFPage[] = [];
  let page: PDFPage | null = null;
  let cursorY = 0;

  function startPage(continued: boolean) {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);

    page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - 7,
      width: PAGE_WIDTH,
      height: 7,
      color: BRAND,
    });

    page.drawText(fitText(input.meta.institution, CONTENT_WIDTH, 15, bold), {
      x: MARGIN,
      y: PAGE_HEIGHT - 38,
      size: 15,
      font: bold,
      color: NAVY,
    });
    page.drawText(
      fitText(
        continued ? `${input.meta.reportTitle} (continued)` : input.meta.reportTitle,
        CONTENT_WIDTH,
        11,
        bold
      ),
      { x: MARGIN, y: PAGE_HEIGHT - 54, size: 11, font: bold, color: INK }
    );

    let infoY = PAGE_HEIGHT - 70;
    if (!continued && details.length) {
      page.drawText(fitText(details.join("   ·   "), CONTENT_WIDTH, 8, font), {
        x: MARGIN,
        y: infoY,
        size: 8,
        font,
        color: MUTED,
      });
      infoY -= 13;
    }
    if (!continued && totalsLine) {
      page.drawText(fitText(totalsLine, CONTENT_WIDTH, 8, font), {
        x: MARGIN,
        y: infoY,
        size: 8,
        font,
        color: MUTED,
      });
      infoY -= 13;
    }
    page.drawText(
      `Generated ${new Date().toLocaleString("en-NG")} by MaideenAttendee`,
      { x: MARGIN, y: infoY, size: 7.5, font, color: MUTED }
    );

    const tableTop = infoY - 22;
    page.drawRectangle({
      x: MARGIN,
      y: tableTop - HEADER_HEIGHT,
      width: CONTENT_WIDTH,
      height: HEADER_HEIGHT,
      color: NAVY,
    });

    let x = MARGIN;
    input.columns.forEach((column, index) => {
      const width = widths[index];
      const label = fitText(column.header, width - 8, 8.5, bold);
      const textWidth = bold.widthOfTextAtSize(label, 8.5);
      const textX =
        column.align === "right"
          ? x + width - 4 - textWidth
          : column.align === "center"
            ? x + (width - textWidth) / 2
            : x + 4;
      page!.drawText(label, {
        x: textX,
        y: tableTop - 14,
        size: 8.5,
        font: bold,
        color: WHITE,
      });
      x += width;
    });

    cursorY = tableTop - HEADER_HEIGHT;
  }

  startPage(false);

  let stripe = false;
  for (const row of input.rows) {
    if (cursorY - ROW_HEIGHT < MARGIN + 26) {
      startPage(true);
      stripe = false;
    }

    if (stripe) {
      page!.drawRectangle({
        x: MARGIN,
        y: cursorY - ROW_HEIGHT,
        width: CONTENT_WIDTH,
        height: ROW_HEIGHT,
        color: LIGHT,
      });
    }
    stripe = !stripe;

    let x = MARGIN;
    input.columns.forEach((column, index) => {
      const width = widths[index];
      const raw = String(row[index] ?? "");
      const text = fitText(raw, width - 8, 8.5, font);
      const textWidth = font.widthOfTextAtSize(text, 8.5);
      const textX =
        column.align === "right"
          ? x + width - 4 - textWidth
          : column.align === "center"
            ? x + (width - textWidth) / 2
            : x + 4;
      const color =
        raw.toUpperCase() === "ABSENT" || raw === "A"
          ? rgb(0.72, 0.11, 0.11)
          : raw.toUpperCase() === "LATE" || raw === "L"
            ? rgb(0.7, 0.32, 0.05)
            : INK;
      page!.drawText(text, {
        x: textX,
        y: cursorY - 12.5,
        size: 8.5,
        font,
        color,
      });
      x += width;
    });
    cursorY -= ROW_HEIGHT;
  }

  if (!input.rows.length) {
    page!.drawText("No records match this report.", {
      x: MARGIN + 4,
      y: cursorY - 14,
      size: 9,
      font,
      color: MUTED,
    });
    cursorY -= ROW_HEIGHT;
  }

  const footNoteY = Math.max(cursorY - 18, MARGIN + 30);
  if (input.footnote) {
    page!.drawText(fitText(input.footnote, CONTENT_WIDTH, 7.5, font), {
      x: MARGIN,
      y: footNoteY,
      size: 7.5,
      font,
      color: MUTED,
    });
  }

  const total = pages.length;
  pages.forEach((current, index) => {
    current.drawText(
      `Page ${index + 1} of ${total}  ·  MaideenAttendee attendance report  ·  Confidential`,
      { x: MARGIN, y: 20, size: 7, font, color: MUTED }
    );
  });

  return doc.save();
}

export function pdfResponse(bytes: Uint8Array, filename: string) {
  const safe = filename.replace(/[^a-z0-9-_.]+/gi, "-");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safe}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function pdfFilename(parts: (string | null | undefined)[]) {
  return `${parts.filter(Boolean).join("-")}.pdf`;
}
