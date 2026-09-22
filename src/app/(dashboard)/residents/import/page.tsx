"use client";
import { useCallback, useEffect, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { BackLink } from "@/components/ui/BackLink";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { useResidentImports } from "@/hooks/useHostelData";
import { getHostelId, toApiError } from "@/lib/axios";
import { hostelGhar, toPaginated, unwrap } from "@/lib/hostelGhar";
import type { HostelDetail, ResidentImport, ResidentImportPlanLimits } from "@/lib/api-types";
import { ImportDropzone, MAX_FILE_BYTES } from "@/components/residents/import/ImportDropzone";
import { ImportHistory } from "@/components/residents/import/ImportHistory";
import { DetailModal, LimitsModal } from "@/components/residents/import/ImportModals";

async function resolveHostelId(preferred?: string | null): Promise<string | null> {
  if (preferred) return preferred;
  const fromCookie = getHostelId();
  if (fromCookie) return fromCookie;
  try {
    const list = await hostelGhar.hostels.list({ limit: 1 });
    return toPaginated<HostelDetail>(list.data).items[0]?.id ?? null;
  } catch {
    return null;
  }
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

export default function ImportResidentsPage() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const [hostelId, setHostelId] = useState<string | null>(user?.hostelId ?? null);
  const [hostelMissing, setHostelMissing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [limitsOpen, setLimitsOpen] = useState(false);
  const [limits, setLimits] = useState<ResidentImportPlanLimits | null>(null);
  const [limitsLoading, setLimitsLoading] = useState(false);
  const [detail, setDetail] = useState<ResidentImport | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const { data, error, isLoading, pagination, refetch } = useResidentImports(hostelId);
  const imports = data ?? [];

  useEffect(() => {
    let cancelled = false;
    resolveHostelId(user?.hostelId).then((id) => {
      if (cancelled) return;
      setHostelId(id);
      setHostelMissing(!id);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.hostelId]);

  const openLimits = useCallback(async () => {
    setLimitsOpen(true);
    if (limits) return;
    setLimitsLoading(true);
    try {
      const res = await hostelGhar.owner.residentImportPlanLimits();
      setLimits(unwrap<ResidentImportPlanLimits>(res.data));
    } catch (err) {
      toastError("Couldn't load plan limits", toApiError(err).message);
      setLimitsOpen(false);
    } finally {
      setLimitsLoading(false);
    }
  }, [limits, toastError]);

  const openDetail = useCallback(
    async (id: string) => {
      setDetailLoading(true);
      try {
        const res = await hostelGhar.owner.residentImportDetail(id);
        setDetail(unwrap<ResidentImport>(res.data));
      } catch (err) {
        toastError("Couldn't load import detail", toApiError(err).message);
      } finally {
        setDetailLoading(false);
      }
    },
    [toastError]
  );

  const handleTemplate = useCallback(async () => {
    setDownloading(true);
    try {
      const res = await hostelGhar.owner.residentImportTemplate();
      const payload = res.data as unknown;
      const blob = payload instanceof Blob ? payload : new Blob([JSON.stringify(payload)]);
      downloadBlob(blob, "resident-import-template.csv");
      success("Template downloaded", "Fill name,email,phone,room,bed,rent and re-upload.");
    } catch (err) {
      toastError("Template download failed", toApiError(err).message);
    } finally {
      setDownloading(false);
    }
  }, [success, toastError]);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      if (!hostelId) {
        toastError("No hostel selected", "Pick a hostel before uploading a CSV.");
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        toastError("File too large", "CSV must be under 5MB (plan limit).");
        return;
      }
      setUploading(true);
      try {
        const key =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const res = await hostelGhar.owner.startResidentImport(hostelId, file, key);
        const queued = unwrap<ResidentImport>(res.data);
        success("Import queued", `${queued.fileName ?? file.name}: background validation started.`);
        refetch();
      } catch (err) {
        toastError("Import failed", toApiError(err).message);
      } finally {
        setUploading(false);
      }
    },
    [hostelId, refetch, success, toastError]
  );

  return (
    <DashboardShell title="Import Residents" subtitle="Hostel Ghar / Residents / Import">
      <Protected permission="IMPORT_RESIDENTS" redirectTo="/residents">
        <BackLink href="/residents" label="All residents" />
        <div className="mt-3 space-y-4">
          <ImportDropzone
            uploading={uploading}
            downloading={downloading}
            hostelReady={Boolean(hostelId)}
            hostelMissing={hostelMissing}
            onFiles={(files) => void handleFiles(files)}
            onTemplate={() => void handleTemplate()}
          />
          <ImportHistory
            isLoading={isLoading}
            errorMessage={error?.message ?? null}
            imports={imports}
            total={pagination?.totalItems ?? imports.length}
            onRetry={refetch}
            onLimits={() => void openLimits()}
            onDetail={(id) => void openDetail(id)}
          />
        </div>
        <LimitsModal
          open={limitsOpen}
          loading={limitsLoading}
          limits={limits}
          onClose={() => setLimitsOpen(false)}
        />
        <DetailModal detail={detail} loading={detailLoading} onClose={() => setDetail(null)} />
      </Protected>
    </DashboardShell>
  );
}
