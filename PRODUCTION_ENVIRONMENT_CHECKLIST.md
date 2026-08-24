# Production Environment Variable Checklist — Vercel

This checklist details all required environment variables for the DC Material Management application across Vercel environments.

---

## Environment Variables Matrix

| Variable Name | Server/Client Scope | Development | Preview | Production | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Server-Only | Local PostgreSQL / Neon Dev Branch | Neon Preview / Branch | Neon Production DB (`pooled`) | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Server-Only | Dev secret key | Staging secret key | Cryptographically generated 32+ byte string | JWT session signing secret |
| `NEXTAUTH_URL` | Server-Only | `http://localhost:3000` | `https://<preview-domain>.vercel.app` | `https://dc.vijayspheroidals.in` | Canonical app URL for NextAuth callbacks |
| `BLOB_READ_WRITE_TOKEN` | Server-Only | (Optional / Local fallback) | Vercel Blob Token | Vercel Blob Read/Write Token | Token for cloud file upload and storage |

---

## Security Verification Checklist

- [x] **No Client Exposure**: No secrets are prefixed with `NEXT_PUBLIC_`.
- [x] **No Committed Secrets**: `.env` and `.env.local` files are listed in `.gitignore` and excluded from repository commits.
- [x] **Server-Side Restriction**: `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, and `NEXTAUTH_SECRET` are referenced exclusively in server components, API routes, middleware, and server actions.
- [x] **Password Protection**: User password hashes are excluded from API responses and client session payloads.
