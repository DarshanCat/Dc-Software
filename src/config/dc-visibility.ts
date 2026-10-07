/**
 * Which DC statuses each role may see in the general DC listing (/dcs) and DC History.
 * This does NOT restrict action queues (e.g. Manager Approval) or the DC detail page -
 * only the status filter applied to the list view for non-ADMIN roles.
 */
export const ROLE_ALLOWED_STATUSES: Record<string, string[]> = {
  SECURITY: ["DRAFT", "APPROVED", "DISPATCHED", "AT_VENDOR", "SECURITY_RETURNED"],
  STORES: ["DRAFT", "PENDING_APPROVAL", "SECURITY_RETURNED", "STORE_VERIFIED", "CUSTODIAN_VERIFIED"],
  MANAGEMENT: [
    "PENDING_APPROVAL",
    "APPROVED",
    "DISPATCHED",
    "AT_VENDOR",
    "SECURITY_RETURNED",
    "STORE_VERIFIED",
    "QUALITY_COMPLETED",
    "FINAL_APPROVED",
    "APPROVED_FOR_PAYMENT",
    "CUSTODIAN_VERIFIED",
    "CLOSED",
  ],
  ACCOUNTS: ["QUALITY_COMPLETED", "FINAL_APPROVED", "APPROVED_FOR_PAYMENT", "CUSTODIAN_VERIFIED", "CLOSED"],
  PRODUCTION: ["DRAFT", "PENDING_APPROVAL", "APPROVED"],
  QUALITY: ["STORE_VERIFIED", "QUALITY_COMPLETED"],
};
