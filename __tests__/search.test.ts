import { describe, it, expect } from "vitest";

function getSearchConfig(pathname: string): { isVisible: boolean; placeholder: string; targetUrl: string } {
  if (
    pathname === "/dcs" ||
    pathname === "/dashboard/open" ||
    pathname === "/dashboard/overdue" ||
    pathname === "/dashboard/material-outside" ||
    pathname === "/dashboard/scrap-outstanding" ||
    pathname === "/dashboard/exceptions" ||
    pathname === "/search"
  ) {
    return { isVisible: true, placeholder: "Search DC number or WO ID...", targetUrl: "/search" };
  } else if (pathname === "/masters/vendors") {
    return { isVisible: true, placeholder: "Search vendor name or code...", targetUrl: "/masters/vendors" };
  } else if (pathname === "/masters/items") {
    return { isVisible: true, placeholder: "Search item code or name...", targetUrl: "/masters/items" };
  } else if (pathname === "/admin/users") {
    return { isVisible: true, placeholder: "Search name, email or ID...", targetUrl: "/admin/users" };
  }

  return { isVisible: false, placeholder: "", targetUrl: "" };
}

describe("Context-Aware Search Bar Logic", () => {
  it("shows DC search bar with placeholder on DC list, open, overdue, material-outside, scrap-outstanding, exceptions, search", () => {
    const pages = ["/dcs", "/dashboard/open", "/dashboard/overdue", "/dashboard/material-outside", "/dashboard/scrap-outstanding", "/dashboard/exceptions", "/search"];
    for (const page of pages) {
      const config = getSearchConfig(page);
      expect(config.isVisible).toBe(true);
      expect(config.placeholder).toBe("Search DC number or WO ID...");
    }
  });

  it("shows vendor search bar on /masters/vendors", () => {
    const config = getSearchConfig("/masters/vendors");
    expect(config.isVisible).toBe(true);
    expect(config.placeholder).toBe("Search vendor name or code...");
  });

  it("shows item search bar on /masters/items", () => {
    const config = getSearchConfig("/masters/items");
    expect(config.isVisible).toBe(true);
    expect(config.placeholder).toBe("Search item code or name...");
  });

  it("shows user search bar on /admin/users", () => {
    const config = getSearchConfig("/admin/users");
    expect(config.isVisible).toBe(true);
    expect(config.placeholder).toBe("Search name, email or ID...");
  });

  it("hides global search bar on Dashboard, DC Detail, Create DC, Reports, and Settings", () => {
    const pages = ["/", "/dashboard", "/dcs/new", "/dcs/dc-12345", "/reports/dc-register", "/reports/ageing", "/admin/settings", "/change-password"];
    for (const page of pages) {
      const config = getSearchConfig(page);
      expect(config.isVisible).toBe(false);
    }
  });
});
