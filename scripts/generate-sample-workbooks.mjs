import { mkdir } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";

const OUT_DIR = path.resolve("public/templates");

const BRAND = "FF1E1B4B";

const STUDENTS = [
  { full_name: "Amina Bello", matric_number: "2023/CSC/041", email: "", phone: "08031234501", department_code: "CSC", password: "Student#2026" },
  { full_name: "Chinedu Okafor", matric_number: "2023/CSC/017", email: "chinedu.okafor@example.com", phone: "08031234502", department_code: "CSC", password: "Student#2026" },
  { full_name: "Fatima Yusuf", matric_number: "2023/CSC/029", email: "", phone: "08031234503", department_code: "CSC", password: "Student#2026" },
  { full_name: "Ibrahim Musa", matric_number: "2023/CSC/008", email: "", phone: "08031234504", department_code: "CSC", password: "Student#2026" },
  { full_name: "Grace Adeyemi", matric_number: "2023/CSC/012", email: "", phone: "08031234505", department_code: "CSC", password: "Student#2026" },
  { full_name: "Tunde Balogun", matric_number: "2023/CSC/024", email: "", phone: "08031234506", department_code: "CSC", password: "Student#2026" },
  { full_name: "Ngozi Eze", matric_number: "2023/CSC/033", email: "", phone: "08031234507", department_code: "CSC", password: "Student#2026" },
  { full_name: "Samuel Ogunleye", matric_number: "2023/CSC/052", email: "", phone: "08031234508", department_code: "CSC", password: "Student#2026" },
  { full_name: "Blessing Nwosu", matric_number: "2023/CSC/064", email: "", phone: "08031234509", department_code: "CSC", password: "Student#2026" },
  { full_name: "Yusuf Danjuma", matric_number: "2023/CSC/071", email: "", phone: "08031234510", department_code: "CSC", password: "Student#2026" },
  { full_name: "Chioma Obi", matric_number: "2023/CSC/085", email: "", phone: "08031234511", department_code: "CSC", password: "Student#2026" },
  { full_name: "Abdulrahman Sani", matric_number: "2023/CSC/093", email: "", phone: "08031234512", department_code: "CSC", password: "Student#2026" },
];

function styleHeader(sheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  header.alignment = { vertical: "middle" };
  header.height = 24;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
  sheet.eachRow((row, index) => {
    if (index === 1) return;
    row.alignment = { vertical: "middle" };
    row.height = 20;
  });
}

function addInstructions(workbook, rows) {
  const sheet = workbook.addWorksheet("Instructions");
  sheet.columns = [{ key: "text", width: 96 }];
  const lines = [
    ["maideenattendee — sample import workbook"],
    [""],
    ["This file is an example only. Replace the sample rows with your own data before uploading."],
    ["Keep the header row on the first sheet. The importer reads the first sheet and matches columns by name."],
    [""],
    ...rows,
  ];
  lines.forEach(([text], index) => {
    const row = sheet.addRow({ text });
    if (index === 0) row.font = { bold: true, size: 14 };
    row.alignment = { wrapText: true, vertical: "top" };
  });
  return sheet;
}

async function buildAdminWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "maideenattendee";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Students");
  sheet.columns = [
    { header: "full_name", key: "full_name", width: 30 },
    { header: "matric_number", key: "matric_number", width: 22 },
    { header: "email", key: "email", width: 34 },
    { header: "phone", key: "phone", width: 18 },
    { header: "department_code", key: "department_code", width: 20 },
    { header: "password", key: "password", width: 20 },
  ];
  STUDENTS.forEach((student) => sheet.addRow(student));
  styleHeader(sheet);

  addInstructions(workbook, [
    ["Column guide"],
    ["full_name — required. The student's name as it should appear in reports."],
    ["matric_number — required, and must be unique within your institution."],
    ["email — optional. Leave blank to generate a temporary address from the matric number."],
    ["phone — optional."],
    ["department_code — optional, but must match an existing department code in your institution."],
    ["password — optional. Minimum 8 characters. Leave blank to generate a temporary password."],
    [""],
    ["Importing this file creates accounts, issues permanent QR credentials, and lists the credentials once so you can share them securely."],
  ]);

  await workbook.xlsx.writeFile(path.join(OUT_DIR, "students-import-sample.xlsx"));
}

async function buildCourseWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "maideenattendee";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Students");
  sheet.columns = [
    { header: "Matric No", key: "matric_no", width: 24 },
    { header: "Full Name", key: "full_name", width: 32 },
    { header: "Password", key: "password", width: 20 },
  ];
  STUDENTS.slice(0, 8).forEach((student) =>
    sheet.addRow({
      matric_no: student.matric_number,
      full_name: student.full_name,
      password: student.password,
    })
  );
  styleHeader(sheet);

  addInstructions(workbook, [
    ["Column guide"],
    ["Matric No — required. Existing students are matched by this value and enrolled."],
    ["Full Name — required."],
    ["Password — required for new accounts, minimum 8 characters. Existing students keep their current password."],
    [""],
    ["Only students on this sheet are enrolled in the course. Lecturers cannot mark attendance for a student who is not registered."],
  ]);

  await workbook.xlsx.writeFile(path.join(OUT_DIR, "course-students-sample.xlsx"));
}

await mkdir(OUT_DIR, { recursive: true });
await buildAdminWorkbook();
await buildCourseWorkbook();
console.log(`Sample workbooks written to ${OUT_DIR}`);
