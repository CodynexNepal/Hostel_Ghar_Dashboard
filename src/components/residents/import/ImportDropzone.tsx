"use client";
import { useRef, useState } from "react";
import { Download, FileUp, UploadCloud } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export const ACCEPTED_CSV = ".csv,text/csv,application/vnd.ms-excel";
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

interface Props {
  uploading: boolean;
  downloading: boolean;
  hostelReady: boolean;
  hostelMissing: boolean;
  onFiles: (files: FileList | null) => void;
  onTemplate: () => void;
}

export function ImportDropzone({
  uploading,
  downloading,
  hostelReady,
  hostelMissing,
  onFiles,
  onTemplate,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const dragCount = useRef(0);
  const [dragging, setDragging] = useState(false);

  return (
    <Card className="border-dashed p-8 text-center">
      <div
        role="button"
        tabIndex={0}
        aria-label="Drop your CSV here or choose a file"
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          dragCount.current += 1;
          setDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          e.preventDefault();
          dragCount.current = Math.max(0, dragCount.current - 1);
          if (dragCount.current === 0) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          dragCount.current = 0;
          setDragging(false);
          onFiles(e.dataTransfer.files);
        }}
        className={dragging ? "rounded-lg bg-neutral-50 outline-dashed outline-2" : ""}
      >
        <UploadCloud className="mx-auto h-8 w-8 text-neutral-400" aria-hidden />
        <p className="mt-3 font-semibold text-neutral-900">Drop your CSV here</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">
          Columns: name, email, phone, room, bed, rent. We validate every row before import.
        </p>
        <div className="mt-4 flex justify-center gap-2" onClick={(e) => e.stopPropagation()}>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_CSV}
            className="hidden"
            aria-label="Choose CSV file"
            onChange={(e) => onFiles(e.target.files)}
          />
          <Button
            type="button"
            loading={uploading}
            disabled={uploading || !hostelReady}
            onClick={() => fileRef.current?.click()}
          >
            <FileUp className="h-4 w-4" aria-hidden /> Choose file
          </Button>
          <Button
            type="button"
            variant="outline"
            loading={downloading}
            disabled={downloading}
            onClick={onTemplate}
          >
            <Download className="h-4 w-4" aria-hidden /> Download template
          </Button>
        </div>
        {hostelMissing && (
          <p role="alert" className="mx-auto mt-3 max-w-sm text-xs text-amber-700">
            No hostel found for this account yet — create a hostel before importing.
          </p>
        )}
      </div>
    </Card>
  );
}
