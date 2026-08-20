import { PERMISSIONS as P } from "./permissions";

export interface NavItem {
  label: string;
  href: string;
  permission?: string;
}
export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAVIGATION: NavSection[] = [
  {
    label: "Dashboard",
    items: [
      { label: "Overview", href: "/", permission: P.DASHBOARD_VIEW },
      { label: "Open DCs", href: "/dashboard/open", permission: P.DASHBOARD_VIEW },
      { label: "Overdue DCs", href: "/dashboard/overdue", permission: P.DASHBOARD_VIEW },
      { label: "Material Outside", href: "/dashboard/material-outside", permission: P.DASHBOARD_VIEW },
      { label: "Scrap Outstanding", href: "/dashboard/scrap-outstanding", permission: P.DASHBOARD_VIEW },
      { label: "Reconciliation Exceptions", href: "/dashboard/exceptions", permission: P.DASHBOARD_VIEW },
    ],
  },
  {
    label: "Delivery Challans",
    items: [
      { label: "All DCs", href: "/dcs", permission: P.DC_VIEW },
      { label: "Create DC", href: "/dcs/new", permission: P.DC_CREATE },
      { label: "Draft", href: "/dcs?status=DRAFT", permission: P.DC_VIEW },
      { label: "Pending Approval", href: "/dcs?status=PENDING_APPROVAL", permission: P.DC_VIEW },
      { label: "Approved", href: "/dcs?status=APPROVED", permission: P.DC_VIEW },
      { label: "Dispatched", href: "/dcs?status=DISPATCHED", permission: P.DC_VIEW },
      { label: "Overdue", href: "/dcs?overdue=1", permission: P.DC_VIEW },
    ],
  },
  {
    label: "Material Returns",
    items: [
      { label: "All Returns", href: "/receipts", permission: P.RECEIPT_VIEW },
      { label: "Receive Material", href: "/receipts/new", permission: P.RECEIPT_CREATE },
      { label: "Pending Returns", href: "/receipts?pending=1", permission: P.RECEIPT_VIEW },
      { label: "Partial Returns", href: "/receipts?partial=1", permission: P.RECEIPT_VIEW },
    ],
  },
  {
    label: "Scrap Recovery",
    items: [
      { label: "Scrap Dashboard", href: "/scrap", permission: P.SCRAP_VIEW },
      { label: "Expected Scrap", href: "/scrap/expected", permission: P.SCRAP_VIEW },
      { label: "Received Scrap", href: "/scrap/received", permission: P.SCRAP_VIEW },
      { label: "Scrap Outstanding", href: "/scrap/outstanding", permission: P.SCRAP_VIEW },
      { label: "Scrap Exceptions", href: "/scrap/exceptions", permission: P.SCRAP_VIEW },
    ],
  },
  {
    label: "Reconciliation",
    items: [
      { label: "Pending Reconciliation", href: "/reconciliation?status=PENDING", permission: P.RECONCILIATION_VIEW },
      { label: "Exceptions", href: "/reconciliation?status=EXCEPTION", permission: P.RECONCILIATION_VIEW },
      { label: "Reconciled", href: "/reconciliation?status=RECONCILED", permission: P.RECONCILIATION_VIEW },
      { label: "Closed", href: "/reconciliation?status=CLOSED", permission: P.RECONCILIATION_VIEW },
    ],
  },
  {
    label: "Masters",
    items: [
      { label: "Vendors", href: "/masters/vendors", permission: P.VENDOR_VIEW },
      { label: "Items", href: "/masters/items", permission: P.ITEM_VIEW },
      { label: "Processes", href: "/masters/processes", permission: P.PROCESS_VIEW },
      { label: "Job Work Standards", href: "/masters/job-work-standards", permission: P.JOB_WORK_STANDARD_VIEW },
      { label: "Scrap Types", href: "/masters/scrap-types", permission: P.PROCESS_VIEW },
      { label: "UOM", href: "/masters/uom", permission: P.PROCESS_VIEW },
    ],
  },
  {
    label: "Reports",
    items: [
      { label: "DC Register", href: "/reports/dc-register", permission: P.REPORT_VIEW },
      { label: "Vendor Outstanding", href: "/reports/vendor-outstanding", permission: P.REPORT_VIEW },
      { label: "Material Outstanding", href: "/reports/material-outstanding", permission: P.REPORT_VIEW },
      { label: "Scrap Recovery", href: "/reports/scrap-recovery", permission: P.REPORT_VIEW },
      { label: "Reconciliation", href: "/reports/reconciliation", permission: P.REPORT_VIEW },
      { label: "Ageing", href: "/reports/ageing", permission: P.REPORT_VIEW },
      { label: "Vendor Performance", href: "/reports/vendor-performance", permission: P.REPORT_VIEW },
      { label: "Item History", href: "/reports/item-history", permission: P.REPORT_VIEW },
    ],
    },
  {
    label: "Notifications",
    items: [
      { label: "All Notifications", href: "/notifications", permission: P.DASHBOARD_VIEW },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Users", href: "/admin/users", permission: P.USER_MANAGE },
      { label: "Roles", href: "/admin/roles", permission: P.ROLE_MANAGE },
      { label: "Permissions", href: "/admin/permissions", permission: P.ROLE_MANAGE },
      { label: "Audit Trail", href: "/admin/audit", permission: P.AUDIT_VIEW },
      { label: "Numbering", href: "/admin/numbering", permission: P.SYSTEM_SETTINGS },
      { label: "Settings", href: "/admin/settings", permission: P.SYSTEM_SETTINGS },
    ],
  },
];