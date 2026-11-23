import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  OMS_DC_ORDER_BY,
  OMS_DC_SELECT,
  OMS_MAX_ROWS,
  buildOmsDcResponse,
  buildOmsDcWhere,
  isValidOmsToken,
  parseOpenOnly,
  parseWoNumbers,
} from "@/services/oms-integration.service";

/**
 * GET /api/integrations/oms/dcs
 *
 * Read-only, server-to-server endpoint for the OMS app. Authenticated with the shared
 * secret in the `x-oms-token` header (env OMS_INTEGRATION_TOKEN), not a user session;
 * src/middleware.ts lets /api/integrations/* through so this handler does its own auth.
 * The token is never logged.
 *
 * Query: woNumber (repeatable and/or comma-separated, max 200), openOnly (default true).
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const expected = process.env.OMS_INTEGRATION_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "OMS integration not configured" }, { status: 503 });
  }
  if (!isValidOmsToken(req.headers.get("x-oms-token"), expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const woNumbers = parseWoNumbers(params.getAll("woNumber"));
  const openOnly = parseOpenOnly(params.get("openOnly"));

  try {
    const rows = await prisma.deliveryChallan.findMany({
      where: buildOmsDcWhere({ woNumbers, openOnly }),
      select: OMS_DC_SELECT,
      orderBy: OMS_DC_ORDER_BY,
      take: OMS_MAX_ROWS,
    });
    return NextResponse.json(buildOmsDcResponse(rows), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    console.error("[oms-integration] failed to load DCs");
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
