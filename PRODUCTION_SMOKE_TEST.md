# Production Post-Deployment Manual Smoke Test Sequence

Execute this manual smoke test sequence immediately after deploying to production at `https://dc.vijayspheroidals.in`.

> [!CAUTION]
> Do NOT run automated synthetic write tests directly against the live production database. Use a dedicated test DC or test vendor account for manual verification.

---

## Post-Deployment Verification Sequence

1. **Open Production URL**:  
   Navigate to `https://dc.vijayspheroidals.in`. Confirm HTTPS SSL certificate is valid and login page renders.

2. **Login**:  
   Sign in with an authorized user account.

3. **Dashboard Load**:  
   Verify that Dashboard KPI cards (Total Open DCs, Overdue DCs, Material Outside, Finished Pending, Scrap Pending, Reconciliation Exceptions) load live figures without server errors.

4. **Search DC**:  
   Navigate to `/search` or top search bar. Query an existing DC number (e.g. `DC-2026-000001`). Confirm search results display the matching record.

5. **Search Work Order**:  
   Search for a Work Order ID (e.g. `WO-2026-00100`). Confirm matching DC records are returned.

6. **Open Existing DC**:  
   Click on a Delivery Challan from the list. Confirm DC details, item lists, expected summary, and transport details load.

7. **Generate PDF**:  
   Click **Print / PDF**. Confirm PDF document renders with logo, company details, DC number, WO ID, transport info, E-Way Bill, and E-Sugam fields.

8. **Test QR Code**:  
   Scan the on-screen QR code or open `/qr/<qrToken>`. Confirm public non-logged-in view resolves and allows PDF download.

9. **Create Test DC**:  
   Navigate to `/dcs/new`. Create a controlled test DC with Work Order reference, vendor, purpose, and item details.

10. **Submit**:  
    Submit the test DC for approval (`DRAFT` → `PENDING_APPROVAL`).

11. **Approve**:  
    Log in as an authorized approver and click **Approve** (`PENDING_APPROVAL` → `APPROVED`).

12. **Dispatch**:  
    Click **Dispatch**. Enter vehicle number, transporter name, E-Way Bill number, and E-Sugam number (`APPROVED` → `DISPATCHED`).

13. **Receive**:  
    Click **Material Receipt**. Enter received items.

14. **Enter Returned Quantity**:  
    Record the returned finished component quantity.

15. **Enter Boring Received**:  
    Record the received boring scrap weight (KG).

16. **Classify Good / Scrap**:  
    Perform internal classification (e.g., Good: 47 Nos, Scrap: 3 Nos). Confirm Good + Scrap = Received quantity.

17. **Reconcile**:  
    Navigate to Reconciliation tab/panel. Verify accounted weight, scrap recovery %, process loss, and variance calculations match expected formulas.

18. **Close**:  
    Click **Close DC** (`RECONCILED` → `CLOSED`).

19. **Verify Reports**:  
    Navigate to `/reports/dc-register` and export CSV. Confirm the new DC details, E-Way Bill, and E-Sugam fields are in the CSV export.

20. **Upload Document**:  
    On DC detail view, upload a sample PDF document.

21. **Refresh Page**:  
    Reload browser page (`F5`). Confirm uploaded document remains listed.

22. **Download Document**:  
    Click document download link. Verify the document downloads correctly from Vercel Blob storage (`https://*.public.blob.vercel-storage.com`).

23. **Verify Document Persistence**:  
    Log out and log back in; verify document access and permissions remain enforced.
