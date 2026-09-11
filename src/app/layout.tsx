import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { SidebarProvider } from "@/hooks/useSidebar";
import { UpgradeProvider } from "@/hooks/useUpgrade";
import { ToastProvider } from "@/hooks/useToast";
import { Toaster } from "@/components/common/Toaster";
import { UpgradeModal } from "@/components/common/UpgradeModal";

const spaceGrotesk = localFont({
  src: [
    {
      path: "../../public/fonts/SpaceGrotesk-Regular.woff",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-space-grotesk",
  display: "swap",
  preload: true,
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Hostel Ghar — Hostel Management Dashboard",
  description: "Premium SaaS dashboard for hostel owners, residents and platform admins.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={spaceGrotesk.variable}>
      <body className="font-sans">
        <AuthProvider>
          <SidebarProvider>
            <UpgradeProvider>
              <ToastProvider>
                {children}
                <UpgradeModal />
                <Toaster />
              </ToastProvider>
            </UpgradeProvider>
          </SidebarProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
