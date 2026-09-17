import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, FileCheck2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { contracts, obligations, users } from "@/lib/api/resources";
import { useAuth } from "@/lib/auth/auth-context";
import { hasPermission } from "@/lib/auth/permissions";
import type { Obligation } from "@/lib/api/types";

export const Route = createFileRoute("/obligations")({ component: ObligationsPage });
const blank = { contract_id: "", title: "", description: "", obligation_type: "", priority: "Medium", due_date: "", assigned_to: "" };

function ObligationsPage() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<Obligation | null>(null);
  const [busy, setBusy] = useState(false);
  const list = useQuery({ queryKey: ["obligations"], queryFn: obligations.list });
  const contractList = useQuery({ queryKey: ["contracts"], queryFn: contracts.list });
  const userList = useQuery({ queryKey: ["users", "assignees"], queryFn: users.assignees });

  const canCreate = hasPermission(user?.role, "obligations:create");
  const canEdit = hasPermission(user?.role, "obligations:edit");
  const canDelete = hasPermission(user?.role, "obligations:delete");

  const refresh = async (contractId?: number) => {
    for (const key of [["obligations"], ["dashboard", "summary"], ["dashboard", "obligation-status"]]) await client.invalidateQueries({ queryKey: key });
    if (contractId) await client.invalidateQueries({ queryKey: ["obligations", "contract", contractId] });
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    try {
      const data = { ...form, contract_id: Number(form.contract_id), assigned_to: Number(form.assigned_to) };
      if (editing) await obligations.update(editing.id, data); else await obligations.create(data);
      toast.success(editing ? "Obligation updated" : "Obligation created");
      setForm(blank); setEditing(null); await refresh(data.contract_id);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to save obligation."); }
    finally { setBusy(false); }
  };
  const startEdit = (item: Obligation) => setEditing(item) || setForm({ contract_id: String(item.contract_id), title: item.title, description: item.description, obligation_type: item.obligation_type, priority: item.priority ?? "Medium", due_date: item.due_date, assigned_to: String(item.assigned_to ?? "") });
  const act = async (request: Promise<unknown>, message: string, contractId: number) => { try { await request; toast.success(message); await refresh(contractId); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to update obligation."); } };
  const daysUntil = (date: string) => Math.ceil((new Date(`${date}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);

  const canComplete = (item: Obligation) => {
    if (hasPermission(user?.role, "obligations:status")) return true;
    return Boolean(user && item.assigned_to === user.id);
  };

  return <main className="mx-auto w-full max-w-7xl space-y-6 px-5 py-8 lg:px-8">
    <header className="flex items-start gap-4"><span className="grid size-10 place-items-center rounded-md bg-jade/10 text-jade"><FileCheck2 className="size-5" /></span><div><h1 className="font-display text-2xl font-semibold">Obligations</h1><p className="mt-1 text-sm text-muted-foreground">Assign, monitor, and complete contractual commitments.</p></div></header>
    {canCreate ? (
      <section className="rounded-lg bg-card p-5 shadow-hairline"><h2 className="mb-4 font-display text-sm font-semibold">{editing ? "Edit obligation" : "Create obligation"}</h2><form className="grid gap-4 md:grid-cols-2" onSubmit={save}><SelectField label="Contract" value={form.contract_id} options={(contractList.data ?? []).map((item) => ({ value: String(item.id), label: `${item.title} · ${item.contract_number}` }))} onChange={(value) => setForm({ ...form, contract_id: value })} /><SelectField label="Assigned employee" value={form.assigned_to} options={(userList.data ?? []).map((item) => ({ value: String(item.id), label: `${item.full_name} · ${item.role}` }))} onChange={(value) => setForm({ ...form, assigned_to: value })} /><Field label="Title" value={form.title} onChange={(value) => setForm({ ...form, title: value })} /><Field label="Obligation type" value={form.obligation_type} onChange={(value) => setForm({ ...form, obligation_type: value })} /><SelectField label="Priority" value={form.priority} options={["Low", "Medium", "High", "Critical"].map((value) => ({ value, label: value }))} onChange={(value) => setForm({ ...form, priority: value })} /><Field label="Due date" type="date" value={form.due_date} onChange={(value) => setForm({ ...form, due_date: value })} /><label className="space-y-2 text-sm md:col-span-2"><Label>Description</Label><Textarea required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><div className="flex gap-2"><Button type="submit" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Create obligation"}</Button>{editing ? <Button type="button" variant="ghost" onClick={() => { setEditing(null); setForm(blank); }}>Cancel</Button> : null}</div></form></section>
    ) : null}
    <section className="overflow-x-auto rounded-lg bg-card shadow-hairline"><table className="w-full min-w-[920px] text-left text-sm"><thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="px-4 py-3">Obligation</th><th className="px-4 py-3">Due</th><th className="px-4 py-3">Assigned</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr></thead><tbody>{(list.data ?? []).map((item) => { const days = daysUntil(item.due_date); const owner = userList.data?.find((u) => u.id === item.assigned_to); return <tr key={item.id} className="border-b border-border/60 last:border-0"><td className="px-4 py-3"><p className="font-medium">{item.title}</p><p className="text-xs text-muted-foreground">{item.obligation_type}</p></td><td className={`px-4 py-3 ${days < 0 ? "text-destructive" : days <= 3 ? "text-amber-600" : ""}`}>{days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? "Due today" : days === 1 ? "Due tomorrow" : `Due in ${days} days`}</td><td className="px-4 py-3">{owner?.full_name ?? "Unassigned"}</td><td className="px-4 py-3">{item.priority ?? "Medium"}</td><td className="px-4 py-3">{item.status}</td><td className="px-4 py-3"><div className="flex gap-1">{canEdit ? <Button size="icon" variant="ghost" title="Edit" onClick={() => startEdit(item)}><Pencil className="size-4" /></Button> : null}{["Pending", "In Progress", "Delayed", "Overdue"].includes(item.status) && canComplete(item) ? <Button size="icon" variant="ghost" title="Complete" onClick={() => act(obligations.status(item.id, "Completed"), "Obligation completed", item.contract_id)}><Check className="size-4 text-jade" /></Button> : null}{canDelete ? <Button size="icon" variant="ghost" title="Delete" onClick={() => act(obligations.delete(item.id), "Obligation deleted", item.contract_id)}><Trash2 className="size-4 text-destructive" /></Button> : null}</div></td></tr>; })}</tbody></table>{!list.isLoading && !list.data?.length ? <p className="p-10 text-center text-sm text-muted-foreground">No obligations yet.</p> : null}</section>
  </main>;
}
function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label className="space-y-2 text-sm"><Label>{label}</Label><Input required type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
function SelectField({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) { return <label className="space-y-2 text-sm"><Label>{label}</Label><select required className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select…</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
