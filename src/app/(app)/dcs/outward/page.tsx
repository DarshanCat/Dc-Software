import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/session";
import { OutwardDcForm } from "./outward-form";

export const dynamic = "force-dynamic";

export default async function OutwardDcPage() {
  const user = await requireUser();
  const roleKeys = user.roleKeys || [];
  if (roleKeys.includes("SECURITY") && !roleKeys.some((r) => ["ADMIN", "STORES", "PRODUCTION", "MANAGEMENT"].includes(r))) {
    redirect("/security/dispatch");
  }


  const vendors = await prisma.vendor.findMany({
    where: { active: true },
    select: { id: true, vendorCode: true, vendorName: true, address: true, gstNumber: true, city: true, state: true },
    orderBy: { vendorName: "asc" },
  });

  const processes = await prisma.process.findMany({
    where: { active: true },
    select: { id: true, code: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Outgoing Delivery Challan</h1>
        <p className="text-sm text-slate-500">
          Prepare a new outward physical material movement challan for external processing or subcontracting.
        </p>
      </div>

      <OutwardDcForm vendors={vendors} processes={processes} />
    </div>
  );
}
