import type { AppRole } from "@/lib/types";

export interface NavGroup {
  title?: string;
  items: { label: string; href: string; icon: string; exact?: boolean }[];
}

export const NAVIGATION: Record<AppRole, NavGroup[]> = {
  super_admin: [
    {
      title: "Platform",
      items: [
        { label: "Overview", href: "/platform", icon: "LayoutDashboard", exact: true },
        { label: "Institutions", href: "/platform/institutions", icon: "Building2" },
        { label: "Users", href: "/platform/users", icon: "Users" },
      ],
    },
    {
      title: "Revenue",
      items: [
        { label: "Subscription plans", href: "/platform/plans", icon: "Layers" },
        { label: "Subscriptions", href: "/platform/subscriptions", icon: "CreditCard" },
        { label: "Payments", href: "/platform/payments", icon: "Receipt" },
        { label: "Revenue analytics", href: "/platform/revenue", icon: "TrendingUp" },
        { label: "Payment gateways", href: "/platform/gateways", icon: "Wallet" },
      ],
    },
    {
      title: "Operations",
      items: [
        { label: "Support tickets", href: "/platform/support", icon: "LifeBuoy" },
        { label: "Audit logs", href: "/platform/audit-logs", icon: "ScrollText" },
        { label: "Platform settings", href: "/platform/settings", icon: "Settings" },
      ],
    },
  ],
  institution_admin: [
    {
      title: "Overview",
      items: [
        { label: "Dashboard", href: "/admin", icon: "LayoutDashboard", exact: true },
      ],
    },
    {
      title: "People",
      items: [
        { label: "Students", href: "/admin/students", icon: "GraduationCap" },
        { label: "Lecturers", href: "/admin/lecturers", icon: "UserRound" },
      ],
    },
    {
      title: "Academics",
      items: [
        { label: "Faculties", href: "/admin/faculties", icon: "School" },
        { label: "Departments", href: "/admin/departments", icon: "Network" },
        { label: "Campuses", href: "/admin/campuses", icon: "MapPin" },
        { label: "Courses", href: "/admin/courses", icon: "BookOpen" },
        { label: "Course assignments", href: "/admin/assignments", icon: "UserCheck" },
        { label: "Course registrations", href: "/admin/registrations", icon: "ClipboardList" },
        { label: "Academic sessions", href: "/admin/academic-sessions", icon: "CalendarRange" },
        { label: "Semesters", href: "/admin/semesters", icon: "CalendarDays" },
      ],
    },
    {
      title: "Attendance",
      items: [
        { label: "Sessions", href: "/admin/attendance", icon: "ScanLine" },
        { label: "Reports", href: "/admin/reports", icon: "FileBarChart" },
      ],
    },
    {
      title: "Billing",
      items: [
        { label: "Subscription", href: "/admin/subscription", icon: "CreditCard" },
        { label: "Billing history", href: "/admin/billing", icon: "Receipt" },
        { label: "Settings", href: "/admin/settings", icon: "Settings" },
      ],
    },
  ],
  lecturer: [
    {
      title: "Teaching",
      items: [
        { label: "Overview", href: "/lecturer", icon: "LayoutDashboard", exact: true },
        { label: "My courses", href: "/lecturer/courses", icon: "BookOpen" },
        { label: "Start attendance", href: "/lecturer/attendance/new", icon: "ScanLine" },
      ],
    },
    {
      title: "Attendance",
      items: [
        { label: "Attendance history", href: "/lecturer/history", icon: "History" },
        { label: "Students", href: "/lecturer/students", icon: "Users" },
        { label: "Exports", href: "/lecturer/exports", icon: "FileSpreadsheet" },
      ],
    },
    {
      title: "Account",
      items: [{ label: "Profile", href: "/lecturer/profile", icon: "UserCog" }],
    },
  ],
  student: [
    {
      title: "Student",
      items: [
        { label: "Overview", href: "/student", icon: "LayoutDashboard", exact: true },
        { label: "My QR code", href: "/student/qr", icon: "QrCode" },
        { label: "My courses", href: "/student/courses", icon: "BookOpen" },
        { label: "Attendance", href: "/student/attendance", icon: "CalendarCheck" },
        { label: "Statistics", href: "/student/stats", icon: "BarChart3" },
      ],
    },
    {
      title: "Account",
      items: [
        { label: "Notifications", href: "/student/notifications", icon: "Bell" },
        { label: "Profile", href: "/student/profile", icon: "UserCog" },
      ],
    },
  ],
};
