"use client";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { useMyRoomSummary } from "@/hooks/useMyRoomSummary";

interface Announcement {
  id: string;
  title: string;
  body: string;
  date: string;
  tag: string;
}

const announcements: Announcement[] = [];

export default function ResidentAnnouncementsPage() {
  const room = useMyRoomSummary();
  return (
    <DashboardShell title="Announcements" subtitle={`From ${room.hostelName}`}>
      <Card>
        <CardHeader title="Announcements" subtitle="Notices and updates from hostel management" />
        {announcements.length === 0 ? (
          <div className="py-12 text-center text-sm text-neutral-500">
            No announcements at this time.
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {announcements.map((a) => (
              <li key={a.id} className="px-5 py-3.5">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  {a.title}
                  <Badge tone="gray">{a.tag}</Badge>
                </p>
                <p className="mt-0.5 text-[13px] text-neutral-500">{a.body}</p>
                <p className="mt-1 text-xs text-neutral-400">{formatDate(a.date)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </DashboardShell>
  );
}
