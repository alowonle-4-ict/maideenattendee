export type AppRole =
  | "super_admin"
  | "institution_admin"
  | "lecturer"
  | "student";

export type InstitutionStatus = "pending" | "active" | "suspended" | "deleted";

export type SessionStatus =
  | "scheduled"
  | "open"
  | "paused"
  | "closed"
  | "cancelled";

export type AttendanceStatus = "present" | "late" | "excused" | "absent";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "expired"
  | "pending"
  | "cancelled";

export type PaymentStatus =
  | "pending"
  | "success"
  | "failed"
  | "abandoned"
  | "refunded";

export interface Profile {
  id: string;
  institution_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  matric_number: string | null;
  staff_number: string | null;
  department_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  institution_id: string | null;
  role: AppRole;
}

export interface Institution {
  id: string;
  name: string;
  slug: string;
  short_name: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  status: InstitutionStatus;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_ngn: number;
  billing_cycle: "monthly" | "semester" | "annual" | "custom";
  max_students: number;
  max_lecturers: number;
  max_courses: number;
  features: string[];
  is_active: boolean;
  sort_order: number;
}

export interface Subscription {
  id: string;
  institution_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  starts_at: string;
  ends_at: string | null;
  trial_ends_at: string | null;
  auto_renew: boolean;
  cancelled_at: string | null;
  created_at: string;
  plan?: SubscriptionPlan;
}

export interface Course {
  id: string;
  institution_id: string;
  department_id: string | null;
  code: string;
  title: string;
  description: string | null;
  credit_units: number;
  level: string | null;
  semester_id: string | null;
  created_at: string;
}

export interface AttendanceSession {
  id: string;
  institution_id: string;
  course_id: string;
  lecturer_id: string;
  title: string;
  class_date: string;
  opens_at: string;
  closes_at: string;
  location: string | null;
  notes: string | null;
  status: SessionStatus;
  opened_at: string | null;
  closed_at: string | null;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  institution_id: string;
  attendance_session_id: string;
  student_id: string;
  course_id: string;
  recorded_by: string;
  status: AttendanceStatus;
  method: "qr" | "manual" | "correction";
  scanned_at: string;
  local_scanned_at: string | null;
  client_transaction_id: string | null;
  sync_source: "online" | "offline";
  device_info: string | null;
  created_at: string;
}

export interface ScanResult {
  ok: boolean;
  code:
    | "SUCCESS"
    | "DUPLICATE"
    | "INVALID_QR"
    | "STUDENT_INACTIVE"
    | "QR_REVOKED"
    | "WRONG_INSTITUTION"
    | "NOT_REGISTERED"
    | "NOT_ASSIGNED"
    | "SESSION_NOT_FOUND"
    | "SESSION_CLOSED"
    | "OUTSIDE_WINDOW"
    | "RATE_LIMITED"
    | "ERROR";
  message: string;
  student?: {
    id: string;
    full_name: string;
    matric_number: string | null;
  };
  course?: { id: string; code: string; title: string };
  session?: { id: string; title: string };
  scanned_at?: string;
  duplicate?: boolean;
}

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: string;
}

export interface DashboardMetrics {
  students?: number;
  lecturers?: number;
  courses?: number;
  sessions?: number;
  records?: number;
  attendanceRate?: number;
}
