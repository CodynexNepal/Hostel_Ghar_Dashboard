# Settings Endpoints — Backend Contract

Frontend-first integration. Dashboard already calls these.
Most tabs still fall back to localStorage until their routes ship
(marked local preview). Already integrated on the backend:
Payment QR (hostel) AND Platform QR (checkout QRs owners scan
on `/subscription`) — both persist to PostgreSQL.

## Owner (OWNER / ADMIN, hostel from auth / X-Hostel-Id)

### GET /v1/hostel-ghar/settings/hostel

Response `{ data: HostelProfileSettings }`:
`{ id?, name, phone, email, address, city? }`.

### PUT /v1/hostel-ghar/settings/hostel

Body (partial): `{ name?, phone?, email?, address?, city? }`.
Response `{ data: HostelProfileSettings }`.

### GET /v1/hostel-ghar/settings/notifications

Response `{ data: NotificationPreferences }`:
`{ rentReminders, reminderDaysBefore?, smsEnabled?, emailEnabled? }`.

### PUT /v1/hostel-ghar/settings/notifications

Body (partial, same shape). Response `{ data: NotificationPreferences }`.

### PUT /v1/hostel-ghar/auth/change-password (exists)

Body `{ currentPassword, newPassword }` (min 8). Response `{ message }`.
Wired to Settings Security card.

## Platform admin (SUPER_ADMIN) — one URL per tab

### GET /v1/hostel-ghar/admin/settings/general

General & Identity tab. Response `{ data: { platformName, tagline, supportEmail, supportPhone, officeAddress, currency, timezone } }`.

### PUT /v1/hostel-ghar/admin/settings/general

Save General & Identity tab. Body: that slice (partial ok). Response `{ data: GeneralSettings }`.

### GET /v1/hostel-ghar/admin/settings/billing

Billing & Plans tab. Response `{ data: { gracePeriodDays, freeTierResidentCap, standardPlanPrice, enterprisePlanPrice, autoRemindRenewals, allowQrCheckout } }`.

### PUT /v1/hostel-ghar/admin/settings/billing

Save Billing & Plans tab. Body: that slice (partial ok). Response `{ data: BillingSettings }`.

### GET /v1/hostel-ghar/admin/settings/access

Access & Security tab. Response `{ data: { allowPublicHostelSignup, requireHostelApproval, allowResidentSelfInvite, sessionLifetimeDays, requireAdmin2FA } }`.

### PUT /v1/hostel-ghar/admin/settings/access

Save Access & Security tab. Body: that slice (partial ok). Response `{ data: AccessSettings }`.

### GET /v1/hostel-ghar/admin/settings/alerts

Alerts & Notifications tab. Response `{ data: { notifyOnSubscriptionProof, overdueAlertThreshold, dailyDigestEmail, smsGatewayProvider } }`.

### PUT /v1/hostel-ghar/admin/settings/alerts

Save Alerts & Notifications tab. Body: that slice (partial ok). Response `{ data: AlertSettings }`.

### GET /v1/hostel-ghar/admin/settings/system

System & Cache tab. Response `{ data: { maintenanceMode, maintenanceMessage } }`.

### PUT /v1/hostel-ghar/admin/settings/system

Save System & Cache tab. Body: that slice (partial ok). Response `{ data: SystemSettings }`.

### POST /v1/hostel-ghar/admin/settings/system/purge-cache

Body `{}`. Response `{ message, purgedAt? }`.
Wired to System tab purge button.

### GET+PUT /v1/hostel-ghar/admin/settings (legacy, fallback)

Full `PlatformSettings` document — kept as fallback until per-tab routes ship.
Frontend tries per-tab URLs first, then falls back here, then localStorage.

### GET /v1/hostel-ghar/admin/platform-qrs

Lists checkout QRs owners scan. Response `{ data: PlatformQr[] }` where
`PlatformQr = { id, method: ESEWA|KHALTI|BANK, qrImageUrl, label, isActive? }`.
Wired to Platform QRs tab list + owner `/subscription` checkout panel.
**IMPLEMENTED** on the backend (`d:\HostelGhar`): `platform_qrs` table +
`/admin/platform-qrs` CRUD + owner-facing `GET /platform-qrs`. Admin uploads
now persist to Postgres + Cloudinary, so owners on every device see them.

### POST /v1/hostel-ghar/admin/platform-qrs

Upload a checkout QR. Multipart (`qrImage` file + `method` + `label` fields)
or JSON `{ method, label, qrImageUrl }`. Response `{ data: PlatformQr }`.
Upserts by `method` (one QR per method) — posting an existing method updates it.

### PUT /v1/hostel-ghar/admin/platform-qrs/:id

Replace image/label (same multipart-or-JSON shape). Response `{ data: PlatformQr }`.

### DELETE /v1/hostel-ghar/admin/platform-qrs/:id

Remove a checkout QR. Response `{ message }`.

## Frontend files

- `src/lib/api-types.ts` — types + contract comment
- `src/lib/hostelGhar.ts` — `settings.*`, `platformSettings.*` (+ `listQrs/createQr/updateQr/removeQr`)
- `src/lib/settings-fallback.ts` — 404 fallback helpers
- `src/lib/platform-qr.ts` — `setBackendPlatformQrs()` backend cache (checkout reads backend URL first)
- `src/hooks/useOwnerSettings.ts` — owner page state
- `src/hooks/usePlatformSettings.ts` — admin state incl. QR list/upsert/remove
- `src/app/(dashboard)/settings/page.tsx` — profile, prefs, password
- `src/components/admin/AdminSettingsView.tsx` — all 6 tabs (QR tab backend-first)
- `src/components/admin/PlatformQrUploadForm.tsx` — backend-first upload, local fallback
- `src/components/subscription/PlatformQrPanel.tsx` — owner checkout (reads backend cache via `getPlatformQr`)
