import Image from "next/image";
import Link from "next/link";

interface AuthShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export function AuthShell({ children, title, subtitle }: AuthShellProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 py-12 sm:px-6">
      <div className="w-full max-w-[400px]">
        {/* Hostel Ghar Brand Logo */}
        <div className="mb-6 flex flex-col items-center text-center">
          <Link href="/" aria-label="Hostel Ghar" className="inline-block">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <Image
                src="/images/logo/hostel_ghar_logo.jpg"
                alt="Hostel Ghar"
                width={64}
                height={64}
                className="h-full w-full object-cover"
                priority
              />
            </div>
          </Link>
          {title && (
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-neutral-900">{title}</h1>
          )}
          {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          {children}
        </div>
      </div>
    </main>
  );
}
