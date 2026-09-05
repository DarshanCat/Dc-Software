import { prisma } from "@/lib/db";
import { requireUser } from "@/server/session";
import { CreateDcForm } from "./create-dc-form";

export const dynamic = "force-dynamic";

export default async function NewDcPage() {
  await requireUser();

  const [vendors, items, departments, assets, tools] = await Promise.all([
    prisma.vendor.findMany({
      where: { active: true },
      select: {
        id: true,
        vendorCode: true,
        vendorName: true,
        address: true,
        gstNumber: true,
        city: true,
        state: true,
      },
      orderBy: { vendorName: "asc" },
    }),
    prisma.itemMaster.findMany({
      where: { active: true },
      select: {
        id: true,
        partNumber: true,
        partDescription: true,
        pricingBasis: true,
        ratePerQuantity: true,
        uom: true,
      },
      orderBy: { partNumber: "asc" },
    }),
    prisma.department.findMany({
      where: { active: true },
      select: {
        id: true,
        code: true,
        name: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.assetMaster.findMany({
      where: { active: true },
      select: {
        id: true,
        assetTag: true,
        assetName: true,
        category: true,
        serialNumber: true,
        department: true,
      },
      orderBy: { assetTag: "asc" },
    }),
    prisma.toolMaster.findMany({
      where: { active: true },
      select: {
        id: true,
        toolCode: true,
        toolName: true,
        category: true,
        specification: true,
        uom: true,
        instances: {
          where: { active: true },
          select: {
            id: true,
            serialNumber: true,
            currentStatus: true,
            location: true,
          },
        },
      },
      orderBy: { toolCode: "asc" },
    }),
  ]);

  const formattedItems = items.map((i) => ({
    id: i.id,
    itemCode: i.partNumber,
    itemName: i.partDescription,
    description: i.partDescription,
    pricingBasis: i.pricingBasis as "RW" | "FG",
    rate: i.ratePerQuantity ? Number(i.ratePerQuantity) : null,
    uom: i.uom,
  }));

  const formattedDepts = departments.map((d) => ({
    id: d.id,
    code: d.code,
    name: d.name,
  }));

  const formattedAssets = assets.map((a) => ({
    id: a.id,
    assetTag: a.assetTag,
    assetName: a.assetName,
    category: a.category,
    serialNumber: a.serialNumber,
    department: a.department,
  }));

  const formattedTools = tools.map((t) => ({
    id: t.id,
    toolCode: t.toolCode,
    toolName: t.toolName,
    category: t.category,
    specification: t.specification,
    uom: t.uom,
    instances: t.instances.map((ins) => ({
      id: ins.id,
      serialNumber: ins.serialNumber,
      currentStatus: ins.currentStatus,
      location: ins.location,
    })),
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Create Outward Delivery Challan</h1>
        <p className="text-sm text-slate-500">
          Security &amp; PPC Outgoing DC Creation form with master data auto-population and snapshot logging.
        </p>
      </div>

      <CreateDcForm
        vendors={vendors}
        items={formattedItems}
        departments={formattedDepts}
        assets={formattedAssets}
        tools={formattedTools}
      />
    </div>
  );
}