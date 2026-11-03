import "server-only";

import ExcelJS from "exceljs";

import type { AttendanceStatus } from "@/lib/types";
import { formatPercent, percentage } from "@/lib/utils";

const NAVY = "FF1E2A5A";
const LIGHT = "FFF3F5FB";
const BORDER_GREY = "FFD9DEEA";

export interface ReportMeta {
  institution: string;
  reportTitle: string;
  course?: { code: string; title: string };
  lecturer?: string | null;
  academicSession?: string | null;
  semester?: string | null;
  className?: string;
  classDate?: string | null;
}

export interface RegisterSession {
  id: string;
  class_date: string;
  title: string;
}

export interface RegisterStudent {
  id: string;
  full_name: string;
  matric_number: string | null;
  department: string | null;
}

export interface RegisterRecord {
  attendance_session_id: string;
  student_id: string;
  status: AttendanceStatus;
  scanned_at: string;
  sync_source: string;
}

function addMetaRows(sheet: ExcelJS.Worksheet, meta: ReportMeta) {
  sheet.mergeCells("A1:E1");
  const title = sheet.getCell("A1");
  title.value = meta.institution;
  title.font = { bold: true, size: 14, color: { argb: NAVY } };

  sheet.mergeCells("A2:E2");
  const subtitle = sheet.getCell("A2");
  subtitle.value = meta.reportTitle;
  subtitle.font = { bold: true, size: 12 };

  const details: string[] = [];
  if (meta.course) details.push(`${meta.course.code} — ${meta.course.title}`);
  if (meta.lecturer) details.push(`Lecturer: ${meta.lecturer}`);
  if (meta.className) details.push(meta.className);
  if (meta.classDate) details.push(meta.classDate);
  if (meta.academicSession) details.push(meta.academicSession);
  if (meta.semester) details.push(meta.semester);

  sheet.mergeCells("A3:E3");
  const detailCell = sheet.getCell("A3");
  detailCell.value = details.join("  ·  ");
  detailCell.font = { size: 10, color: { argb: "FF6B7280" } };

  sheet.mergeCells("A4:E4");
  const generated = sheet.getCell("A4");
  generated.value = `Generated ${new Date().toLocaleString("en-NG")} by MaideenAttendee`;
  generated.font = { size: 9, color: { argb: "FF9CA3AF" } };
}

function styleHeaderRow(sheet: ExcelJS.Worksheet, rowNumber: number, columns: number) {
  const row = sheet.getRow(rowNumber);
  for (let index = 1; index <= columns; index += 1) {
    const cell = row.getCell(index);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = { bottom: { style: "thin", color: { argb: BORDER_GREY } } };
  }
  row.height = 22;
}

function applyBodyStyle(sheet: ExcelJS.Worksheet, startRow: number, columns: number) {
  for (let rowIndex = startRow; rowIndex <= sheet.rowCount; rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    for (let col = 1; col <= columns; col += 1) {
      const cell = row.getCell(col);
      cell.border = { bottom: { style: "hair", color: { argb: BORDER_GREY } } };
      if (rowIndex % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT } };
      }
    }
  }
}

function addSessionColumns(sheet: ExcelJS.Worksheet, startColumn: number, sessions: RegisterSession[]) {
  sessions.forEach((session, index) => {
    const cell = sheet.getRow(5).getCell(startColumn + index);
    cell.value = `${session.class_date}\n${session.title}`;
    cell.alignment = { wrapText: true, vertical: "middle" };
  });
  styleHeaderRow(sheet, 5, startColumn + sessions.length - 1);
}

export async function buildSessionWorkbook(
  meta: ReportMeta,
  students: RegisterStudent[],
  records: RegisterRecord[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MaideenAttendee";
  const sheet = workbook.addWorksheet("Class attendance");

  addMetaRows(sheet, meta);
  const headerRow = 6;
  sheet.getRow(headerRow).values = [
    "Student name",
    "Matric number",
    "Department",
    "Time scanned",
    "Status",
  ];
  styleHeaderRow(sheet, headerRow, 5);

  const recordMap = new Map(records.map((record) => [record.student_id, record]));
  students.forEach((student, index) => {
    const record = recordMap.get(student.id);
    const row = sheet.getRow(headerRow + 1 + index);
    row.values = [
      student.full_name,
      student.matric_number ?? "",
      student.department ?? "",
      record ? new Date(record.scanned_at).toLocaleTimeString("en-NG") : "",
      record ? record.status.toUpperCase() : "ABSENT",
    ];
    if (!record) {
      row.getCell(5).font = { color: { argb: "FFB91C1C" }, bold: true };
    } else if (record.status === "late") {
      row.getCell(5).font = { color: { argb: "FFB45309" }, bold: true };
    } else {
      row.getCell(5).font = { color: { argb: "FF15803D" }, bold: true };
    }
  });

  applyBodyStyle(sheet, headerRow + 1, 5);
  sheet.columns = [{ width: 32 }, { width: 18 }, { width: 26 }, { width: 16 }, { width: 14 }];
  sheet.views = [{ state: "frozen", ySplit: headerRow }];

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function buildCourseRegisterWorkbook(
  meta: ReportMeta,
  sessions: RegisterSession[],
  students: RegisterStudent[],
  records: RegisterRecord[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MaideenAttendee";
  const sheet = workbook.addWorksheet("Attendance register");

  addMetaRows(sheet, meta);

  const firstSessionColumn = 4;
  const lastSessionColumn = firstSessionColumn + Math.max(sessions.length, 1) - 1;
  sheet.mergeCells(5, 1, 5, 3);
  sheet.getCell(5, 1).value = "Student";
  addSessionColumns(sheet, firstSessionColumn, sessions);
  const percentColumn = lastSessionColumn + 1;
  sheet.getRow(5).getCell(percentColumn).value = "Percentage";

  const key = (sessionId: string, studentId: string) => `${sessionId}:${studentId}`;
  const recordMap = new Map(records.map((record) => [key(record.attendance_session_id, record.student_id), record]));

  students.forEach((student, rowIndex) => {
    const row = sheet.getRow(6 + rowIndex);
    row.getCell(1).value = student.full_name;
    row.getCell(2).value = student.matric_number ?? "";
    row.getCell(3).value = student.department ?? "";

    let attended = 0;
    sessions.forEach((session, index) => {
      const record = recordMap.get(key(session.id, student.id));
      const cell = row.getCell(firstSessionColumn + index);
      if (record) {
        attended += 1;
        cell.value = record.status === "late" ? "L" : record.status === "excused" ? "E" : "P";
        cell.alignment = { horizontal: "center" };
        cell.font = { color: { argb: record.status === "late" ? "FFB45309" : "FF15803D" }, bold: true };
      } else {
        cell.value = "A";
        cell.alignment = { horizontal: "center" };
        cell.font = { color: { argb: "FFB91C1C" } };
      }
    });

    const pct = percentage(attended, sessions.length);
    const pctCell = row.getCell(percentColumn);
    pctCell.value = pct / 100;
    pctCell.numFmt = "0.00%";
    pctCell.font = { bold: true, color: { argb: pct >= 75 ? "FF15803D" : pct >= 50 ? "FFB45309" : "FFB91C1C" } };
  });

  const footerRow = 6 + students.length;
  sheet.mergeCells(footerRow, 1, footerRow, 3);
  const footer = sheet.getCell(footerRow, 1);
  footer.value = "Key: P = Present, L = Late, E = Excused, A = Absent";
  footer.font = { italic: true, size: 9, color: { argb: "FF6B7280" } };

  applyBodyStyle(sheet, 6, percentColumn);
  const columns: Partial<ExcelJS.Column>[] = [{ width: 30 }, { width: 16 }, { width: 24 }];
  sessions.forEach(() => columns.push({ width: 12 }));
  columns.push({ width: 12 });
  sheet.columns = columns;
  sheet.views = [{ state: "frozen", xSplit: 3, ySplit: 5 }];

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function buildCourseSummaryWorkbook(
  meta: ReportMeta,
  students: RegisterStudent[],
  sessionsHeld: number,
  records: RegisterRecord[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MaideenAttendee";
  const sheet = workbook.addWorksheet("Attendance summary");

  addMetaRows(sheet, meta);
  sheet.getRow(6).values = [
    "Student name",
    "Matric number",
    "Department",
    "Classes held",
    "Present",
    "Absent",
    "Attendance %",
  ];
  styleHeaderRow(sheet, 6, 7);

  const counts = new Map<string, number>();
  records.forEach((record) => {
    counts.set(record.student_id, (counts.get(record.student_id) ?? 0) + 1);
  });

  students.forEach((student, index) => {
    const present = counts.get(student.id) ?? 0;
    const absent = Math.max(sessionsHeld - present, 0);
    const pct = percentage(present, sessionsHeld);
    const row = sheet.getRow(7 + index);
    row.values = [
      student.full_name,
      student.matric_number ?? "",
      student.department ?? "",
      sessionsHeld,
      present,
      absent,
      pct / 100,
    ];
    row.getCell(7).numFmt = "0.00%";
    row.getCell(7).font = { bold: true, color: { argb: pct >= 75 ? "FF15803D" : pct >= 50 ? "FFB45309" : "FFB91C1C" } };
  });

  applyBodyStyle(sheet, 7, 7);
  sheet.columns = [{ width: 32 }, { width: 18 }, { width: 26 }, { width: 13 }, { width: 10 }, { width: 10 }, { width: 14 }];
  sheet.views = [{ state: "frozen", ySplit: 6 }];

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export interface InstitutionCourseRow {
  courseCode: string;
  courseTitle: string;
  lecturer: string;
  registered: number;
  sessionsHeld: number;
  present: number;
  attendanceRate: number;
}

export async function buildInstitutionWorkbook(
  meta: ReportMeta,
  rows: InstitutionCourseRow[],
  totals: { students: number; lecturers: number; courses: number; sessions: number; records: number }
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MaideenAttendee";

  const summary = workbook.addWorksheet("Overview");
  addMetaRows(summary, meta);
  summary.getRow(6).values = ["Metric", "Value"];
  styleHeaderRow(summary, 6, 2);
  const metrics: [string, number][] = [
    ["Students", totals.students],
    ["Lecturers", totals.lecturers],
    ["Courses", totals.courses],
    ["Attendance sessions", totals.sessions],
    ["Attendance records", totals.records],
  ];
  metrics.forEach(([label, value], index) => {
    summary.getRow(7 + index).values = [label, value];
  });
  applyBodyStyle(summary, 7, 2);
  summary.columns = [{ width: 32 }, { width: 18 }];

  const sheet = workbook.addWorksheet("Course attendance");
  const header = 2;
  sheet.getRow(header).values = [
    "Course code",
    "Course title",
    "Lecturer",
    "Registered students",
    "Sessions held",
    "Total present",
    "Average attendance",
  ];
  styleHeaderRow(sheet, header, 7);

  rows.forEach((row, index) => {
    const excelRow = sheet.getRow(header + 1 + index);
    excelRow.values = [
      row.courseCode,
      row.courseTitle,
      row.lecturer || "—",
      row.registered,
      row.sessionsHeld,
      row.present,
      Math.round(row.attendanceRate * 10) / 1000,
    ];
    excelRow.getCell(7).numFmt = "0.00%";
  });

  applyBodyStyle(sheet, header + 1, 7);
  sheet.columns = [{ width: 16 }, { width: 36 }, { width: 26 }, { width: 18 }, { width: 14 }, { width: 14 }, { width: 18 }];
  sheet.views = [{ state: "frozen", ySplit: header }];

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function excelResponse(buffer: Buffer, filename: string) {
  const safe = filename.replace(/[^a-z0-9-_.]+/gi, "-");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safe}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function reportFilename(parts: (string | null | undefined)[]) {
  return `${parts.filter(Boolean).join("-")}.xlsx`;
}

export function attendancePercentLabel(present: number, total: number) {
  return formatPercent(percentage(present, total));
}
