import { loadDcPdfDataByToken } from "@/server/dcs/pdf";

export const dynamic = "force-dynamic";

export const metadata = { title: "Delivery Challan" };

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-900">{value || "-"}</p>
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

  const contactLine = [data.company.gst ? "GST: " + data.company.gst : "", data.company.contact]
    .filter(Boolean)
    .join("  |  ");

  const infoPairs: [string, string][] = [
    ["Date", data.dcDate],
    ["Vendor", data.vendorName],
    ["Purpose", data.purpose],
    ["Process", data.processName],
    ["Expected Return", data.expectedReturnDate],
    ["Vehicle No.", data.vehicleNumber],
    ["Transporter", data.transporter],
    ["E-Way Bill", data.ewayBillNumber],
    ["Reference No.", data.referenceNumber],
    ["Vendor Address", data.vendorAddress],
  ];

  return (
    <main className="mx-auto min-h-screen max-w-md bg-slate-100 pb-24 print:max-w-none print:bg-white print:pb-0">
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
        className="mx-auto mt-4 bg-white px-5 py-6 shadow-sm print:mt-0 print:shadow-none"
        style={{ fontFamily: "'Times New Roman', Times, serif" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {data.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.logo} alt={`${data.company.name} logo`} className="h-12 w-auto max-w-[80px] object-contain" />
            )}
            <h1 className="text-lg font-bold text-slate-900">{data.company.name}</h1>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-wide text-slate-400">DC No.</p>
            <p className="text-sm font-bold text-slate-900">{data.dcNumber}</p>
          </div>
        </div>
        {data.company.address && (
          <p className="mt-0.5 text-[11px] text-slate-500">{data.company.address}</p>
        )}
        <div className="mt-0.5 flex items-start justify-between gap-3">
          {contactLine ? (
            <p className="text-[11px] text-slate-500">{contactLine}</p>
          ) : <span />}
          <p className="shrink-0 text-[11px] text-slate-500">{data.status}</p>
        </div>

        <p className="mt-4 text-center text-sm font-bold tracking-wide text-slate-900">DELIVERY CHALLAN</p>
        <hr className="mt-2 border-slate-300" />

        {/* Info grid */}
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
          {infoPairs.map(([label, value]) => (
            <Field key={label} label={label} value={value} />
          ))}
        </div>

        <hr className="mt-4 border-slate-300" />

        {/* Items */}
        <table className="mt-3 w-full text-[11px]">
          <thead>
            <tr className="border-b border-slate-300 text-left text-[9px] uppercase tracking-wide text-slate-500">
              <th className="py-1 pr-1 font-semibold">Sl</th>
              <th className="py-1 pr-1 font-semibold">Item Code</th>
              <th className="py-1 pr-1 font-semibold">Description</th>
              <th className="py-1 pr-1 font-semibold">Drawing</th>
              <th className="py-1 pr-1 text-right font-semibold">Qty</th>
              <th className="py-1 pr-1 font-semibold">UOM</th>
              <th className="py-1 text-right font-semibold">Weight (kg)</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((it) => (
              <tr key={it.slNo} className="border-b border-slate-200 text-slate-800">
                <td className="py-1.5 pr-1">{it.slNo}</td>
                <td className="py-1.5 pr-1 font-medium">{it.itemCode}</td>
                <td className="py-1.5 pr-1">{it.description}</td>
                <td className="py-1.5 pr-1">{it.drawingNumber}</td>
                <td className="py-1.5 pr-1 text-right">{it.quantity}</td>
                <td className="py-1.5 pr-1">{it.uom}</td>
                <td className="py-1.5 text-right">{it.weight}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Terms */}
        <p className="mt-4 text-[10px] leading-relaxed text-slate-400">
          Terms: Material listed above is sent for job work only and remains the property of{" "}
          {data.company.name}. The receiving party is responsible for the safe custody and timely
          return of the material and any finished goods / scrap generated, as per the agreed job
          work terms.
        </p>

        {/* Signatures */}
        <div className="mt-10 grid grid-cols-3 gap-4">
          {(
            [
              { label: "Prepared By", name: data.preparedByName },
              { label: "Approved By", name: data.approvedByName },
              { label: "Authorized Signature", name: null },
            ] as const
          ).map(({ label, name }) => (
            <div key={label}>
              <p className="h-5 text-[11px] font-semibold text-slate-900">{name ?? ""}</p>
              <div className="border-t border-slate-300 pt-1" />
              <p className="mt-0.5 text-[10px] text-slate-500">{label}</p>
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
