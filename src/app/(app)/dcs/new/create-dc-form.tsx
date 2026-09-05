"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createDc, CreateDcInput } from "@/server/dcs/actions";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle, Plus, Trash2 } from "lucide-react";
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

interface AssetOption {
  id: string;
  assetTag: string;
  assetName: string;
  category: string | null;
  serialNumber: string | null;
  department: string | null;
}

interface ToolOption {
  id: string;
  toolCode: string;
  toolName: string;
  category: string | null;
  specification: string | null;
  uom: string;
  instances: Array<{
    id: string;
    serialNumber: string;
    currentStatus: string;
    location: string | null;
  }>;
}

interface Props {
  vendors: VendorOption[];
  items?: ItemOption[];
  departments?: DepartmentOption[];
  assets?: AssetOption[];
  tools?: ToolOption[];
}

interface LineItemState {
  itemCode: string;
  itemDescription: string;
  quantity: string;
  uom: string;
  conditionIn: string;
  toolInstanceId?: string;
  assetMasterId?: string;
}

export function CreateDcForm({ vendors, items = [], departments = [], assets = [], tools = [] }: Props) {
  const router = useRouter();
  const { containerRef, handleKeyDown } = useTallyNavigation({
    onValidationError: (_el, msg) => setError(msg),
  });

  // DC Category Selection State
  const [movementType, setMovementType] = useState<"MATERIAL" | "TOOL" | "COMPANY_PROPERTY">("MATERIAL");
  const [isCommercialService, setIsCommercialService] = useState(false);
  const [destinationDepartment, setDestinationDepartment] = useState("");
  const [responsibleCustodian, setResponsibleCustodian] = useState("");
  const [returnRequired, setReturnRequired] = useState(true);
  const [expectedReturnDate, setExpectedReturnDate] = useState("");
  const [purpose, setPurpose] = useState<
    "JOB_WORK" | "MACHINING" | "HEAT_TREATMENT" | "SURFACE_TREATMENT" | "REPAIR" | "SAMPLE" | "TRIAL" | "SUBCONTRACTING" | "OTHER"
  >("JOB_WORK");

  // Document Info
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [documentDate, setDocumentDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [department, setDepartment] = useState("PRODUCTION");
  const [preparedByName, setPreparedByName] = useState("");

  // Material fields
  const [woNumber, setWoNumber] = useState("");
  const [selectedPartId, setSelectedPartId] = useState("");
  const [customPartNumber, setCustomPartNumber] = useState("");
  const [partDescription, setPartDescription] = useState("");
  const [heatNumber, setHeatNumber] = useState("");
  const [outwardQtyRw, setOutwardQtyRw] = useState("");
  const [returningFgQuantity, setReturningFgQuantity] = useState("");

  // Pricing fields
  const [pricingBasis, setPricingBasis] = useState<"RM" | "FG">("RM");
  const [ratePerQuantity, setRatePerQuantity] = useState("");
  const [remarks, setRemarks] = useState("");

  // Line items for Tools / Company Property
  const [lineItems, setLineItems] = useState<LineItemState[]>([
    { itemCode: "", itemDescription: "", quantity: "1", uom: "NOS", conditionIn: "GOOD" },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedVendor = vendors.find((v) => v.id === selectedVendorId);

  function handleMovementTypeChange(type: "MATERIAL" | "TOOL" | "COMPANY_PROPERTY") {
    setMovementType(type);
    setError(null);
    if (type === "MATERIAL") {
      setPurpose("JOB_WORK");
      setIsCommercialService(true);
    } else if (type === "TOOL") {
      setPurpose("REPAIR");
      setIsCommercialService(false);
    } else {
      setPurpose("OTHER");
      setIsCommercialService(false);
    }
  }

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

  function handleAssetSelect(index: number, assetId: string) {
    if (!assetId) return;
    const selectedAsset = assets.find((a) => a.id === assetId);
    if (!selectedAsset) return;

    const updated = [...lineItems];
    updated[index] = {
      ...updated[index],
      itemCode: selectedAsset.assetTag,
      itemDescription: `${selectedAsset.assetName}${selectedAsset.serialNumber ? ` (SN: ${selectedAsset.serialNumber})` : ""}`,
      assetMasterId: selectedAsset.id,
      quantity: "1",
      uom: "NOS",
    };
    setLineItems(updated);
  }

  function handleToolSelect(index: number, toolId: string) {
    if (!toolId) return;
    const selectedTool = tools.find((t) => t.id === toolId);
    if (!selectedTool) return;

    const updated = [...lineItems];
    updated[index] = {
      ...updated[index],
      itemCode: selectedTool.toolCode,
      itemDescription: `${selectedTool.toolName}${selectedTool.specification ? ` - ${selectedTool.specification}` : ""}`,
      uom: selectedTool.uom || "NOS",
      quantity: "1",
    };
    setLineItems(updated);
  }

  function handleToolInstanceSelect(index: number, instanceId: string, tool: ToolOption) {
    const instance = tool.instances.find((ins) => ins.id === instanceId);
    const updated = [...lineItems];
    if (instance) {
      updated[index] = {
        ...updated[index],
        toolInstanceId: instance.id,
        itemDescription: `${tool.toolName} (SN: ${instance.serialNumber})`,
      };
    } else {
      updated[index] = {
        ...updated[index],
        toolInstanceId: undefined,
        itemDescription: tool.toolName,
      };
    }
    setLineItems(updated);
  }

  function addLineItem() {
    setLineItems([...lineItems, { itemCode: "", itemDescription: "", quantity: "1", uom: "NOS", conditionIn: "GOOD" }]);
  }

  function removeLineItem(index: number) {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  }

  function updateLineItem(index: number, field: keyof LineItemState, value: string) {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  }

  const activePricingQty = pricingBasis === "RM" ? Number(outwardQtyRw || 0) : Number(returningFgQuantity || 0);
  const calculatedAmount = (activePricingQty * Number(ratePerQuantity || 0)).toFixed(2);

  async function handleSubmit(submitForApproval: boolean) {
    setError(null);
    setSuccess(null);

    if (!preparedByName.trim()) return setError("Prepared By Name is required.");

    const partNum = customPartNumber.trim() || (items.find((i) => i.id === selectedPartId)?.itemCode || "");

    if (movementType === "MATERIAL") {
      if (!selectedVendorId) return setError("Supplier (Vendor) is mandatory for Material DCs.");
      if (!woNumber.trim()) return setError("WO ID (Work Order) is mandatory for Material DCs.");
      if (!partNum) return setError("Part Number is mandatory for Material DCs.");
      if (!heatNumber.trim()) return setError("Heat Number is mandatory for Material DCs.");
      if (!outwardQtyRw || Number(outwardQtyRw) <= 0) return setError("Outward Qty RM must be > 0 for Material DCs.");
      if (!returningFgQuantity || Number(returningFgQuantity) <= 0) return setError("Returning FG Qty must be > 0 for Material DCs.");
      if (!pricingBasis) return setError("Please select a pricing basis for Material DCs.");
      const rateVal = parseFloat(ratePerQuantity);
      if (isNaN(rateVal) || rateVal <= 0) return setError("Rate Per Quantity must be greater than zero for Material DCs.");
    } else {
      // TOOL or COMPANY_PROPERTY
      if (!destinationDepartment.trim()) return setError("Destination Department is required.");
      if (!responsibleCustodian.trim()) return setError("Responsible Custodian is required.");
      if (isCommercialService && !selectedVendorId) return setError("Supplier / Vendor is required for Commercial Service DCs.");

      const validItems = lineItems.filter((item) => item.itemDescription.trim() !== "");
      if (validItems.length === 0) return setError("At least one item with a valid description is required.");
    }

    setLoading(true);

    const payloadItems = movementType !== "MATERIAL"
      ? lineItems
          .filter((item) => item.itemDescription.trim() !== "")
          .map((item) => ({
            itemCode: item.itemCode.trim() || undefined,
            itemDescription: item.itemDescription.trim(),
            quantity: Number(item.quantity || "1"),
            uom: item.uom.trim() || "NOS",
            conditionIn: item.conditionIn.trim() || undefined,
            toolInstanceId: item.toolInstanceId || undefined,
            assetMasterId: item.assetMasterId || undefined,
          }))
      : undefined;

    const payload: CreateDcInput = {
      movementType,
      isCommercialService: movementType === "MATERIAL" ? true : isCommercialService,
      destinationDepartment: movementType !== "MATERIAL" ? destinationDepartment.trim() : undefined,
      responsibleCustodian: movementType !== "MATERIAL" ? responsibleCustodian.trim() : undefined,
      vendorId: (movementType === "MATERIAL" || isCommercialService) ? selectedVendorId : undefined,
      woNumber: movementType === "MATERIAL" ? woNumber.trim() : undefined,
      partNumber: movementType === "MATERIAL" ? partNum : undefined,
      rmQuantity: movementType === "MATERIAL" && outwardQtyRw ? parseFloat(outwardQtyRw) : undefined,
      returnFgQuantity: movementType === "MATERIAL" && returningFgQuantity ? parseFloat(returningFgQuantity) : undefined,
      heatNumber: movementType === "MATERIAL" ? heatNumber.trim() : undefined,
      pricingBasis: movementType === "MATERIAL" ? pricingBasis : undefined,
      ratePerQuantity: (movementType === "MATERIAL" || isCommercialService) && ratePerQuantity ? parseFloat(ratePerQuantity) : undefined,
      preparedByName: preparedByName.trim(),
      purpose: movementType === "MATERIAL" ? "JOB_WORK" : (purpose || "OTHER"),
      expectedReturnDate: (movementType !== "MATERIAL" && returnRequired && expectedReturnDate) ? expectedReturnDate : undefined,
      remarks: remarks.trim() || undefined,
      items: payloadItems,
    };

    const res = await createDc(payload);
    setLoading(false);

    if (!res.ok) {
      setError(res.error || "An error occurred while creating Delivery Challan.");
    } else {
      setSuccess(`DC ${res.dcNumber} created as DRAFT (${movementType}) successfully.`);
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
        {/* SECTION 0: DC MOVEMENT CATEGORY SELECTION */}
        <div className="rounded-lg border-2 border-slate-900 bg-slate-900 text-white p-6 shadow-md space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-300 border-b border-slate-700 pb-2">
            Section 0: Delivery Challan Movement Category *
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label
              className={`flex items-center gap-3 rounded-lg border-2 p-4 cursor-pointer transition-all ${
                movementType === "MATERIAL"
                  ? "bg-blue-600 border-white text-white shadow-lg"
                  : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <input
                type="radio"
                name="movementType"
                value="MATERIAL"
                checked={movementType === "MATERIAL"}
                onChange={() => handleMovementTypeChange("MATERIAL")}
                className="h-4 w-4 text-blue-600"
              />
              <div>
                <span className="block font-bold text-sm">A. MATERIAL / JOB WORK</span>
                <span className="text-[11px] opacity-80 block mt-0.5">
                  RM / FG, Heat No, Vendor Approval &amp; Quality Workflow
                </span>
              </div>
            </label>

            <label
              className={`flex items-center gap-3 rounded-lg border-2 p-4 cursor-pointer transition-all ${
                movementType === "TOOL"
                  ? "bg-indigo-600 border-white text-white shadow-lg"
                  : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <input
                type="radio"
                name="movementType"
                value="TOOL"
                checked={movementType === "TOOL"}
                onChange={() => handleMovementTypeChange("TOOL")}
                className="h-4 w-4 text-indigo-600"
              />
              <div>
                <span className="block font-bold text-sm">B. TOOLS MOVEMENT</span>
                <span className="text-[11px] opacity-80 block mt-0.5">
                  Fixtures, Dies, Patterns, Gauges &amp; Repair Custody Flow
                </span>
              </div>
            </label>

            <label
              className={`flex items-center gap-3 rounded-lg border-2 p-4 cursor-pointer transition-all ${
                movementType === "COMPANY_PROPERTY"
                  ? "bg-teal-600 border-white text-white shadow-lg"
                  : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <input
                type="radio"
                name="movementType"
                value="COMPANY_PROPERTY"
                checked={movementType === "COMPANY_PROPERTY"}
                onChange={() => handleMovementTypeChange("COMPANY_PROPERTY")}
                className="h-4 w-4 text-teal-600"
              />
              <div>
                <span className="block font-bold text-sm">C. COMPANY PROPERTY</span>
                <span className="text-[11px] opacity-80 block mt-0.5">
                  Assets, Instruments, Equipment &amp; Internal Custody
                </span>
              </div>
            </label>
          </div>

          {movementType !== "MATERIAL" && (
            <div className="pt-2 border-t border-slate-800 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-amber-300">
                <input
                  type="checkbox"
                  checked={isCommercialService}
                  onChange={(e) => setIsCommercialService(e.target.checked)}
                  className="h-4 w-4 rounded text-amber-500"
                />
                <span>Is this a Commercial Paid Service / Repair? (Requires External Vendor &amp; Payment Approval)</span>
              </label>
            </div>
          )}
        </div>

        {/* SECTION 1: DC INFORMATION */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700 border-b pb-2">
            Section 1: Delivery Challan Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date of Creating DC *</label>
              <input
                type="date"
                data-tally-id="dcDate"
                value={documentDate}
                onChange={(e) => setDocumentDate(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Origin Department *</label>
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
                    <option value="TOOLING">TOOLING</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Prepared By Name *</label>
              <input
                type="text"
                value={preparedByName}
                onChange={(e) => setPreparedByName(e.target.value)}
                placeholder="Employee / User name"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* OTHER DC CUSTODY FIELDS */}
          {movementType !== "MATERIAL" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Destination Department *</label>
                <input
                  type="text"
                  value={destinationDepartment}
                  onChange={(e) => setDestinationDepartment(e.target.value)}
                  placeholder="e.g. Maintenance / Tooling / Unit 2"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Responsible Custodian *</label>
                <input
                  type="text"
                  value={responsibleCustodian}
                  onChange={(e) => setResponsibleCustodian(e.target.value)}
                  placeholder="Custodian employee name"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Movement Purpose</label>
                <select
                  value={purpose}
                  onChange={(e: any) => setPurpose(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="REPAIR">REPAIR</option>
                  <option value="SUBCONTRACTING">SUBCONTRACTING</option>
                  <option value="SAMPLE">SAMPLE / DEMO</option>
                  <option value="TRIAL">TRIAL</option>
                  <option value="OTHER">OTHER CUSTODY MOVEMENT</option>
                </select>
              </div>

              <div className="md:col-span-3 flex flex-col sm:flex-row items-start sm:items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={returnRequired}
                    onChange={(e) => setReturnRequired(e.target.checked)}
                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Return Required (Item expected to return to company)</span>
                </label>

                {returnRequired && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Expected Return Date:</label>
                    <input
                      type="date"
                      value={expectedReturnDate}
                      onChange={(e) => setExpectedReturnDate(e.target.value)}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VENDOR SELECTION (ONLY FOR MATERIAL OR COMMERCIAL SERVICES) */}
          {(movementType === "MATERIAL" || isCommercialService) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Supplier / Vendor <span className="text-red-600">*</span>
                </label>
                <select
                  data-tally-id="supplier"
                  value={selectedVendorId}
                  onChange={(e) => handleVendorChange(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  required
                >
                  <option value="">-- Select Supplier / Vendor --</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vendorName} ({v.vendorCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Supplier Address (Snapshot)</label>
                <input
                  type="text"
                  readOnly
                  data-tally-skip="true"
                  value={selectedVendor ? selectedVendor.address || `${selectedVendor.city || ""}, ${selectedVendor.state || ""}` : ""}
                  className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 focus:outline-none"
                  placeholder="Snapshot from Master Data"
                />
              </div>
            </div>
          )}
        </div>

        {/* SECTION 2: MATERIAL & WORK ORDER (FOR MATERIAL DCs ONLY) */}
        {movementType === "MATERIAL" && (
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700 border-b pb-2">
              Section 2: Material &amp; Work Order Specification
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Heat Number *</label>
                <input
                  type="text"
                  value={heatNumber}
                  onChange={(e) => setHeatNumber(e.target.value)}
                  placeholder="e.g. HT-2026-X"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Outward Qty RM (NOS) *</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={outwardQtyRw}
                  onChange={(e) => setOutwardQtyRw(e.target.value)}
                  placeholder="Raw material quantity sent"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Expected Return FG Qty (NOS) *</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={returningFgQuantity}
                  onChange={(e) => setReturningFgQuantity(e.target.value)}
                  placeholder="Finished goods expected back"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2B: LINE ITEMS (FOR OTHER DCs: COMPANY PROPERTY & TOOLS) */}
        {movementType !== "MATERIAL" && (
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
                Section 2: {movementType === "COMPANY_PROPERTY" ? "Company Property Items" : "Tool Items"}
              </h2>
              <Button type="button" variant="secondary" onClick={addLineItem} className="text-xs flex items-center gap-1">
                <Plus className="h-3.5 w-3.5" /> Add Item Row
              </Button>
            </div>

            <div className="space-y-4">
              {lineItems.map((item, idx) => (
                <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                  {/* MASTER SELECTOR (ASSET OR TOOL) IF AVAILABLE */}
                  {movementType === "COMPANY_PROPERTY" && assets.length > 0 && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Select Asset from AssetMaster (Optional Auto-Fill)
                      </label>
                      <select
                        value={item.assetMasterId || ""}
                        onChange={(e) => handleAssetSelect(idx, e.target.value)}
                        className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Select Asset from Master Data --</option>
                        {assets.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.assetTag} - {a.assetName} {a.serialNumber ? `(SN: ${a.serialNumber})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {movementType === "TOOL" && tools.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                          Select Tool from ToolMaster
                        </label>
                        <select
                          value={tools.find((t) => t.toolCode === item.itemCode)?.id || ""}
                          onChange={(e) => handleToolSelect(idx, e.target.value)}
                          className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">-- Select Tool --</option>
                          {tools.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.toolCode} - {t.toolName}
                            </option>
                          ))}
                        </select>
                      </div>

                      {tools.find((t) => t.toolCode === item.itemCode)?.instances.length ? (
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Select Serial Number / Instance
                          </label>
                          <select
                            value={item.toolInstanceId || ""}
                            onChange={(e) =>
                              handleToolInstanceSelect(
                                idx,
                                e.target.value,
                                tools.find((t) => t.toolCode === item.itemCode)!
                              )
                            }
                            className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
                          >
                            <option value="">-- Select Instance --</option>
                            {tools
                              .find((t) => t.toolCode === item.itemCode)!
                              .instances.map((ins) => (
                                <option key={ins.id} value={ins.id}>
                                  SN: {ins.serialNumber} ({ins.currentStatus})
                                </option>
                              ))}
                          </select>
                        </div>
                      ) : null}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Item Code / Tag</label>
                      <input
                        type="text"
                        value={item.itemCode}
                        onChange={(e) => updateLineItem(idx, "itemCode", e.target.value)}
                        placeholder="e.g. AST-001 / TL-99"
                        className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                      />
                    </div>

                    <div className="sm:col-span-4">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Description *</label>
                      <input
                        type="text"
                        value={item.itemDescription}
                        onChange={(e) => updateLineItem(idx, "itemDescription", e.target.value)}
                        placeholder="Asset or Tool description"
                        className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
                        required
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Current Condition</label>
                      <select
                        value={item.conditionIn}
                        onChange={(e) => updateLineItem(idx, "conditionIn", e.target.value)}
                        className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"
                      >
                        <option value="GOOD">GOOD</option>
                        <option value="REPAIR_REQUIRED">REPAIR REQUIRED</option>
                        <option value="CALIBRATION_DUE">CALIBRATION DUE</option>
                        <option value="DAMAGED">DAMAGED</option>
                        <option value="SCRAP">SCRAP</option>
                      </select>
                    </div>

                    <div className="sm:col-span-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Qty *</label>
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(idx, "quantity", e.target.value)}
                        className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono"
                        required
                      />
                    </div>

                    <div className="sm:col-span-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">UOM</label>
                      <input
                        type="text"
                        value={item.uom}
                        onChange={(e) => updateLineItem(idx, "uom", e.target.value)}
                        className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs uppercase"
                      />
                    </div>

                    <div className="sm:col-span-1 flex justify-end">
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLineItem(idx)}
                          className="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50"
                          title="Remove Row"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 6: PRICING & COMMERCIAL (MATERIAL OR COMMERCIAL SERVICES) */}
        {(movementType === "MATERIAL" || isCommercialService) && (
          <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-blue-950 border-b border-blue-200 pb-2">
              Section 6: Pricing &amp; Commercial Terms
            </h2>

            {movementType === "MATERIAL" && (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wide">
                  PRICE BASED ON <span className="text-red-600">*</span>
                </label>
                <div className="flex flex-col sm:flex-row gap-4 pt-1">
                  <label className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${pricingBasis === "RM" ? "bg-blue-100/70 border-blue-600 text-blue-950 font-bold" : "bg-white border-slate-300 text-slate-700"}`}>
                    <input
                      type="radio"
                      name="pricingBasis"
                      value="RM"
                      checked={pricingBasis === "RM"}
                      onChange={() => setPricingBasis("RM")}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="text-xs">
                      <span className="block font-semibold">RM QUANTITY</span>
                      <span className="text-[11px] opacity-80">Calculated using Outward Qty RM ({outwardQtyRw || 0} NOS)</span>
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
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rate Per Quantity (₹) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={ratePerQuantity}
                  onChange={(e) => setRatePerQuantity(e.target.value)}
                  placeholder="Rate per unit"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  required
                />
              </div>

              {movementType === "MATERIAL" && (
                <div className="rounded-lg bg-white p-3 border border-slate-200 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Calculated Commercial Output</span>
                  <div className="text-xs space-y-0.5 font-sans">
                    <p className="text-slate-600">
                      Pricing Basis: <span className="font-bold text-slate-900">{pricingBasis === "RM" ? "RM Quantity" : "Returning FG Quantity"}</span>
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
              )}
            </div>
          </div>
        )}

        {/* SECTION 7: REMARKS */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700 border-b pb-2">
            Section 7: Remarks &amp; Instructions
          </h2>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks / Notes</label>
            <input
              type="text"
              data-tally-id="remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Movement purpose, return instructions, or transport notes"
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
            disabled={loading}
            data-tally-id="saveDraftBtn"
            onClick={() => handleSubmit(false)}
            className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white font-semibold px-6"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving DC...
              </span>
            ) : (
              `CREATE ${movementType} DC`
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}