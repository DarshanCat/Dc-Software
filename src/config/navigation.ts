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

export const ADMIN_NAVIGATION: NavSection[] = [
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
    label: "Work Orders",
    items: [
      { label: "All Work Orders", href: "/work-orders", permission: P.DC_VIEW },
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
      { label: "At Vendor", href: "/dcs?status=AT_VENDOR", permission: P.DC_VIEW },
      { label: "Security Returned", href: "/dcs?status=SECURITY_RETURNED", permission: P.DC_VIEW },
      { label: "Store Verified", href: "/dcs?status=STORE_VERIFIED", permission: P.DC_VIEW },
      { label: "Final Approved", href: "/dcs?status=FINAL_APPROVED", permission: P.DC_VIEW },
      { label: "Approved for Payment", href: "/dcs?status=APPROVED_FOR_PAYMENT", permission: P.DC_VIEW },
      { label: "Close DC", href: "/dcs/close", permission: P.DC_VIEW },
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
      { label: "Expected Scrap", href: "/scrap?view=expected", permission: P.SCRAP_VIEW },
      { label: "Received Scrap", href: "/scrap?view=received", permission: P.SCRAP_VIEW },
      { label: "Scrap Outstanding", href: "/scrap?view=outstanding", permission: P.SCRAP_VIEW },
      { label: "Scrap Exceptions", href: "/scrap?view=exceptions", permission: P.SCRAP_VIEW },
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
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Users", href: "/admin/users", permission: P.USER_MANAGE },
      { label: "Registration Requests", href: "/admin/users/requests", permission: P.USER_MANAGE },
      { label: "Roles", href: "/admin/roles", permission: P.ROLE_MANAGE },
      { label: "Permissions", href: "/admin/permissions", permission: P.ROLE_MANAGE },
      { label: "Audit Trail", href: "/admin/audit", permission: P.AUDIT_VIEW },
      { label: "Numbering", href: "/admin/numbering", permission: P.SYSTEM_SETTINGS },
      { label: "Settings", href: "/admin/settings", permission: P.SYSTEM_SETTINGS },
    ],
  },
];

export const SECURITY_NAVIGATION: NavSection[] = [
  {
    label: "SECURITY OPERATIONS",
    items: [
      { label: "Security Dashboard", href: "/security/dashboard" },
      { label: "Waiting for Dispatch", href: "/security/dispatch" },
      { label: "Dispatched / At Vendor", href: "/security/dispatched" },
      { label: "Material Inward / Return", href: "/security/material-inward" },
      { label: "My Security Entries", href: "/security/my-entries" },
    ],
  },
];

export const STORES_NAVIGATION: NavSection[] = [
  {
    label: "STORE OPERATIONS",
    items: [
      { label: "Store Dashboard", href: "/stores/dashboard" },
      { label: "Create DC", href: "/dcs/new" },
      { label: "Draft DCs", href: "/dcs?status=DRAFT" },
      { label: "Pending Approval", href: "/dcs?status=PENDING_APPROVAL" },
      { label: "Store Verification", href: "/dcs?status=SECURITY_RETURNED" },
      { label: "Completed Verification", href: "/dcs?status=STORE_VERIFIED" },
    ],
  },
  {
    label: "MATERIAL RETURNS",
    items: [
      { label: "Receive Material", href: "/receipts/new" },
      { label: "Pending Verification", href: "/receipts?pending=1" },
    ],
  },
];

export const MANAGEMENT_NAVIGATION: NavSection[] = [
  {
    label: "MANAGEMENT DASHBOARD",
    items: [
      { label: "Overview", href: "/management/dashboard" },
      { label: "Pending DC Approval", href: "/dcs?status=PENDING_APPROVAL" },
      { label: "DCs Requiring Correction", href: "/dcs?status=DRAFT" },
      { label: "Store Verified / Final Approval", href: "/dcs?status=STORE_VERIFIED" },
      { label: "Discrepancies", href: "/dcs/close?stage=manager" },
      { label: "Payment Approval", href: "/dcs?status=FINAL_APPROVED" },
      { label: "DC History", href: "/dcs" },
    ],
  },
  {
    label: "DELIVERY CHALLANS",
    items: [
      { label: "Create DC", href: "/dcs/new" },
      { label: "Draft DCs", href: "/dcs?status=DRAFT" },
      { label: "Pending Approval", href: "/dcs?status=PENDING_APPROVAL" },
      { label: "Approved DCs", href: "/dcs?status=APPROVED" },
      { label: "Final Approval", href: "/dcs?status=STORE_VERIFIED" },
      { label: "Approved for Payment", href: "/dcs?status=APPROVED_FOR_PAYMENT" },
      { label: "DC History", href: "/dcs" },
    ],
  },
];

export const ACCOUNTS_NAVIGATION: NavSection[] = [
  {
    label: "ACCOUNTS",
    items: [
      { label: "Accounts Dashboard", href: "/accounts/dashboard" },
      { label: "Approved for Payment", href: "/dcs?status=APPROVED_FOR_PAYMENT" },
      { label: "Payment Entry", href: "/dcs/close" },
      { label: "Ready to Close", href: "/dcs/close?stage=accounts" },
      { label: "Closed DCs", href: "/dcs?status=CLOSED" },
      { label: "Payment History", href: "/reports/dc-register" },
    ],
  },
];

export const PRODUCTION_NAVIGATION: NavSection[] = [
  {
    label: "PRODUCTION OPERATIONS",
    items: [
      { label: "Production Dashboard", href: "/production/dashboard" },
      { label: "Create DC", href: "/dcs/new" },
      { label: "My Drafts", href: "/dcs?status=DRAFT" },
      { label: "Authorized DCs", href: "/dcs" },
      { label: "Pending Approval", href: "/dcs?status=PENDING_APPROVAL" },
    ],
  },
];

export function getNavigationForUser(roleKeys: string[] = []): NavSection[] {
  if (roleKeys.includes("ADMIN")) {
    return ADMIN_NAVIGATION;
  }
  if (roleKeys.includes("SECURITY")) {
    return SECURITY_NAVIGATION;
  }
  if (roleKeys.includes("STORES")) {
    return STORES_NAVIGATION;
  }
  if (roleKeys.includes("MANAGEMENT")) {
    return MANAGEMENT_NAVIGATION;
  }
  if (roleKeys.includes("ACCOUNTS")) {
    return ACCOUNTS_NAVIGATION;
  }
  if (roleKeys.includes("PRODUCTION")) {
    return PRODUCTION_NAVIGATION;
  }

  // Fallback for default user
  return ADMIN_NAVIGATION;
}

export const NAVIGATION = ADMIN_NAVIGATION;