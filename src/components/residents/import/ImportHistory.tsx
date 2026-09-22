"use client";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, statusTone } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import type { ResidentImport } from "@/lib/api-types";
import { formatDate } from "@/lib/utils";

export function importTone(status: ResidentImport["status"]): string {
  if (status === "COMPLETED") return "green";
  if (status === "FAILED") return "red";
  if (status === "COMPLETED_WITH_ERRORS") return "amber";
  return "blue";
}

interface Props {
  isLoading: boolean;
  errorMessage: string | null;
  imports: ResidentImport[];
  total: number;
  onRetry: () => void;
  onLimits: () => void;
  onDetail: (id: string) => void;
}

export function ImportHistory({
  isLoading,
  errorMessage,
  imports,
  total,
  onRetry,
  onLimits,
  onDetail,
}: Props) {
  if (isLoading) return <TableSkeleton rows={4} />;
  if (errorMessage) {
    return (
      <ErrorState
        title="Couldn't load import history"
        description={errorMessage}
        onRetry={onRetry}
      />
    );
  }
  if (imports.length === 0) {
    return (
      <Card className="border-dashed p-8 text-center">
        <p className="font-semibold text-neutral-900">No imports yet</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">
          Your import history will appear here.
        </p>
        <div className="mt-4 flex justify-center">
          <Button variant="dark" type="button" onClick={onLimits}>
            View plan limits
          </Button>
        </div>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-2 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-[15px] font-semibold text-neutral-900">Import history</h3>
          <p className="text-[13px] text-neutral-500" role="status">
            {total} imports · auto-refreshes while running
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" type="button" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" aria-hidden /> Refresh
          </Button>
          <Link href="/subscription">
            <Button variant="dark" size="sm" type="button">
              View plan limits
            </Button>
          </Link>
        </div>
      </div>
      <ul className="divide-y divide-neutral-100">
        {imports.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onDetail(item.id)}
              className="flex w-full flex-col gap-2 px-5 py-4 text-left hover:bg-neutral-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-neutral-900">
                  {item.fileName}
                </span>
                <span className="mt-0.5 block text-xs text-neutral-500">
                  {item.successCount}/{item.totalRows} succeeded · {item.failedCount} failed ·{" "}
                  {formatDate(item.createdAt)}
                </span>
              </span>
              <Badge tone={importTone(item.status) || statusTone(item.status)}>
                {item.status.replace(/_/g, " ")}
                {item.status === "QUEUED" || item.status === "PROCESSING" ? " · live" : ""}
              </Badge>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
