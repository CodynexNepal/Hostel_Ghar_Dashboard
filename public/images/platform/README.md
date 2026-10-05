# Hostel Ghar platform QRs (subscription payments)

Owners scan these to BUY a subscription (BASIC / PRO / ENTERPRISE).
They are **platform** QRs — Hostel Ghar's own accounts — not a hostel's
resident-payment QRs (those live in Settings → Payment QRs).

## Add your real QRs (recommended)

Drop files here (exact names):

- `esewa-qr.png` (or `.jpg`)
- `khalti-qr.png`
- `bank-qr.png` (Fonepay / bank QR)

Then set the account labels via env (`.env.local`):

```env
NEXT_PUBLIC_PLATFORM_ESEWA_LABEL="eSewa ID: 98XXXXXXXX • Hostel Ghar"
NEXT_PUBLIC_PLATFORM_KHALTI_LABEL="Khalti ID: 98XXXXXXXX • Hostel Ghar"
NEXT_PUBLIC_PLATFORM_BANK_LABEL="Nabil Bank • A/C 0123456789 • Hostel Ghar Pvt. Ltd."
```

Restart `next dev` after changing env.

Alternatively override image URLs entirely:

```env
NEXT_PUBLIC_PLATFORM_ESEWA_QR=https://…/esewa.png
NEXT_PUBLIC_PLATFORM_KHALTI_QR=https://…/khalti.png
NEXT_PUBLIC_PLATFORM_BANK_QR=https://…/bank.png
```

## Flow

1. Owner picks plan → cycle → method (eSewa / Khalti / Bank / Cash).
2. Step 1 shows the official Hostel Ghar QR + exact amount + copy/save + how-to-pay.
3. Step 2 uploads the payment-success screenshot (+ optional reference).
4. Submit → `POST /subscriptions/subscribe` (multipart with `proof`) → PENDING.
5. Super-admin approves in `/admin/subscriptions` → plan activates.
