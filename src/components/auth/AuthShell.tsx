import Image from "next/image";
import Link from "next/link";

interface AuthShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export function AuthShell({ children, title, subtitle }: AuthShellProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface-muted px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-[420px]">
        {/* Hostel Ghar Brand Header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <Link
            href="/"
            className="group flex flex-col items-center gap-3"
            aria-label="Hostel Ghar"
          >
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-surface-border bg-white shadow-sm transition-transform duration-200 group-hover:scale-105">
              <Image
                src="/images/logo/hostel_ghar_logo.jpg"
                alt="Hostel Ghar logo"
                width={56}
                height={56}
                className="h-full w-full object-cover"
                priority
              />
            </div>
            <span className="text-xl font-bold tracking-tight text-neutral-950">
              Hostel Ghar
            </span>
          </Link>

          {title && (
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-neutral-950">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="mt-1.5 text-sm text-neutral-600">
              {subtitle}
            </p>
          )}
        </div>

        {/* Auth Form Card */}
        <div className="rounded-2xl border border-surface-border bg-white p-6 shadow-card sm:p-8">
          {children}
        </div>

        <p className="mt-8 text-center text-xs text-neutral-500">
          Hostel Ghar &copy; {new Date().getFullYear()}
        </p>
      </div>
    </main>
  );
}
