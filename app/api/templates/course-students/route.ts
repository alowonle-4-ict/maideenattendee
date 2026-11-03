import { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx || !["lecturer", "institution_admin"].includes(ctx.role)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "maideenattendee";
  const sheet = workbook.addWorksheet("Students");

  sheet.columns = [
    { header: "Matric No", key: "matric_no", width: 26 },
    { header: "Full Name", key: "full_name", width: 36 },
    { header: "Password", key: "password", width: 26 },
  ];

  sheet.addRow({ matric_no: "2023/CSC/041", full_name: "Amina Bello", password: "Student#2026" });
  sheet.addRow({ matric_no: "2023/CSC/017", full_name: "Chinedu Okafor", password: "Student#2026" });

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E1B4B" } };
  header.alignment = { vertical: "middle" };
  header.height = 22;
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="maideenattendee-course-students-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
