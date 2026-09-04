"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createOutwardDc, CreateOutwardDcInput } from "@/server/dcs/extended-actions";
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

interface Props {
  vendors: VendorOption[];
  processes: { id: string; code: string; name: string }[];
}

export function OutwardDcForm({ vendors, processes }: Props) {
  const router = useRouter();
  const { containerRef, handleKeyDown } = useTallyNavigation({
    onValidationError: (_el, msg) => setError(msg),
  });

  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [department, setDepartment] = useState("PRODUCTION");
  const [woNumber, setWoNumber] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [partDescription, setPartDescription] = useState("");
  const [pricingBasis, setPricingBasis] = useState<"RW" | "FG">("RW");
  const [ratePerQuantity, setRatePerQuantity] = useState<string>("");
  const [outwardWeight, setOutwardWeight] = useState<string>("");
  const [outwardGatingWeight, setOutwardGatingWeight] = useState<string>("");
  const [outwardQtyRw, setOutwardQtyRw] = useState<string>("");
  const [returningFgQuantity, setReturningFgQuantity] = useState<string>("");
  const [length, setLength] = useState<string>("");
  const [width, setWidth] = useState<string>("");
  const [height, setHeight] = useState<string>("");
  const [outwardBoringWeight, setOutwardBoringWeight] = useState<string>("");
  const [remarks, setRemarks] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedVendor = vendors.find((v) => v.id === selectedVendorId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedVendorId) return setError("Supplier (Vendor) is mandatory.");
    if (!woNumber.trim()) return setError("WO ID is mandatory.");

    setLoading(true);

    const payload: CreateOutwardDcInput = {
      vendorId: selectedVendorId,
      department,
      woNumber: woNumber.trim(),
      partNumber: partNumber.trim(),
      partDescription: partDescription.trim() || undefined,
      pricingBasis,
      ratePerQuantity: ratePerQuantity ? parseFloat(ratePerQuantity) : undefined,
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
      setTimeout(() => router.push(`/dcs/${res.dcId}`), 1200);
    }
  }

  return (
    <form
      ref={containerRef as any}
      onKeyDown={handleKeyDown}
      onSubmit={handleSubmit}
      className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
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

      {/* SECTION: SUPPLIER MASTER */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3 border-b pb-1">Supplier Master</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier Name *</label>
            <select
              data-tally-id="supplier"
              value={selectedVendorId}
              onChange={(e) => setSelectedVendorId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              placeholder="Auto-populated snapshot"
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
              placeholder="Auto-populated snapshot"
            />
          </div>
        </div>
      </div>

      {/* SECTION: WO & PART MASTER */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3 border-b pb-1">WO & Part Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Department *</label>
            <select
              data-tally-id="department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="PRODUCTION">PRODUCTION</option>
              <option value="STORES">STORES</option>
              <option value="FOUNDRY">FOUNDRY</option>
              <option value="QUALITY">QUALITY</option>
              <option value="MACHINING">MACHINING</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">WO ID (Work Order) *</label>
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
            <input
              type="text"
              data-tally-id="partNumber"
              value={partNumber}
              onChange={(e) => setPartNumber(e.target.value)}
              placeholder="e.g. PN-9988"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
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

      {/* SECTION: QUANTITY & WEIGHT DETAILS */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3 border-b pb-1">Quantity & Weight Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Outward Qty RW</label>
            <input
              type="number"
              step="0.001"
              min="0"
              data-tally-id="outwardQtyRw"
              value={outwardQtyRw}
              onChange={(e) => setOutwardQtyRw(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.000"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Returning FG Qty</label>
            <input
              type="number"
              step="0.001"
              min="0"
              data-tally-id="returningFgQuantity"
              value={returningFgQuantity}
              onChange={(e) => setReturningFgQuantity(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.000"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Outward Weight (KG)</label>
            <input
              type="number"
              step="0.001"
              min="0"
              data-tally-id="outwardWeight"
              value={outwardWeight}
              onChange={(e) => setOutwardWeight(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.000"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Outward Gating Weight (KG)</label>
            <input
              type="number"
              step="0.001"
              min="0"
              data-tally-id="outwardGatingWeight"
              value={outwardGatingWeight}
              onChange={(e) => setOutwardGatingWeight(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.000"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Outward Boring Weight (KG)</label>
            <input
              type="number"
              step="0.001"
              min="0"
              data-tally-id="outwardBoringWeight"
              value={outwardBoringWeight}
              onChange={(e) => setOutwardBoringWeight(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.000"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Dimensions L (mm)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              data-tally-id="length"
              value={length}
              onChange={(e) => setLength(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Length"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Dimensions W (mm)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              data-tally-id="width"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Width"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Dimensions H (mm)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              data-tally-id="height"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Height"
            />
          </div>
        </div>
      </div>

      {/* SUBMIT BUTTON */}
      <div className="flex justify-end gap-3 border-t pt-4">
        <Button
          type="button"
          variant="secondary"
          data-tally-id="cancelBtn"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading}
          data-tally-id="submitBtn"
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating Outward DC...
            </span>
          ) : (
            "Submit Outward DC"
          )}
        </Button>
      </div>
    </form>
  );
}
