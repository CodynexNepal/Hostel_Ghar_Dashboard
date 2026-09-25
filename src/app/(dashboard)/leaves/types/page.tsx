"use client";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";
import { useApi, useMutation } from "@/hooks/useApi";
import { getHostelId } from "@/lib/axios";
import { hostelGhar, toPaginated, unwrap } from "@/lib/hostelGhar";
import { normalizeLeaveType } from "@/hooks/useResidentDashboard";
import { formatDate } from "@/lib/utils";
import type {
  HostelDetail,
  NormalizedLeaveType,
  OwnerHostelOption,
} from "@/lib/api-types";

const sel = "h-10 w-full rounded-md border border-surface-border bg-white px-3 text-sm outline-none";
async function resolveHid(p?: string | null): Promise<string | null> {
  if (p) return p;
  const c = getHostelId();
  if (c) return c;
  try {
    const l = await hostelGhar.hostels.list({ limit: 1 });
    return toPaginated<HostelDetail>(l.data).items[0]?.id ?? null;
  } catch { return null; }
}
export default function LeaveTypesPage() {
  const { success, error: te } = useToast();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [hosts, setHosts] = useState<OwnerHostelOption[]>([]);
  const [hid, setHid] = useState<string | null>(user?.hostelId ?? null);
  const [name, setName] = useState("");
  const [maxDays, setMaxDays] = useState("");
  const { data, error, isLoading, refetch, retry } = useApi<NormalizedLeaveType[]>(async () => {
    // Use the selected hostel (dropdown) first — this is what the user asked to see.
    // Fall back to session/cookie/first-hostel only when nothing is selected yet.
    const id = hid ?? (await resolveHid(user?.hostelId));
    if (!id) return [];
    const r = await hostelGhar.hostels.leaveTypes(id);
    if (process.env.NODE_ENV !== "production") {
      console.info("[leave-types] raw payload for hostel", id, r.data);
    }
    return toPaginated<unknown>(unwrap<unknown>(r.data)).items.map(normalizeLeaveType);
  }, [hid]);
  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const r = await hostelGhar.owner.residentFormHostels();
        const items = toPaginated<OwnerHostelOption>(unwrap<unknown>(r.data)).items;
        if (c) return;
        setHosts(items);
        // If session has no hostel, default-select the first owned hostel so the
        // list (and the add-form) targets a38bf07a-… instead of staying empty.
        if (!user?.hostelId && !getHostelId() && items.length > 0) {
          setHid((prev) => prev ?? items[0].id);
        }
      } catch { /* ignore */ }
    })();
    return () => { c = true; };
  }, [user?.hostelId]);
  const { mutate, isPending, error: ce } = useMutation((p: { hostelId: string; name: string; maxDays?: number }) => hostelGhar.owner.createLeaveType(p));
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hid) { te("No hostel", "Resolve hostel first."); return; }
    if (name.trim().length < 2) { te("Invalid name", "Min 2 chars."); return; }
    const md = maxDays === "" ? undefined : Number(maxDays);
    if (md !== undefined && (!Number.isInteger(md) || md < 1 || md > 365)) { te("Invalid max days", "1-365."); return; }
    const c = await mutate({ hostelId: hid, name: name.trim(), ...(md !== undefined ? { maxDays: md } : {}) });
    if (c) { success("Leave type added", name.trim()); setOpen(false); setName(""); setMaxDays(""); refetch(); }
    else te("Couldn't add leave type", ce?.message ?? "Retry.");
  }
  const rows = data ?? [];
  const cols: Column<NormalizedLeaveType>[] = [
    { key: "name", header: "Leave type", sortable: true, render: (t) => (
      <span>
        <span className="block font-semibold">{t.name}</span>
        <span className="block font-mono text-[11px] text-neutral-400">{t.id}</span>
      </span>
    ) },
    { key: "maxDays", header: "Max days", sortable: true, render: (t) => <span>{t.maxDays ?? "—"}</span> },
    {
      key: "approval",
      header: "Parent approval",
      render: (t) => (
        <Badge tone={t.requiresParentApproval ? "amber" : "gray"}>
          {t.requiresParentApproval ? "Required" : "Not required"}
        </Badge>
      ),
    },
    {
      key: "created",
      header: "Created",
      sortable: true,
      render: (t) => <span className="text-neutral-600">{formatDate(t.createdAt)}</span>,
    },
    {
      key: "p",
      header: "Status",
      render: (t) =>
        t.isActive === false ? (
          <Badge tone="amber">Inactive</Badge>
        ) : (
          <Badge tone={t.maxDays ? "green" : "gray"}>{t.maxDays ? "Limited" : "Flexible"}</Badge>
        ),
    },
  ];
  return (
    <DashboardShell title="Leave Types" subtitle="Hostel Ghar / Leaves / Leave Types">
      <Protected permission="VIEW_RESIDENTS">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-neutral-500">
            {isLoading ? "Loading…" : `${rows.length} leave types`}
            {hid ? ` · hostel ${hid.slice(0, 8)}…` : ""}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {hosts.length > 0 && (
              <select
                aria-label="Hostel"
                className={sel}
                value={hid ?? ""}
                onChange={(e) => setHid(e.target.value || null)}
              >
                <option value="">Select hostel…</option>
                {hosts.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            )}
            <BackLink href="/leaves" label="Requests" />
            <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add Type</Button>
          </div>
        </div>
        {isLoading ? (<TableSkeleton rows={5} />) : error ? (<ErrorState title="Couldn't load leave types" description={error.message} onRetry={retry} />) : rows.length === 0 ? (<EmptyState title="No leave types yet" description="Add first policy e.g. Sick Leave — or press Retry to force a fresh fetch (bypasses 304 cache)." action={<div className="flex gap-2"><Button onClick={() => setOpen(true)}>Add Leave Type</Button><Button variant="outline" onClick={() => refetch()}>Retry</Button></div>} />) : (
          <DataTable<NormalizedLeaveType> columns={cols} rows={rows} rowKey={(r) => r.id} searchableKeys={["name"]} searchPlaceholder="Search…" />
        )}
        <Card className="mt-4 border-dashed p-4 text-[13px] text-neutral-500"><CardHeader title="How types connect" subtitle="POST owner/leave-types to GET hostels leave-types" /><p className="p-5 pt-3">Residents apply with leaveTypeId. Owners review at leaves/hostels requests.</p></Card>
        <Modal open={open} onClose={() => setOpen(false)} title="Add leave type" description="Create a new leave policy">
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <div><label htmlFor="lt-h" className="mb-1 block text-[13px] font-medium">Hostel *</label>{hosts.length > 0 ? (<select id="lt-h" className={sel} value={hid ?? ""} onChange={(e) => setHid(e.target.value)} required><option value="">Select…</option>{hosts.map((h) => (<option key={h.id} value={h.id}>{h.name}</option>))}</select>) : (<Input id="lt-h" placeholder="Hostel ID" value={hid ?? ""} onChange={(e) => setHid(e.target.value)} required readOnly={Boolean(hid)} />)}</div>
            <Input label="Name" placeholder="Sick Leave" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input label="Max days (optional)" type="number" placeholder="7" value={maxDays} onChange={(e) => setMaxDays(e.target.value)} />
            {ce && <p className="text-sm text-red-700">{ce.message}</p>}
            <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" loading={isPending}>Add</Button></div>
          </form>
        </Modal>
      </Protected>
    </DashboardShell>
  );
}


