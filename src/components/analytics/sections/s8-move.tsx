"use client";
import { useMemo } from "react";
import { ChartShell } from "../chart-core";
import { HBarList } from "../chart-parts";
import { GroupBars } from "../chart-bars";
import { PALETTE, Legend } from "../charts";
import { downloadCSV, toCSV } from "@/lib/analytics";
import { residentMovement } from "@/lib/analytics-ops";
export function MovementSection() {
  const data = useMemo(() => residentMovement(), []);
  const ins = data.reduce((a, d) => a + d.checkIns, 0);
  const outs = data.reduce((a, d) => a + d.checkOuts, 0);
  return (
    <ChartShell title="Resident movement" subtitle={`${ins} check-ins · ${outs} check-outs · net +${ins - outs}`}
      onExport={() => downloadCSV("movement.csv", toCSV(["month", "ins", "outs", "transfers", "net"],
        data.map((d) => [d.label, d.checkIns, d.checkOuts, d.transfers, d.net])))}
      footer={<Legend items={[{ color: PALETTE.limeDark, label: "Check-ins" }, { color: PALETTE.red, label: "Check-outs" }, { color: PALETTE.blue, label: "Transfers" }]} />}>
      <GroupBars labels={data.map((d) => d.label)}
        groups={[{ color: PALETTE.limeDark, label: "Ins", values: data.map((d) => d.checkIns) },
          { color: PALETTE.red, label: "Outs", values: data.map((d) => d.checkOuts) },
          { color: PALETTE.blue, label: "Moves", values: data.map((d) => d.transfers) }]} />
      <div className="mt-2">
        <HBarList rows={data.slice(-4).map((d) => ({ label: d.label, value: Math.abs(d.net), sub: d.net >= 0 ? `+${d.net} net` : `${d.net} net` }))}
          formatV={(v) => `${v}`} />
      </div>
    </ChartShell>
  );
}
