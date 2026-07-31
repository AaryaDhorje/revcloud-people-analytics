"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  DollarSign,
  Inbox,
  ScrollText,
  Upload,
  Users,
  XCircle,
} from "lucide-react";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatCurrency, formatDateTime, formatInteger } from "@/lib/format";
import type {
  AdminSettings,
  AuditLogEntry,
  DemoRequestRow,
  IngestRun,
  Role,
  User,
} from "@/lib/types";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Select,
  Spinner,
} from "@/components/ui";

type Tab = "ingest" | "users" | "settings" | "audit" | "demo";

const TABS: { id: Tab; label: string; icon: typeof Upload }[] = [
  { id: "ingest", label: "Data ingestion", icon: Upload },
  { id: "users", label: "Users", icon: Users },
  { id: "settings", label: "Settings", icon: DollarSign },
  { id: "audit", label: "Audit log", icon: ScrollText },
  { id: "demo", label: "Demo requests", icon: Inbox },
];

export default function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("ingest");

  if (user && user.role !== "admin") {
    return (
      <Alert tone="critical" title="Administrator access required">
        Your role is <strong>{user.role}</strong>. Ask an administrator if you
        need access to this area.
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Admin Console</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Load workforce data, manage access, and review the audit trail.
        </p>
      </div>

      <div
        role="tablist"
        className="flex flex-wrap gap-1 border-b border-[var(--border)]"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={
              tab === id
                ? "-mb-px flex items-center gap-2 border-b-2 border-[var(--series-1)] px-3 py-2 text-sm font-medium text-[var(--series-1)]"
                : "-mb-px flex items-center gap-2 border-b-2 border-transparent px-3 py-2 text-sm text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
            }
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {tab === "ingest" && <IngestPanel />}
      {tab === "users" && <UsersPanel currentUserId={user?.id} />}
      {tab === "settings" && <SettingsPanel />}
      {tab === "audit" && <AuditPanel />}
      {tab === "demo" && <DemoPanel />}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Ingestion                                                                   */
/* -------------------------------------------------------------------------- */
function IngestPanel() {
  const [runs, setRuns] = useState<IngestRun[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<IngestRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadRuns = useCallback(async () => {
    try {
      setRuns(await apiFetch<IngestRun[]>("/admin/ingest-runs"));
    } catch {
      /* the panel still works without history */
    }
  }, []);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    setResult(null);

    const body = new FormData();
    body.append("file", file);
    try {
      const run = await apiFetch<IngestRun>("/admin/ingest", {
        method: "POST",
        body,
      });
      setResult(run);
      await loadRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <h3 className="text-sm font-medium">Upload an HR extract</h3>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          CSV in the IBM HR Analytics layout. The pipeline validates, cleans,
          derives fields, scores attrition risk, recomputes every KPI, and
          pushes the result to all connected dashboards.
        </p>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) void upload(file);
          }}
          className={
            dragging
              ? "mt-5 rounded-xl border-2 border-dashed border-[var(--series-1)] bg-[color-mix(in_oklab,var(--series-1)_8%,transparent)] p-8 text-center"
              : "mt-5 rounded-xl border-2 border-dashed border-[var(--border-strong)] p-8 text-center"
          }
        >
          <Upload
            className="mx-auto size-7 text-[var(--text-muted)]"
            aria-hidden
          />
          <p className="mt-3 text-sm">
            Drop a CSV here, or{" "}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="font-medium text-[var(--series-1)] hover:underline"
            >
              browse
            </button>
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Replaces the current dataset. Maximum 25 MB.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = "";
            }}
          />
          {uploading && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-[var(--text-secondary)]">
              <Spinner className="size-4" />
              Running the pipeline…
            </div>
          )}
        </div>

        {error && (
          <Alert tone="critical" className="mt-4">
            {error}
          </Alert>
        )}

        {result && (
          <div className="mt-4">
            <Alert
              tone={result.status === "succeeded" ? "info" : "critical"}
              title={
                result.status === "succeeded"
                  ? `Loaded ${formatInteger(result.rows_loaded)} employees`
                  : "Ingest failed"
              }
            >
              {result.error ? (
                <p>{result.error}</p>
              ) : (
                <>
                  <p>
                    {formatInteger(result.rows_received)} rows received ·{" "}
                    {formatInteger(result.rows_rejected)} rejected
                  </p>
                  {result.warnings && result.warnings.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
                      {result.warnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </Alert>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-[var(--border)] px-5 py-3">
          <h3 className="text-sm font-medium">Recent ingests</h3>
        </div>
        {runs.length === 0 ? (
          <EmptyState title="No ingests yet" />
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {runs.map((run) => (
              <li
                key={run.id}
                className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm"
              >
                {run.status === "succeeded" ? (
                  <CheckCircle2
                    className="size-4 shrink-0 text-[var(--status-good)]"
                    aria-hidden
                  />
                ) : (
                  <XCircle
                    className="size-4 shrink-0 text-[var(--status-critical)]"
                    aria-hidden
                  />
                )}
                <span className="font-medium">{run.filename}</span>
                <span className="text-xs text-[var(--text-secondary)]">
                  {formatInteger(run.rows_loaded)} loaded
                  {run.rows_rejected > 0 &&
                    ` · ${formatInteger(run.rows_rejected)} rejected`}
                </span>
                <span className="ml-auto text-xs text-[var(--text-muted)]">
                  {formatDateTime(run.started_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Users                                                                       */
/* -------------------------------------------------------------------------- */
function UsersPanel({ currentUserId }: { currentUserId?: number }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await apiFetch<User[]>("/admin/users"));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(id: number, changes: Record<string, unknown>) {
    setSavingId(id);
    setError(null);
    try {
      const updated = await apiFetch<User>(`/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(changes),
      });
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSavingId(null);
    }
  }

  if (loading) return <Card className="p-6"><Spinner /></Card>;

  return (
    <div className="space-y-4">
      {error && <Alert tone="critical">{error}</Alert>}

      <Alert tone="info">
        Changing a role, department or activation state immediately revokes that
        user&rsquo;s existing sessions, so a demotion takes effect on their very
        next request rather than when their token happens to expire.
      </Alert>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-secondary)]">
              <th scope="col" className="px-5 py-2 font-medium">User</th>
              <th scope="col" className="px-3 py-2 font-medium">Role</th>
              <th scope="col" className="px-3 py-2 font-medium">Department scope</th>
              <th scope="col" className="px-3 py-2 font-medium">Last sign-in</th>
              <th scope="col" className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isSelf = user.id === currentUserId;
              return (
                <tr
                  key={user.id}
                  className="border-b border-[var(--border)] last:border-0"
                >
                  <td className="px-5 py-3">
                    <p className="font-medium">{user.full_name}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {user.email}
                      {isSelf && " · you"}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <Select
                      value={user.role}
                      disabled={isSelf || savingId === user.id}
                      onChange={(event) =>
                        patch(user.id, { role: event.target.value as Role })
                      }
                      className="h-8 w-32 text-xs"
                      aria-label={`Role for ${user.email}`}
                    >
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="viewer">Viewer</option>
                    </Select>
                  </td>
                  <td className="px-3 py-3">
                    <Input
                      defaultValue={user.department ?? ""}
                      disabled={savingId === user.id}
                      placeholder={
                        user.role === "manager" ? "Required" : "Company-wide"
                      }
                      onBlur={(event) => {
                        const next = event.target.value.trim();
                        if (next !== (user.department ?? "")) {
                          void patch(user.id, { department: next });
                        }
                      }}
                      className="h-8 w-52 text-xs"
                      aria-label={`Department for ${user.email}`}
                    />
                  </td>
                  <td className="px-3 py-3 text-xs text-[var(--text-secondary)]">
                    {user.last_login_at
                      ? formatDateTime(user.last_login_at)
                      : "Never"}
                  </td>
                  <td className="px-3 py-3">
                    <button
                      disabled={isSelf || savingId === user.id}
                      onClick={() => patch(user.id, { is_active: !user.is_active })}
                      className="disabled:opacity-50"
                    >
                      <Badge tone={user.is_active ? "good" : "critical"}>
                        {user.is_active ? "Active" : "Disabled"}
                      </Badge>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                    */
/* -------------------------------------------------------------------------- */
function SettingsPanel() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [revenue, setRevenue] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<AdminSettings>("/admin/settings");
      setSettings(data);
      setRevenue(data.annual_revenue ? String(data.annual_revenue) : "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load settings.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await apiFetch("/admin/settings/annual-revenue", {
        method: "PUT",
        body: JSON.stringify({
          annual_revenue: Number(revenue),
          currency: "USD",
        }),
      });
      setSaved(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-6">
      <h3 className="text-sm font-medium">Revenue per Employee</h3>
      <p className="mt-1 text-xs text-[var(--text-secondary)]">
        The source dataset contains no financial data, so this metric is
        unavailable until someone supplies an annual revenue figure. Entering
        one here recomputes the KPI snapshots immediately.
      </p>

      <form onSubmit={save} className="mt-5 flex flex-wrap items-end gap-3">
        <Field label="Annual revenue (USD)" htmlFor="revenue" className="w-64">
          <Input
            id="revenue"
            type="number"
            min={0}
            step={1000}
            required
            value={revenue}
            onChange={(event) => setRevenue(event.target.value)}
            placeholder="500000000"
          />
        </Field>
        <Button type="submit" loading={saving}>
          Save
        </Button>
      </form>

      {error && (
        <Alert tone="critical" className="mt-4">
          {error}
        </Alert>
      )}
      {saved && (
        <Alert tone="info" className="mt-4">
          Saved. Revenue per Employee is now available on the dashboards.
        </Alert>
      )}

      {settings && (
        <dl className="mt-6 grid gap-5 border-t border-[var(--border)] pt-5 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-[var(--text-muted)]">Active headcount</dt>
            <dd className="mt-1 text-lg font-semibold">
              {formatInteger(settings.active_headcount)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--text-muted)]">Annual revenue</dt>
            <dd className="mt-1 text-lg font-semibold">
              {settings.annual_revenue
                ? formatCurrency(settings.annual_revenue)
                : "Not set"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--text-muted)]">
              Revenue per employee
            </dt>
            <dd className="mt-1 text-lg font-semibold">
              {settings.revenue_per_employee
                ? formatCurrency(settings.revenue_per_employee)
                : "—"}
            </dd>
          </div>
        </dl>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Audit log                                                                   */
/* -------------------------------------------------------------------------- */
function AuditPanel() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    const query = action ? `?action=${encodeURIComponent(action)}` : "";
    apiFetch<AuditLogEntry[]>(`/admin/audit-logs${query}`)
      .then((data) => active && setLogs(data))
      .catch(() => active && setLogs([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [action]);

  const actions = Array.from(new Set(logs.map((log) => log.action))).sort();

  return (
    <div className="space-y-4">
      <Alert tone="info">
        Every dashboard read and every individual profile view is recorded here,
        which is what makes the compliance story real rather than aspirational.
      </Alert>

      <div className="flex items-center gap-2">
        <Select
          value={action}
          onChange={(event) => setAction(event.target.value)}
          className="w-64"
          aria-label="Filter by action"
        >
          <option value="">All actions</option>
          {actions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-6">
            <Spinner />
          </div>
        ) : logs.length === 0 ? (
          <EmptyState title="No audit entries" />
        ) : (
          <div className="max-h-[600px] overflow-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="sticky top-0 bg-[var(--surface)]">
                <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-secondary)]">
                  <th scope="col" className="px-5 py-2 font-medium">When</th>
                  <th scope="col" className="px-3 py-2 font-medium">Actor</th>
                  <th scope="col" className="px-3 py-2 font-medium">Action</th>
                  <th scope="col" className="px-3 py-2 font-medium">Resource</th>
                  <th scope="col" className="px-3 py-2 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="px-5 py-2 text-xs whitespace-nowrap text-[var(--text-secondary)]">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {log.actor_email ?? (
                        <span className="text-[var(--text-muted)]">anonymous</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <code className="rounded bg-[var(--page)] px-1.5 py-0.5 text-[11px]">
                        {log.action}
                      </code>
                    </td>
                    <td className="px-3 py-2 text-xs text-[var(--text-secondary)]">
                      {log.resource}
                    </td>
                    <td className="px-3 py-2 text-xs text-[var(--text-muted)]">
                      {log.ip_address ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Demo requests                                                               */
/* -------------------------------------------------------------------------- */
function DemoPanel() {
  const [rows, setRows] = useState<DemoRequestRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiFetch<DemoRequestRow[]>("/admin/demo-requests")
      .then((data) => active && setRows(data))
      .catch(() => active && setRows([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <Card className="p-6"><Spinner /></Card>;

  return (
    <Card className="overflow-hidden">
      {rows.length === 0 ? (
        <EmptyState
          title="No demo requests yet"
          description="Submissions from the landing page form arrive here."
        />
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {rows.map((row) => (
            <li key={row.id} className="px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium">
                  {row.full_name || row.email}
                  {row.company && (
                    <span className="ml-2 text-xs font-normal text-[var(--text-secondary)]">
                      {row.company}
                    </span>
                  )}
                </p>
                <span className="text-xs text-[var(--text-muted)]">
                  {formatDateTime(row.created_at)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                {row.email}
              </p>
              {row.message && (
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {row.message}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
