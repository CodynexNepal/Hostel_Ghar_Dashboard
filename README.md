# Hostel Ghar — SaaS Dashboard

Premium, responsive hostel-management dashboard (Next.js + TypeScript + Tailwind).

## Roles

- **Super Admin** → `/admin/*` (hostels, owners, platform analytics)
- **Hostel Owner** → `/dashboard`, `/hostel`, `/residents`, `/rooms`, `/payments`, `/reports`, … (plan-gated)
- **Resident** → `/resident/*` (room, payments, announcements)

Use the **Demo switcher** at the top of dashboards to change role + plan live.

## Subscription gating (single source of truth)

- `src/constants/permissions.ts` → `PLAN_PERMISSIONS` + upsell copy
- `src/lib/permissions.ts` → `hasPermission()` / `canAccess()`
- `src/hooks/usePermissions.ts` → `usePermissions()`
- `src/components/common/FeatureGate.tsx` → `<FeatureGate permission="ADD_RESIDENT">`
- `src/hooks/useUpgrade.tsx` + `UpgradeModal.tsx` → locked-click upgrade UX

> Frontend gating is UX-only. Backend must enforce authorization on every endpoint.

## Run

```bash
npm install
npm run dev      # http://localhost:3000 (redirects / → /dashboard)
npm run typecheck
npm run lint
npm run build
```

## API wiring

- `src/lib/axios.ts` — base URL (`NEXT_PUBLIC_API_URL`), token + 401 handling, `toApiError()`
- `src/lib/mock-data.ts` — swap with `api.get/post(...)` calls when backend is ready
- Forms: React Hook Form + Yup (`src/schemas/*`), tables: `DataTable`, feedback: `Toaster`/`useToast`

## Brand

- Primary green `#C3FF7D`, black `#010101`, subtle grays. Icons: Lucide only.
