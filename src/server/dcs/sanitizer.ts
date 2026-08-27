/**
 * Server-side blind payload sanitizer.
 * Restricts sensitive role data so that Security cannot inspect Store data
 * and Stores cannot inspect Security data in API responses or page props.
 */
export function filterDcDataForRole<T extends Record<string, any>>(dc: T, userRole: string): T {
  if (!dc) return dc;

  if (userRole === "SECURITY") {
    const sanitized = { ...dc };
    delete sanitized.storeVerifiedFgQuantity;
    delete sanitized.storeVerifiedRejectionQuantity;
    delete sanitized.storeVerifiedScrapQuantity;
    delete sanitized.storeRemarks;
    delete sanitized.storeVerifiedBy;
    delete sanitized.storeVerifiedAt;
    delete sanitized.invoiceNumber;
    delete sanitized.invoiceDate;
    delete sanitized.invoiceAmount;
    delete sanitized.paymentReferenceNumber;
    delete sanitized.paymentDate;
    delete sanitized.paymentRemarks;
    delete sanitized.finalPayableAmount;
    return sanitized;
  }

  if (userRole === "STORES") {
    const sanitized = { ...dc };
    delete sanitized.securityFgQuantity;
    delete sanitized.securityRejectionQuantity;
    delete sanitized.securityScrapQuantity;
    delete sanitized.securityReturnDate;
    delete sanitized.securityReturnTime;
    delete sanitized.securityReturnRemarks;
    delete sanitized.securityEnteredBy;
    delete sanitized.securityEnteredAt;
    delete sanitized.invoiceNumber;
    delete sanitized.invoiceDate;
    delete sanitized.invoiceAmount;
    delete sanitized.paymentReferenceNumber;
    delete sanitized.paymentDate;
    delete sanitized.paymentRemarks;
    delete sanitized.finalPayableAmount;
    return sanitized;
  }

  return dc;
}
