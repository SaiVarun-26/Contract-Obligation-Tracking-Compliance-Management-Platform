import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarClock, Check, Pencil, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { contracts, renewals, users } from "@/lib/api/resources";
import { useAuth } from "@/lib/auth/auth-context";
import { hasPermission } from "@/lib/auth/permissions";
import type { Renewal } from "@/lib/api/types";

export const Route = createFileRoute("/renewals")({ component: RenewalsPage });
const blank = { contract_id: "", renewal_date: "", previous_expiry_date: "", new_expiry_date: "", assigned_to: "", notes: "" };

function RenewalsPage() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<Renewal | null>(null);
  const [busy, setBusy] = useState(false);
  const list = useQuery({ queryKey: ["renewals"], queryFn: renewals.list });
  const contractList = useQuery({ queryKey: ["contracts"], queryFn: contracts.list });
  const userList = useQuery({ queryKey: ["users", "assignees"], queryFn: users.assignees });

  const canCreate = hasPermission(user?.role, "renewals:create");
  const canEdit = hasPermission(user?.role, "renewals:edit");
  const canChangeStatus = hasPermission(user?.role, "renewals:status");

  const refresh = async (contractId?: number) => {
    for (const key of [["renewals"], ["dashboard", "summary"], ["dashboard", "upcoming-renewals"]]) await client.invalidateQueries({ queryKey: key });
    if (contractId) await client.invalidateQueries({ queryKey: ["renewals", "contract", contractId] });
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    try {
      const data = { ...form, contract_id: Number(form.contract_id), assigned_to: Number(form.assigned_to) };
      if (editing) await renewals.update(editing.id, data); else await renewals.create(data);
      toast.success(editing ? "Renewal updated" : "Renewal created"); setForm(blank); setEditing(null); await refresh(data.contract_id);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to save renewal."); }
    finally { setBusy(false); }
  };
  const startEdit = (item: Renewal) => { setEditing(item); setForm({ contract_id: String(item.contract_id), renewal_date: item.renewal_date, previous_expiry_date: item.previous_expiry_date, new_expiry_date: item.new_expiry_date, assigned_to: String(item.assigned_to ?? ""), notes: item.notes ?? "" }); };
  const act = async (request: Promise<unknown>, message: string, contractId: number) => { try { await request; toast.success(message); await refresh(contractId); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to update renewal."); } };
  const daysUntil = (date: string) => Math.ceil((new Date(`${date}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
  const signal = (days: number) => days < 0 ? { label: "Expired", className: "text-destructive bg-destructive/10" } : days <= 30 ? { label: "Red", className: "text-destructive bg-destructive/10" } : days <= 90 ? { label: "Yellow", className: "text-amber-700 bg-amber-100" } : { label: "Green", className: "text-jade bg-jade/10" };

  return <main className="mx-auto w-full max-w-7xl space-y-6 px-5 py-8 lg:px-8">
    <header className="flex items-start gap-4"><span className="grid size-10 place-items-center rounded-md bg-jade/10 text-jade"><RefreshCw className="size-5" /></span><div><h1 className="font-display text-2xl font-semibold">Renewals</h1><p className="mt-1 text-sm text-muted-foreground">Plan upcoming renewals and keep expiry risk visible.</p></div></header>
    {canCreate ? (
      <section className="rounded-lg bg-card p-5 shadow-hairline"><h2 className="mb-4 font-display text-sm font-semibold">{editing ? "Edit renewal" : "Create renewal"}</h2><form className="grid gap-4 md:grid-cols-2" onSubmit={save}><SelectField label="Contract" value={form.contract_id} options={(contractList.data ?? []).map((item) => ({ value: String(item.id), label: `${item.title} · ${item.contract_number}` }))} onChange={(value) => setForm({ ...form, contract_id: value })} /><SelectField label="Assigned manager" value={form.assigned_to} options={(userList.data ?? []).map((item) => ({ value: String(item.id), label: `${item.full_name} · ${item.role}` }))} onChange={(value) => setForm({ ...form, assigned_to: value })} /><Field label="Renewal date" type="date" value={form.renewal_date} onChange={(value) => setForm({ ...form, renewal_date: value })} /><Field label="Previous expiry" type="date" value={form.previous_expiry_date} onChange={(value) => setForm({ ...form, previous_expiry_date: value })} /><Field label="New expiry" type="date" value={form.new_expiry_date} onChange={(value) => setForm({ ...form, new_expiry_date: value })} /><label className="space-y-2 text-sm md:col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><div className="flex gap-2"><Button type="submit" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Create renewal"}</Button>{editing ? <Button type="button" variant="ghost" onClick={() => { setEditing(null); setForm(blank); }}>Cancel</Button> : null}</div></form></section>
    ) : null}
    <section className="overflow-x-auto rounded-lg bg-card shadow-hairline"><table className="w-full min-w-[1000px] text-left text-sm"><thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="px-4 py-3">Contract</th><th className="px-4 py-3">Countdown</th><th className="px-4 py-3">Signal</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">History</th><th className="px-4 py-3">Actions</th></tr></thead><tbody>{(list.data ?? []).map((item) => { const days = daysUntil(item.renewal_date); const state = signal(days); const contract = contractList.data?.find((entry) => entry.id === item.contract_id); return <tr key={item.id} className="border-b border-border/60 last:border-0"><td className="px-4 py-3"><p className="font-medium">{contract?.title ?? `Contract ${item.contract_id}`}</p><p className="text-xs text-muted-foreground">Renewal {item.renewal_date} · expiry {item.new_expiry_date}</p></td><td className="px-4 py-3">{days < 0 ? `${Math.abs(days)} days expired` : `${days} days`}</td><td className="px-4 py-3"><span className={`inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-medium ${state.className}`}><span className="size-2 rounded-full bg-current" />{state.label}</span></td><td className="px-4 py-3">{item.status}</td><td className="px-4 py-3 text-xs text-muted-foreground">{item.notes || "No notes"}</td><td className="px-4 py-3"><div className="flex gap-1">{canEdit ? <Button size="icon" variant="ghost" title="Edit" onClick={() => startEdit(item)}><Pencil className="size-4" /></Button> : null}{canChangeStatus && item.status === "Upcoming" ? <Button size="icon" variant="ghost" title="Start renewal" onClick={() => act(renewals.status(item.id, "In Progress"), "Renewal started", item.contract_id)}><CalendarClock className="size-4" /></Button> : null}{canChangeStatus && item.status === "In Progress" ? <><Button size="icon" variant="ghost" title="Renew" onClick={() => act(renewals.renew(item.id), "Contract renewed", item.contract_id)}><Check className="size-4 text-jade" /></Button><Button size="icon" variant="ghost" title="Cancel" onClick={() => act(renewals.status(item.id, "Cancelled"), "Renewal cancelled", item.contract_id)}><X className="size-4 text-destructive" /></Button></> : null}{!canEdit && !canChangeStatus ? <span className="text-xs text-muted-foreground">—</span> : null}</div></td></tr>; })}</tbody></table>{!list.isLoading && !list.data?.length ? <p className="p-10 text-center text-sm text-muted-foreground">No renewal history yet.</p> : null}</section>
  </main>;
}
function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label className="space-y-2 text-sm"><Label>{label}</Label><Input required={type !== "text"} type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
function SelectField({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) { return <label className="space-y-2 text-sm"><Label>{label}</Label><select required className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select…</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
