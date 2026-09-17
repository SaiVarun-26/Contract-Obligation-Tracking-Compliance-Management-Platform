import { apiClient } from "./client";
import type {
  ActivityLog,
  AuditLog,
  Compliance,
  Contract,
  Notification,
  Obligation,
  Renewal,
  Report,
  User,
  ComplianceTimeline,
} from "./types";

const resource = <T>(path: string, listPath = path) => ({
  list: () => apiClient.get<T[]>(listPath).then((r) => r.data),
  get: (id: number) => apiClient.get<T>(`${path}/${id}`).then((r) => r.data),
  create: (data: unknown) => apiClient.post<T>(path, data).then((r) => r.data),
  update: (id: number, data: unknown) =>
    apiClient.put<T>(`${path}/${id}`, data).then((r) => r.data),
  delete: (id: number) => apiClient.delete(`${path}/${id}`),
});

export const contracts = {
  ...resource<Contract>("/contracts", "/contracts/"),
  status: (id: number, status: string) =>
    apiClient.patch<Contract>(`/contracts/${id}/status`, { status }).then((r) => r.data),
  submitReview: (id: number) =>
    apiClient.post<Contract>(`/contracts/${id}/submit-review`).then((r) => r.data),
  approve: (id: number) => apiClient.post<Contract>(`/contracts/${id}/approve`).then((r) => r.data),
  activate: (id: number) =>
    apiClient.post<Contract>(`/contracts/${id}/activate`).then((r) => r.data),
  assign: (id: number, assigned_to: number) =>
    apiClient.patch<Contract>(`/contracts/${id}/assign`, { assigned_to }).then((r) => r.data),
  transition: (id: number, status: string) =>
    apiClient.patch<Contract>(`/contracts/${id}/status`, { status }).then((r) => r.data),
};
export const obligations = {
  ...resource<Obligation>("/obligations"),
  forContract: (id: number) =>
    apiClient.get<Obligation[]>(`/obligations/contract/${id}`).then((r) => r.data),
  status: (id: number, status: string) =>
    apiClient.patch<Obligation>(`/obligations/${id}/status`, { status }).then((r) => r.data),
  delete: (id: number) => apiClient.delete(`/obligations/${id}`),
};
export const renewals = {
  ...resource<Renewal>("/renewals", "/renewals/"),
  forContract: (id: number) =>
    apiClient.get<Renewal[]>(`/renewals/contract/${id}`).then((r) => r.data),
  status: (id: number, status: string) =>
    apiClient.patch<Renewal>(`/renewals/${id}/status`, { status }).then((r) => r.data),
  renew: (id: number) => apiClient.post<Renewal>(`/renewals/${id}/renew`).then((r) => r.data),
};
export const notifications = {
  ...resource<Notification>("/notifications", "/notifications/"),
  markRead: (id: number) =>
    apiClient.patch<Notification>(`/notifications/${id}/read`).then((r) => r.data),
  delete: (id: number) => apiClient.delete(`/notifications/${id}`),
};
export const reports = {
  ...resource<Report>("/reports", "/reports/"),
  generate: (data: { report_type: string; file_format: "pdf" | "excel"; report_name?: string }) =>
    apiClient.post<Report>("/reports/generate", data).then((r) => r.data),
  delete: (id: number) => apiClient.delete(`/reports/${id}`).then((r) => r.data),
};

export interface ActivityFilterParams {
  page?: number;
  page_size?: number;
  action?: string;
  status?: string;
  user_id?: number;
  role?: string;
  entity_type?: string;
  contract_id?: number;
  start_date?: string;
  end_date?: string;
  search?: string;
  order?: "asc" | "desc";
}

export const activities = {
  ...resource<ActivityLog>("/activities", "/activities/"),
  list: async (params?: ActivityFilterParams) => {
    const res = await apiClient.get<import("./types").ActivityListResponse | ActivityLog[]>("/activities", { params });
    if (Array.isArray(res.data)) {
      return res.data;
    }
    return res.data?.items || [];
  },
  listPaginated: async (params?: ActivityFilterParams) => {
    const res = await apiClient.get<import("./types").ActivityListResponse>("/activities", { params });
    return res.data;
  },
  downloadExport: async (format: "csv" | "excel" | "pdf", params?: ActivityFilterParams, fallbackFilename?: string) => {
    const response = await apiClient.get(`/activities/export/${format}`, {
      params,
      responseType: "blob",
    });
    const blob = new Blob([response.data], {
      type: response.headers["content-type"] || "application/octet-stream",
    });
    const url = URL.createObjectURL(blob);
    let filename = fallbackFilename;
    const disposition = response.headers["content-disposition"];
    if (disposition && disposition.includes("filename=")) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match?.[1]) filename = match[1];
    }
    if (!filename) {
      const ext = format === "excel" ? "xlsx" : format;
      filename = `activity_logs_${new Date().toISOString().slice(0, 10)}.${ext}`;
    }
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    return filename;
  },
  delete: (id: number) => apiClient.delete(`/activities/${id}`),
};

export const auth = {
  logout: () => apiClient.post("/auth/logout").then((r) => r.data).catch(() => {}),
};
export const auditLogs = resource<AuditLog>("/audit-logs", "/audit-logs/");
export const users = {
  ...resource<User>("/users", "/users/"),
  assignees: () => apiClient.get<import("./types").UserAssignee[]>("/users/assignees").then((r) => r.data),
  delete: (id: number) => apiClient.delete(`/users/${id}`),
};
export const compliance = {
  list: () => apiClient.get<Compliance[]>("/compliance").then((r) => r.data),
  summary: () => apiClient.get("/compliance/summary").then((r) => r.data),
  highRisk: () => apiClient.get<Compliance[]>("/compliance/high-risk").then((r) => r.data),
  nonCompliant: () => apiClient.get<Compliance[]>("/compliance/non-compliant").then((r) => r.data),
  byContract: (id: number) =>
    apiClient.get<Compliance>(`/compliance/contracts/${id}`).then((r) => r.data),
  summary: () => apiClient.get<{ total_contracts: number; compliant: number; partially_compliant: number; non_compliant: number }>("/compliance/summary").then((r) => r.data),
  timeline: () => apiClient.get<ComplianceTimeline[]>("/compliance/timeline").then((r) => r.data),
};
export const reportFiles = {
  download: async (id: number, fallbackName?: string) => {
    const response = await apiClient.get(`/reports/${id}/download`, {
      responseType: "blob",
    });
    const blob = new Blob([response.data], {
      type: response.headers["content-type"] || "application/octet-stream",
    });
    const url = URL.createObjectURL(blob);
    let filename = fallbackName;
    const disposition = response.headers["content-disposition"];
    if (disposition && disposition.includes("filename=")) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match?.[1]) filename = match[1];
    }
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename || `report_${id}`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    return filename;
  },
};
