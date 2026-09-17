import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, Trash2, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { users } from "@/lib/api/resources";
import type { User } from "@/lib/api/types";
import { ProtectedRoute } from "@/components/auth/protected-route";

export const Route = createFileRoute("/users")({ component: UsersPageWrapper });

function UsersPageWrapper() {
  return (
    <ProtectedRoute permission="users:manage">
      <UsersPage />
    </ProtectedRoute>
  );
}

const roles = ["Admin", "Legal Manager", "Contract Manager", "Compliance Officer", "Viewer"];

function UsersPage() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["users"], queryFn: users.list });
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const [form, setForm] = useState({ full_name: "", email: "", password: "", role: "Viewer" });
  const [editing, setEditing] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(
    () =>
      (query.data ?? []).filter(
        (item) =>
          `${item.full_name} ${item.email}`.toLowerCase().includes(search.toLowerCase()) &&
          (!role || item.role === role) &&
          (!status || (item.is_active ? "Active" : "Inactive") === status),
      ),
    [query.data, role, search, status],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (editing) await users.update(editing.id, { ...form, password: form.password || undefined });
      else await users.create(form);
      toast.success(editing ? "User updated" : "User created");
      setForm({ full_name: "", email: "", password: "", role: "Viewer" });
      setEditing(null);
      await client.invalidateQueries({ queryKey: ["users"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save user.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm("Delete this user? This cannot be undone.")) return;
    try {
      await users.delete(id);
      toast.success("User deleted");
      await client.invalidateQueries({ queryKey: ["users"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete user.");
    }
  };

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-5 py-8 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="grid size-10 place-items-center rounded-md bg-jade/10 text-jade">
            <UsersRound className="size-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-semibold">User management</h1>
            <p className="mt-1 text-sm text-muted-foreground">Control roles, access, and account health.</p>
          </div>
        </div>
        <label className="flex h-9 items-center gap-2 rounded-md bg-secondary px-3 text-sm">
          <Search className="size-4 text-muted-foreground" />
          <input
            className="w-56 bg-transparent outline-none"
            placeholder="Search users…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
      </header>
      <section className="rounded-lg bg-card p-5 shadow-hairline">
        <h2 className="mb-4 font-display text-sm font-semibold">{editing ? "Edit user" : "Create user"}</h2>
        <form className="grid gap-4 md:grid-cols-4" onSubmit={submit}>
          <Field label="Full name" value={form.full_name} onChange={(value) => setForm({ ...form, full_name: value })} />
          <Field label="Email" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
          <Field label={editing ? "New password" : "Password"} type="password" required={!editing} value={form.password} onChange={(value) => setForm({ ...form, password: value })} />
          <Select label="Role" value={form.role} options={roles} onChange={(value) => setForm({ ...form, role: value })} />
          <div className="flex gap-2 md:col-span-4">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : editing ? "Save user" : "Create user"}
            </Button>
            {editing ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditing(null);
                  setForm({ full_name: "", email: "", password: "", role: "Viewer" });
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      </section>
      <section className="rounded-lg bg-card shadow-hairline">
        <div className="flex flex-wrap gap-2 border-b border-border p-4">
          <Select label="Role filter" value={role} options={roles} onChange={(value) => { setRole(value); setPage(1); }} />
          <Select label="Status filter" value={status} options={["Active", "Inactive"]} onChange={(value) => { setStatus(value); setPage(1); }} />
        </div>
        {query.isLoading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-14 w-full" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Last login</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((user) => (
                  <tr key={user.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={user.avatar_url ?? undefined} />
                          <AvatarFallback>
                            {user.full_name
                              .split(" ")
                              .map((part) => part[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{user.full_name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="border-jade/30 text-jade">
                        {user.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {user.last_login ? new Date(user.last_login).toLocaleString() : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={user.is_active ? "default" : "secondary"}>
                        {user.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditing(user);
                            setForm({
                              full_name: user.full_name,
                              email: user.email,
                              password: "",
                              role: user.role,
                            });
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Delete user"
                          onClick={() => remove(user.id)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!query.isLoading && !visible.length ? (
          <p className="p-10 text-center text-sm text-muted-foreground">No users match the current filters.</p>
        ) : null}
        <div className="flex items-center justify-between border-t border-border p-4 text-sm">
          <span className="text-muted-foreground">
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= pages}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
function Field({ label, value, onChange, type = "text", required = true }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) { return <label className="space-y-2 text-sm"><Label>{label}</Label><Input type={type} required={required} value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) { return <label className="space-y-2 text-sm"><Label>{label}</Label><select className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}><option value="">All</option>{options.map((option) => <option key={option}>{option}</option>)}</select></label>; }
