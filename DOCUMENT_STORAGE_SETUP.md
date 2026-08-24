# Production Document Storage Setup — Vercel Blob

This document outlines the manual setup required to enable cloud document storage for the DC Material Management application in production using Vercel Blob.

---

## 1. Overview

In development, document uploads store files locally. In production (`NODE_ENV === "production"`), the application strictly requires Vercel Blob cloud storage. If `BLOB_READ_WRITE_TOKEN` is missing, uploads fail safely with a clear configuration error to prevent unauthorized local file writes on Vercel's ephemeral serverless filesystem.

---

## 2. Vercel Blob Store Provisioning Steps

1. Log into the [Vercel Dashboard](https://vercel.com/dashboard).
2. Select the `dc-material-management` project.
3. Click on the **Storage** tab in the top navigation bar.
4. Click **Create Database / Storage** → Select **Blob** → Click **Continue**.
5. Name the store (e.g., `dc-material-documents`).
6. Select **Read & Write** access.
7. Select your preferred storage region (matching your Neon database region, e.g., `ap-south-1` / Mumbai or `iad1`).
8. Click **Create Store**.

---

## 3. Environment Variable Binding

1. Once the Blob Store is created, Vercel automatically generates environment variables.
2. Ensure `BLOB_READ_WRITE_TOKEN` is attached to:
   - **Production**
   - **Preview** (optional for staging tests)
3. If setting up manually in Vercel Project Settings:
   - Navigate to **Settings** → **Environment Variables**.
   - **Key**: `BLOB_READ_WRITE_TOKEN`
   - **Value**: `<your-vercel-blob-read-write-token>`
   - **Environments**: Select **Production** and **Preview**.
   - Click **Save**.

---

## 4. Post-Setup Verification

After setting `BLOB_READ_WRITE_TOKEN` in Vercel:

1. Trigger a deployment on Vercel.
2. Sign into the application at `https://dc.vijayspheroidals.in/login`.
3. Open any DC detail page.
4. Upload a test PDF document (e.g., test invoice or weighment slip).
5. Verify that the document URL generated starts with `https://<hash>.public.blob.vercel-storage.com/...`.
6. Download the uploaded document to verify persistence.
