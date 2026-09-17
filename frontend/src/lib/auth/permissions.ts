export type Role =
  | "Admin"
  | "Legal Manager"
  | "Contract Manager"
  | "Compliance Officer"
  | "Viewer";

export type Permission =
  | "contracts:view"
  | "contracts:create"
  | "contracts:edit"
  | "contracts:delete"
  | "contracts:approve"
  | "contracts:activate"
  | "contracts:submit_review"
  | "contracts:assign"
  | "obligations:view"
  | "obligations:create"
  | "obligations:edit"
  | "obligations:delete"
  | "obligations:complete"
  | "renewals:view"
  | "renewals:create"
  | "renewals:edit"
  | "renewals:delete"
  | "renewals:process"
  | "compliance:view"
  | "reports:view"
  | "reports:create"
  | "reports:delete"
  | "audit_logs:view"
  | "activities:view"
  | "activities:export"
  | "activities:delete"
  | "users:manage";

const ROLE_ALIASES: Record<string, Role> = {
  admin: "Admin",
  administrator: "Admin",
  legal: "Legal Manager",
  "legal manager": "Legal Manager",
  "contract manager": "Contract Manager",
  procurement: "Contract Manager",
  "procurement officer": "Contract Manager",
  compliance: "Compliance Officer",
  "compliance officer": "Compliance Officer",
  viewer: "Viewer",
  employee: "Viewer",
  "department head": "Viewer",
};

export function normalizeRole(role?: string | null): Role {
  if (!role) return "Viewer";
  const cleaned = role.trim().toLowerCase();
  return ROLE_ALIASES[cleaned] ?? (role as Role);
}

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  Admin: [
    "contracts:view",
    "contracts:create",
    "contracts:edit",
    "contracts:delete",
    "contracts:approve",
    "contracts:activate",
    "contracts:submit_review",
    "contracts:assign",
    "obligations:view",
    "obligations:create",
    "obligations:edit",
    "obligations:delete",
    "obligations:complete",
    "renewals:view",
    "renewals:create",
    "renewals:edit",
    "renewals:delete",
    "renewals:process",
    "compliance:view",
    "reports:view",
    "reports:create",
    "reports:delete",
    "audit_logs:view",
    "activities:view",
    "activities:export",
    "activities:delete",
    "users:manage",
  ],
  "Legal Manager": [
    "contracts:view",
    "contracts:create",
    "contracts:edit",
    "contracts:approve",
    "contracts:activate",
    "contracts:submit_review",
    "contracts:assign",
    "obligations:view",
    "obligations:create",
    "obligations:edit",
    "obligations:delete",
    "obligations:complete",
    "renewals:view",
    "renewals:create",
    "renewals:edit",
    "renewals:process",
    "compliance:view",
    "reports:view",
    "reports:create",
    "audit_logs:view",
    "activities:view",
  ],
  "Contract Manager": [
    "contracts:view",
    "contracts:create",
    "contracts:edit",
    "contracts:submit_review",
    "obligations:view",
    "obligations:create",
    "obligations:edit",
    "obligations:complete",
    "renewals:view",
    "renewals:create",
    "renewals:edit",
    "renewals:process",
    "compliance:view",
    "reports:view",
    "reports:create",
    "activities:view",
  ],
  "Compliance Officer": [
    "contracts:view",
    "obligations:view",
    "renewals:view",
    "compliance:view",
    "reports:view",
    "reports:create",
    "audit_logs:view",
    "activities:view",
    "activities:export",
  ],
  Viewer: [
    "contracts:view",
    "obligations:view",
    "renewals:view",
    "compliance:view",
    "reports:view",
    "activities:view",
  ],
};

export function hasPermission(
  role: string | undefined | null,
  permission: Permission,
): boolean {
  const norm = normalizeRole(role);
  const permissions = ROLE_PERMISSIONS[norm] ?? [];
  return permissions.includes(permission);
}

export function hasAnyPermission(
  role: string | undefined | null,
  permissions: Permission[],
): boolean {
  return permissions.some((perm) => hasPermission(role, perm));
}

export function hasAllPermissions(
  role: string | undefined | null,
  permissions: Permission[],
): boolean {
  return permissions.every((perm) => hasPermission(role, perm));
}

export function canEditContract(
  user: { id?: number; role?: string } | null,
  contract?: { created_by?: number | null; assigned_to?: number | null } | null,
): boolean {
  if (!user || !user.role) return false;
  const norm = normalizeRole(user.role);
  if (norm === "Admin" || norm === "Legal Manager") return true;
  if (norm === "Contract Manager" && contract && user.id) {
    return contract.created_by === user.id || contract.assigned_to === user.id;
  }
  return false;
}

export function canApproveContract(user: { role?: string } | null): boolean {
  if (!user || !user.role) return false;
  const norm = normalizeRole(user.role);
  return norm === "Admin" || norm === "Legal Manager";
}

export function canDeleteContract(user: { role?: string } | null): boolean {
  if (!user || !user.role) return false;
  const norm = normalizeRole(user.role);
  return norm === "Admin";
}

export function canGenerateReportType(
  role: string | undefined | null,
  reportType: string
): boolean {
  const norm = normalizeRole(role);
  if (norm === "Admin" || norm === "Legal Manager") return true;
  if (norm === "Compliance Officer") {
    return reportType === "Compliance Report" || reportType === "Obligation Report";
  }
  if (norm === "Contract Manager") {
    return reportType === "Contract Report" || reportType === "Renewal Report";
  }
  return false;
}

export function canDeleteReport(role: string | undefined | null): boolean {
  return normalizeRole(role) === "Admin";
}

