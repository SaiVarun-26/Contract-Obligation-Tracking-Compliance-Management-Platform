export type DashboardSummary = {
  contracts: Record<string, number>;
  obligations: Record<string, number>;
  renewals: Record<string, number>;
};
export type StatusCount = { status: string; count: number };
export type UpcomingRenewal = {
  id: number;
  contract_id: number;
  contract_title: string;
  renewal_date: string;
  previous_expiry_date: string;
  new_expiry_date: string;
  status: string;
};

export type Contract = {
  id: number;
  title: string;
  contract_number: string;
  category: string;
  description: string;
  start_date: string;
  end_date: string;
  status: string;
  department: string | null;
  assigned_to: number | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
};
export type Obligation = {
  id: number;
  contract_id: number;
  title: string;
  description: string;
  obligation_type: string;
  priority: string | null;
  due_date: string;
  assigned_to: number | null;
  status: string;
  completion_date?: string | null;
};
export type Renewal = {
  id: number;
  contract_id: number;
  renewal_date: string;
  previous_expiry_date: string;
  new_expiry_date: string;
  status: string;
  assigned_to: number | null;
  notes: string | null;
};
export type Notification = {
  id: number;
  user_id: number | null;
  contract_id: number | null;
  obligation_id: number | null;
  title: string;
  message: string;
  status: string;
  notification_type: string;
  created_at: string;
  scheduled_at: string | null;
  sent_at: string | null;
  read_at: string | null;
};
export type Compliance = {
  contract_id: number;
  contract_title: string;
  compliance_score: number;
  status: string;
  risk_level: string;
  overdue: number;
  total_obligations?: number;
  completed?: number;
  pending?: number;
};
export type ComplianceTimeline = { date: string; reason: string; status: string };
export type Report = {
  id: number;
  report_name: string;
  report_type: string;
  file_path: string;
  file_format: string;
  status: string;
  download_count: number;
  generated_at?: string | null;
  generated_by: number | null;
  generated_by_name?: string | null;
};
export type ActivityLog = {
  id: number;
  timestamp: string;
  created_at?: string | null;
  user_id?: number | null;
  user_name?: string | null;
  user_role?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: number | null;
  contract_id?: number | null;
  description: string;
  activity?: string | null;
  ip_address?: string | null;
  status: string;
  metadata?: Record<string, unknown> | null;
};

export type ActivityListResponse = {
  items: ActivityLog[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};
export type UserAssignee = { id: number; full_name: string; role: string };
export type AuditLog = {
  id: number;
  user_id: number;
  action: string;
  table_name: string;
  record_id: number;
};
export type User = {
  id: number;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  avatar_url?: string | null;
  last_login?: string | null;
  preferences?: Record<string, unknown> | null;
  created_at?: string | null;
};
