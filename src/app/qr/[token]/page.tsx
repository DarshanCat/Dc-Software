import { loadDcPdfDataByToken } from "@/server/dcs/pdf";

export const dynamic = "force-dynamic";

export const metadata = { title: "Delivery Challan" };

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">{label}</p>
      <p className="text-xs font-semibold text-slate-900">{value || "—"}</p>
    </div>
  );
}

export default async function QrScanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await loadDcPdfDataByToken(token);

  if (!data) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center bg-slate-50 p-6">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-base font-semibold text-slate-900">Invalid QR code</h1>
          <p className="mt-1 text-sm text-slate-500">
            This code does not match any delivery challan.
          </p>
        </div>
      </main>
    );
  }

  const contactLine = [data.company.gst ? "GSTIN: " + data.company.gst : "", data.company.contact]
    .filter(Boolean)
    .join("  |  ");

  const infoPairs: [string, string][] = [
    ["DC Date", data.dcDate],
    ["Work Order No.", data.woNumber],
    ["Vendor Name", data.vendorName],
    ["Process", data.processName],
    ["Purpose", data.purpose],
    ["Expected Return", data.expectedReturnDate],
    ["Vehicle No.", data.vehicleNumber],
    ["Transporter", data.transporter],
    ["E-Way Bill", data.ewayBillNumber],
    ["Vendor Address", data.vendorAddress],
  ];

  return (
    <main className="mx-auto min-h-screen max-w-lg bg-slate-100 pb-24 print:max-w-none print:bg-white print:pb-0">
      {/* Action bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur print:hidden">
        <span className="font-mono text-sm font-bold text-slate-900">{data.dcNumber}</span>
        <a
          href={`/qr/${encodeURIComponent(token)}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white active:bg-slate-800"
        >
          Download PDF
        </a>
      </div>

      {/* Challan document */}
      <article
        className="mx-auto mt-4 bg-white px-6 py-6 shadow-sm print:mt-0 print:shadow-none"
        style={{ fontFamily: "Helvetica, Arial, sans-serif" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-900 pb-3">
          <div className="flex items-start gap-3">
            {data.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.logo} alt={`${data.company.name} logo`} className="h-12 w-auto max-w-[80px] object-contain" />
            )}
            <div>
              <h1 className="text-base font-bold text-slate-900 uppercase tracking-tight">{data.company.name}</h1>
              {data.company.address && (
                <p className="mt-0.5 text-[11px] text-slate-600">{data.company.address}</p>
              )}
              {contactLine && (
                <p className="mt-0.5 text-[11px] text-slate-500">{contactLine}</p>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">DC No.</p>
            <p className="text-sm font-bold text-slate-900 font-mono">{data.dcNumber}</p>
            <span className="mt-1 inline-block rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
              {data.status}
            </span>
          </div>
        </div>

        <p className="mt-3 text-center text-sm font-bold tracking-widest text-slate-900 uppercase">
          DELIVERY CHALLAN
        </p>

        {/* Info grid */}
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
          {infoPairs.map(([label, value]) => (
            <Field key={label} label={label} value={value} />
          ))}
        </div>

        {/* Material Details Section */}
        <div className="mt-4 rounded-lg border border-slate-200 overflow-hidden">
          <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
            Material Details
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2">Part Number</th>
                <th className="px-3 py-2">RM Qty (Raw Mat.)</th>
                <th className="px-3 py-2">Return FG Qty (Expected)</th>
                <th className="px-3 py-2">Heat Number</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="px-3 py-2.5 font-bold font-mono text-slate-900">{data.partNumber}</td>
                <td className="px-3 py-2.5 font-bold font-mono text-slate-900">{data.rmQuantity}</td>
                <td className="px-3 py-2.5 font-bold font-mono text-slate-900">{data.returnFgQuantity}</td>
                <td className="px-3 py-2.5 font-bold font-mono text-slate-900">{data.heatNumber}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Remarks */}
        <div className="mt-4 rounded-lg border border-slate-200 p-3 bg-white">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Remarks / Instructions</p>
          <p className="mt-1 text-xs text-slate-800 whitespace-pre-wrap">{data.remarks?.trim() || "NIL"}</p>
        </div>

        {/* Terms */}
        <p className="mt-4 text-[10px] leading-relaxed text-slate-400 border-t border-slate-100 pt-2">
          Terms: Material listed above is sent for job work only and remains the property of{" "}
          {data.company.name}. The receiving party is responsible for safe custody and timely return
          of the material and any finished goods / scrap generated, as per agreed terms.
        </p>

        {/* Signatures */}
        <div className="mt-8 grid grid-cols-4 gap-2 pt-2 border-t border-slate-200">
          {(
            [
              { label: "Prepared By", name: data.preparedByName },
              { label: "Approved By", name: data.approvedByName },
              { label: "Receiver Sign", name: null },
              { label: "Auth. Sign", name: null },
            ] as const
          ).map(({ label, name }) => (
            <div key={label} className="text-center">
              <p className="h-4 text-[10px] font-bold text-slate-900 truncate">{name ?? ""}</p>
              <div className="border-t border-slate-300 mt-1 pt-1" />
              <p className="text-[9px] font-semibold text-slate-500 uppercase">{label}</p>
            </div>
          ))}
        </div>
      </article>

      <p className="mt-3 text-center text-[10px] text-slate-400 print:hidden">
        Scanned from the QR printed on challan {data.dcNumber}
      </p>
    </main>
  );
}
