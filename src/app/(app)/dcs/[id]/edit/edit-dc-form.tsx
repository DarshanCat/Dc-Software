"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateOutwardDc, UpdateOutwardDcInput } from "@/server/dcs/extended-actions";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useTallyNavigation } from "@/hooks/use-tally-navigation";

interface VendorOption {
  id: string;
  vendorCode: string;
  vendorName: string;
  address: string | null;
  gstNumber: string | null;
  city: string | null;
  state: string | null;
}

interface ItemOption {
  id: string;
  itemCode: string;
  itemName: string;
  description: string | null;
  rate: any;
}

interface DepartmentOption {
  id: string;
  code: string;
  name: string;
}

interface DcData {
  id: string;
  dcNumber: string;
  vendorId: string | null;
  department: string;
  woNumber: string;
  partNumber: string | null;
  partDescriptionSnapshot: string | null;
  outwardQtyRw: number | null;
  returningFgQuantity: number | null;
  outwardWeight: number | null;
  outwardGatingWeight: number | null;
  outwardBoringWeight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  pricingBasis: "RW" | "FG" | null;
  ratePerQuantity: number | null;
  remarks: string | null;
  status: string;
}

interface Props {
  dc: DcData;
  vendors: VendorOption[];
  items?: ItemOption[];
  departments?: DepartmentOption[];
}

export function EditDcForm({ dc, vendors, items = [], departments = [] }: Props) {
  const router = useRouter();
  const { containerRef, handleKeyDown } = useTallyNavigation({
    onValidationError: (_el, msg) => setError(msg),
  });

  const matchingItem = items.find((i) => i.itemCode === dc.partNumber);

  const [selectedVendorId, setSelectedVendorId] = useState(dc.vendorId || "");
  const [department, setDepartment] = useState(dc.department || "PRODUCTION");

  const [woNumber, setWoNumber] = useState(dc.woNumber || "");
  const [selectedPartId, setSelectedPartId] = useState(matchingItem ? matchingItem.id : "");
  const [customPartNumber, setCustomPartNumber] = useState(dc.partNumber || "");
  const [partDescription, setPartDescription] = useState(dc.partDescriptionSnapshot || "");

  const [outwardQtyRw, setOutwardQtyRw] = useState(dc.outwardQtyRw ? String(dc.outwardQtyRw) : "");
  const [returningFgQuantity, setReturningFgQuantity] = useState(dc.returningFgQuantity ? String(dc.returningFgQuantity) : "");

  const [outwardWeight, setOutwardWeight] = useState(dc.outwardWeight ? String(dc.outwardWeight) : "");
  const [outwardGatingWeight, setOutwardGatingWeight] = useState(dc.outwardGatingWeight ? String(dc.outwardGatingWeight) : "");
  const [outwardBoringWeight, setOutwardBoringWeight] = useState(dc.outwardBoringWeight ? String(dc.outwardBoringWeight) : "");

  const [length, setLength] = useState(dc.length ? String(dc.length) : "");
  const [width, setWidth] = useState(dc.width ? String(dc.width) : "");
  const [height, setHeight] = useState(dc.height ? String(dc.height) : "");

  const [pricingBasis, setPricingBasis] = useState<"RW" | "FG">(dc.pricingBasis === "FG" ? "FG" : "RW");
  const [ratePerQuantity, setRatePerQuantity] = useState(dc.ratePerQuantity ? String(dc.ratePerQuantity) : "");
  const [remarks, setRemarks] = useState(dc.remarks || "");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedVendor = vendors.find((v) => v.id === selectedVendorId);

  function handleVendorChange(vendorId: string) {
    setSelectedVendorId(vendorId);
  }

  function handlePartChange(partId: string) {
    setSelectedPartId(partId);
    if (!partId) {
      setPartDescription("");
      setRatePerQuantity("");
      return;
    }
    const foundItem = items.find((i) => i.id === partId);
    if (foundItem) {
      setCustomPartNumber(foundItem.itemCode);
      setPartDescription(foundItem.description || foundItem.itemName || "");
      if (foundItem.rate) setRatePerQuantity(String(foundItem.rate));
    }
  }

  const activePricingQty = pricingBasis === "RW" ? Number(outwardQtyRw || 0) : Number(returningFgQuantity || 0);
  const calculatedAmount = (activePricingQty * Number(ratePerQuantity || 0)).toFixed(2);

  async function handleSubmit(submitForApproval: boolean) {
    setError(null);
    setSuccess(null);

    if (!selectedVendorId) return setError("Supplier (Vendor) is mandatory.");
    if (!woNumber.trim()) return setError("WO ID (Work Order) is mandatory.");
    const partNum = customPartNumber.trim() || (items.find((i) => i.id === selectedPartId)?.itemCode || "");
    if (!partNum) return setError("Part Number is mandatory.");

    if (!pricingBasis) return setError("Please select a pricing basis: RW Quantity or Returning FG Quantity.");
    const rateVal = parseFloat(ratePerQuantity);
    if (isNaN(rateVal) || rateVal <= 0) return setError("Rate Per Quantity must be greater than zero.");

    if (pricingBasis === "RW") {
      const rwVal = parseFloat(outwardQtyRw);
      if (isNaN(rwVal) || rwVal <= 0) return setError("Outward Qty RW must be greater than zero when Price Based On is RW Quantity.");
    } else if (pricingBasis === "FG") {
      const fgVal = parseFloat(returningFgQuantity);
      if (isNaN(fgVal) || fgVal <= 0) return setError("Returning FG Qty must be greater than zero when Price Based On is Returning FG Quantity.");
    }

    setLoading(true);

    const payload: UpdateOutwardDcInput = {
      dcId: dc.id,
      vendorId: selectedVendorId,
      department,
      woNumber: woNumber.trim(),
      partNumber: partNum,
      partDescription: partDescription.trim() || undefined,
      pricingBasis,
      ratePerQuantity: rateVal,
      outwardWeight: outwardWeight ? parseFloat(outwardWeight) : undefined,
      outwardGatingWeight: outwardGatingWeight ? parseFloat(outwardGatingWeight) : undefined,
      outwardQtyRw: outwardQtyRw ? parseFloat(outwardQtyRw) : undefined,
      returningFgQuantity: returningFgQuantity ? parseFloat(returningFgQuantity) : undefined,
      length: length ? parseFloat(length) : undefined,
      width: width ? parseFloat(width) : undefined,
      height: height ? parseFloat(height) : undefined,
      outwardBoringWeight: outwardBoringWeight ? parseFloat(outwardBoringWeight) : undefined,
      remarks: remarks.trim() || undefined,
      submitForApproval,
    };

    const res = await updateOutwardDc(payload);
    setLoading(false);

    if (!res.ok) {
      setError(res.error || "An error occurred while updating Delivery Challan.");
    } else {
      setSuccess(
        submitForApproval
          ? `DC ${res.dcNumber} updated and submitted for Manager Approval successfully.`
          : `DC ${res.dcNumber} updated and saved as DRAFT successfully.`
      );
      setTimeout(() => router.push(`/dcs/${res.dcId}`), 1000);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200 font-medium">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700 border border-emerald-200 font-medium">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <form
        ref={containerRef as any}
        onKeyDown={handleKeyDown}
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(false);
        }}
        className="space-y-6"
      >
        {/* SECTION 1: DOCUMENT INFORMATION */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700 border-b pb-2">
            Section 1: Document Information — {dc.dcNumber}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier Name *</label>
              <select
                data-tally-id="supplier"
                value={selectedVendorId}
                onChange={(e) => handleVendorChange(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                required
              >
                <option value="">-- Select Supplier --</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vendorName} ({v.vendorCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Supplier Address (Auto-filled)</label>
              <input
                type="text"
                readOnly
                data-tally-skip="true"
                value={selectedVendor ? selectedVendor.address || `${selectedVendor.city || ""}, ${selectedVendor.state || ""}` : ""}
                className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">GST Number (Auto-filled)</label>
              <input
                type="text"
                readOnly
                data-tally-skip="true"
                value={selectedVendor ? selectedVendor.gstNumber || "N/A" : ""}
                className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Department *</label>
              <select
                data-tally-id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                required
              >
                {departments.length > 0 ? (
                  departments.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name} ({d.code})
                    </option>
                  ))
                ) : (
                  <>
                    <option value="PRODUCTION">PRODUCTION</option>
                    <option value="STORES">STORES</option>
                    <option value="FOUNDRY">FOUNDRY</option>
                    <option value="QUALITY">QUALITY</option>
                    <option value="MACHINING">MACHINING</option>
                  </>
                )}
              </select>
            </div>
          </div>
        </div>

        {/* SECTION 2: WORK ORDER / PART INFORMATION */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700 border-b pb-2">
            Section 2: Work Order &amp; Part Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">WO ID (Work Order Number) *</label>
              <input
                type="text"
                data-tally-id="woNumber"
                value={woNumber}
                onChange={(e) => setWoNumber(e.target.value)}
                placeholder="e.g. WO-2026-001"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Part Number *</label>
              {items.length > 0 ? (
                <select
                  data-tally-id="partNumber"
                  value={selectedPartId}
                  onChange={(e) => handlePartChange(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="">-- Select Part from Master --</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.itemCode} - {i.itemName}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  data-tally-id="partNumber"
                  value={customPartNumber}
                  onChange={(e) => setCustomPartNumber(e.target.value)}
                  placeholder="e.g. PN-9988"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Part Description (Auto-filled)</label>
              <input
                type="text"
                readOnly
                disabled
                data-tally-skip="true"
                value={partDescription}
                placeholder="Auto-filled from Part Master"
                className="w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none cursor-not-allowed font-medium"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: OUTWARD QUANTITY */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700 border-b pb-2">
            Section 3: Outward Quantity
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Outward Qty RW *</label>
              <input
                type="number"
                step="0.001"
                min="0"
                data-tally-id="outwardQtyRw"
                value={outwardQtyRw}
                onChange={(e) => setOutwardQtyRw(e.target.value)}
                placeholder="Raw material quantity sent (NOS)"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Returning FG Qty *</label>
              <input
                type="number"
                step="0.001"
                min="0"
                data-tally-id="returningFgQuantity"
                value={returningFgQuantity}
                onChange={(e) => setReturningFgQuantity(e.target.value)}
                placeholder="Finished goods expected back (NOS)"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>
        </div>

        {/* SECTION 4: OUTWARD WEIGHT */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700 border-b pb-2">
            Section 4: Outward Weight (KG)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Outward Weight (KG) *</label>
              <input
                type="number"
                step="0.001"
                min="0"
                data-tally-id="outwardWeight"
                value={outwardWeight}
                onChange={(e) => setOutwardWeight(e.target.value)}
                placeholder="Total outward gross weight"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Outward Gating Weight (KG) *</label>
              <input
                type="number"
                step="0.001"
                min="0"
                data-tally-id="outwardGatingWeight"
                value={outwardGatingWeight}
                onChange={(e) => setOutwardGatingWeight(e.target.value)}
                placeholder="Gating / runner weight"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Outward Boring Weight (KG) *</label>
              <input
                type="number"
                step="0.001"
                min="0"
                data-tally-id="outwardBoringWeight"
                value={outwardBoringWeight}
                onChange={(e) => setOutwardBoringWeight(e.target.value)}
                placeholder="Boring / chip weight"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>
        </div>

        {/* SECTION 5: DIMENSIONS */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700 border-b pb-2">
            Section 5: Dimensions (mm)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Length (mm)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                data-tally-id="length"
                value={length}
                onChange={(e) => setLength(e.target.value)}
                placeholder="Length"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Width (mm)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                data-tally-id="width"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                placeholder="Width"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Height (mm)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                data-tally-id="height"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="Height"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* SECTION 6: PRICING & COMMERCIAL */}
        <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-blue-950 border-b border-blue-200 pb-2">
            Section 6: Pricing &amp; Commercial
          </h2>

          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-900 uppercase tracking-wide">
              PRICE BASED ON <span className="text-red-600">*</span>
            </label>
            <div className="flex flex-col sm:flex-row gap-4 pt-1">
              <label className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${pricingBasis === "RW" ? "bg-blue-100/70 border-blue-600 text-blue-950 font-bold" : "bg-white border-slate-300 text-slate-700"}`}>
                <input
                  type="radio"
                  name="pricingBasis"
                  value="RW"
                  data-tally-id="pricingBasis"
                  checked={pricingBasis === "RW"}
                  onChange={() => setPricingBasis("RW")}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <div className="text-xs">
                  <span className="block font-semibold">RW QUANTITY</span>
                  <span className="text-[11px] opacity-80">Calculated using Outward Qty RW ({outwardQtyRw || 0} NOS)</span>
                </div>
              </label>

              <label className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${pricingBasis === "FG" ? "bg-blue-100/70 border-blue-600 text-blue-950 font-bold" : "bg-white border-slate-300 text-slate-700"}`}>
                <input
                  type="radio"
                  name="pricingBasis"
                  value="FG"
                  checked={pricingBasis === "FG"}
                  onChange={() => setPricingBasis("FG")}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <div className="text-xs">
                  <span className="block font-semibold">RETURNING FG QUANTITY</span>
                  <span className="text-[11px] opacity-80">Calculated using Returning FG Qty ({returningFgQuantity || 0} NOS)</span>
                </div>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Rate Per Quantity (₹) <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                data-tally-id="ratePerQuantity"
                value={ratePerQuantity}
                onChange={(e) => setRatePerQuantity(e.target.value)}
                placeholder="Rate per NOS"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                required
              />
            </div>

            <div className="rounded-lg bg-white p-3 border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Calculated Commercial Output</span>
              <div className="text-xs space-y-0.5 font-sans">
                <p className="text-slate-600">
                  Pricing Basis: <span className="font-bold text-slate-900">{pricingBasis === "RW" ? "RW Quantity" : "Returning FG Quantity"}</span>
                </p>
                <p className="text-slate-600">
                  Quantity Used: <span className="font-mono font-bold text-slate-900">{activePricingQty} NOS</span>
                  {" × "}
                  Rate: <span className="font-mono font-bold text-slate-900">₹{ratePerQuantity || "0.00"}</span>
                </p>
                <p className="text-sm font-bold text-emerald-800 pt-1">
                  Calculated Amount: <span className="font-mono text-base">₹{calculatedAmount}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 7: REMARKS */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700 border-b pb-2">
            Section 7: Remarks &amp; Attachments
          </h2>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks / Notes</label>
            <input
              type="text"
              data-tally-id="remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Special job work instructions or transport notes"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 border-t pt-4">
          <Button
            type="button"
            variant="secondary"
            data-tally-id="cancelBtn"
            onClick={() => router.back()}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="secondary"
            disabled={loading}
            data-tally-id="saveDraftBtn"
            onClick={() => handleSubmit(false)}
            className="w-full sm:w-auto border-blue-600 text-blue-700 hover:bg-blue-50 font-semibold px-5"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "SAVE EDITS"}
          </Button>

          <Button
            type="button"
            disabled={loading}
            data-tally-id="submitBtn"
            onClick={() => handleSubmit(true)}
            className="w-full sm:w-auto bg-blue-700 hover:bg-blue-800 text-white font-bold px-6"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting DC...
              </span>
            ) : (
              "SAVE & SUBMIT FOR APPROVAL"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
