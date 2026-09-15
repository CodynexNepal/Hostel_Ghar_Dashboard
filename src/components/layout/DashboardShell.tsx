import { Sidebar } from "@/components/layout/Sidebar";
import { MobileSidebar } from "@/components/layout/MobileSidebar";
import { Header } from "@/components/layout/Header";
import { Breadcrumb } from "@/components/layout/Breadcrumb";

export function DashboardShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-surface-muted">
      <Sidebar />
      <MobileSidebar />
      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Header title={title} subtitle={subtitle} />
        <div className="dashboard-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
          <div className="mx-auto w-full min-w-0 max-w-[1280px] px-4 py-3 sm:px-6">
            <Breadcrumb />
          </div>
          <main className="mx-auto w-full min-w-0 max-w-[1280px] px-4 py-5 sm:px-6">
            {children}
          </main>
          <footer className="border-t border-surface-border bg-white px-6 py-3 text-center text-xs text-neutral-400 sm:text-left">
            Hostel Ghar · Frontend gating is UX-only — backend enforces authorization.
          </footer>
        </div>
      </div>
    </div>
  );
}
