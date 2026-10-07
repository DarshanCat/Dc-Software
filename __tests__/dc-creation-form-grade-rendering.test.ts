import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// These forms are "use client" components that call useRouter() and the real
// server actions at module scope; stub both so the component can be rendered
// in a plain Node environment without a Next.js app-router context or a live DB.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("../src/server/dcs/actions", () => ({ createDc: vi.fn() }));
vi.mock("../src/server/dcs/extended-actions", () => ({ createOutwardDc: vi.fn() }));

function findTag(html: string, attrMatch: string): string {
  const re = new RegExp(`<[a-z]+[^>]*${attrMatch}[^>]*>`, "i");
  const match = html.match(re);
  expect(match, `expected to find an element matching ${attrMatch} in rendered HTML`).not.toBeNull();
  return match![0];
}

describe("Material DC creation UI — Material Grade field is rendered (Section 2)", () => {
  it("CreateDcForm (/dcs/new) shows a required, visible Material Grade input by default (movementType defaults to MATERIAL)", async () => {
    const { CreateDcForm } = await import("../src/app/(app)/dcs/new/create-dc-form");
    const html = renderToStaticMarkup(
      React.createElement(CreateDcForm, { vendors: [], items: [], departments: [], assets: [], tools: [] })
    );

    expect(html).toContain("Material Grade");
    const gradeInput = findTag(html, 'data-tally-id="materialGrade"');
    expect(gradeInput).toContain("required");

    // Dimensions must remain alongside Grade in the creation form (not removed/split out).
    expect(findTag(html, 'data-tally-id="length"')).toContain("required");
    expect(findTag(html, 'data-tally-id="width"')).toContain("required");
    expect(findTag(html, 'data-tally-id="height"')).toContain("required");
    expect(findTag(html, 'data-tally-id="outwardWeight"')).toContain("required");
  });

  it("OutwardDcForm (/dcs/outward) shows a required, visible Material Grade input", async () => {
    const { OutwardDcForm } = await import("../src/app/(app)/dcs/outward/outward-form");
    const html = renderToStaticMarkup(React.createElement(OutwardDcForm, { vendors: [], processes: [] }));

    expect(html).toContain("Material Grade");
    const gradeInput = findTag(html, 'data-tally-id="materialGrade"');
    expect(gradeInput).toContain("required");
  });
});
