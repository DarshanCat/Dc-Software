"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createOutwardDc, CreateOutwardDcInput } from "@/server/dcs/extended-actions";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

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

interface Props {
  vendors: VendorOption[];
  items?: ItemOption[];
}

export function CreateDcForm({ vendors, items = [] }: Props) {
  const router = useRouter();

  // Form state according to new business requirements
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [documentDate, setDocumentDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [department, setDepartment] = useState("PRODUCTION");

  const [woNumber, setWoNumber] = useState("");
  const [selectedPartId, setSelectedPartId] = useState("");
  const [customPartNumber, setCustomPartNumber] = useState("");
  const [partDescription, setPartDescription] = useState("");

  const [outwardQtyRw, setOutwardQtyRw] = useState("");
  const [returningFgQuantity, setReturningFgQuantity] = useState("");

  const [outwardWeight, setOutwardWeight] = useState("");
  const [outwardGatingWeight, setOutwardGatingWeight] = useState("");
  const [outwardBoringWeight, setOutwardBoringWeight] = useState("");

  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");

  const [pricing, setPricing] = useState("");
  const [remarks, setRemarks] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Auto-population calculations
  const selectedVendor = vendors.find((v) => v.id === selectedVendorId);

  function handleVendorChange(vendorId: string) {
    setSelectedVendorId(vendorId);
  }

  function handlePartChange(partId: string) {
    setSelectedPartId(partId);
    if (!partId) {
      setPartDescription("");
      setPricing("");
      return;
    }
    const foundItem = items.find((i) => i.id === partId);
    if (foundItem) {
      setCustomPartNumber(foundItem.itemCode);
      setPartDescription(foundItem.description || foundItem.itemName || "");
      if (foundItem.rate) setPricing(String(foundItem.rate));
    }
  }

  async function handleSubmit(isDraft: boolean) {
    setError(null);
    setSuccess(null);

    if (!selectedVendorId) return setError("Supplier (Vendor) is mandatory.");
    if (!woNumber.trim()) return setError("WO ID (Work Order) is mandatory.");
    const partNum = customPartNumber.trim() || (items.find((i) => i.id === selectedPartId)?.itemCode || "");
    if (!partNum) return setError("Part Number is mandatory.");

    setLoading(true);

    const payload: CreateOutwardDcInput = {
      vendorId: selectedVendorId,
      department,
      woNumber: woNumber.trim(),
      partNumber: partNum,
      partDescription: partDescription.trim() || undefined,
      pricing: pricing ? parseFloat(pricing) : undefined,
      outwardWeight: outwardWeight ? parseFloat(outwardWeight) : undefined,
      outwardGatingWeight: outwardGatingWeight ? parseFloat(outwardGatingWeight) : undefined,
      outwardQtyRw: outwardQtyRw ? parseFloat(outwardQtyRw) : undefined,
      returningFgQuantity: returningFgQuantity ? parseFloat(returningFgQuantity) : undefined,
      length: length ? parseFloat(length) : undefined,
      width: width ? parseFloat(width) : undefined,
      height: height ? parseFloat(height) : undefined,
      outwardBoringWeight: outwardBoringWeight ? parseFloat(outwardBoringWeight) : undefined,
      remarks: remarks.trim() || undefined,
    };

    const res = await createOutwardDc(payload);
    setLoading(false);

    if (!res.ok) {
      setError(res.error || "An error occurred while creating Outward DC.");
    } else {
      setSuccess(`Outward DC ${res.dcNumber} created successfully.`);
      setTimeout(() => router.push(`/dcs/${res.dcId}`), 1000);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(false); }} className="space-y-6">
        {/* SECTION 1: DOCUMENT INFORMATION */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700 border-b pb-2">
            Section 1: Document Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier Name *</label>
              <select
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
                value={selectedVendor ? selectedVendor.address || `${selectedVendor.city || ""}, ${selectedVendor.state || ""}` : ""}
                className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 focus:outline-none"
                placeholder="Snapshot from Master Data"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">GST Number (Auto-filled)</label>
              <input
                type="text"
                readOnly
                value={selectedVendor ? selectedVendor.gstNumber || "N/A" : ""}
                className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 focus:outline-none"
                placeholder="Snapshot from Master Data"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date of Creating DC *</label>
              <input
                type="date"
                value={documentDate}
                onChange={(e) => setDocumentDate(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Department *</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                required
              >
                <option value="PRODUCTION">PRODUCTION</option>
                <option value="STORES">STORES</option>
                <option value="FOUNDRY">FOUNDRY</option>
                <option value="QUALITY">QUALITY</option>
                <option value="MACHINING">MACHINING</option>
              </select>
            </div>
          </div>
        </div>

        {/* SECTION 2: WORK ORDER / PART INFORMATION */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700 border-b pb-2">
            Section 2: Work Order & Part Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">WO ID (Work Order Number) *</label>
              <input
                type="text"
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
                value={partDescription}
                onChange={(e) => setPartDescription(e.target.value)}
                placeholder="Auto-filled from Part Master"
                className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none"
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
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="Height"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* SECTION 6: PRICING */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700 border-b pb-2">
            Section 6: Pricing
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Pricing (Rate / Unit Amount ₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={pricing}
                onChange={(e) => setPricing(e.target.value)}
                placeholder="Unit rate or standard pricing"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* SECTION 7: REMARKS */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700 border-b pb-2">
            Section 7: Remarks & Attachments
          </h2>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks / Notes</label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Special job work instructions or transport notes"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex justify-end gap-3 border-t pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.back()}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating Outward DC...
              </span>
            ) : (
              "CREATE OUTWARD DC"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}