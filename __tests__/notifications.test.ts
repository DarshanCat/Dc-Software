import { describe, it, expect } from "vitest";
import { getNotificationTargetUrl } from "../src/server/notifications/service";

describe("Notification Target Navigation Resolution", () => {
  it("resolves DC notification target URL from entityId", () => {
    const target = getNotificationTargetUrl({
      entityType: "DeliveryChallan",
      entityId: "dc-uuid-12345",
    });
    expect(target).toBe("/dcs/dc-uuid-12345");
  });

  it("resolves case-insensitive entityType for DeliveryChallan", () => {
    const target = getNotificationTargetUrl({
      entityType: "DELIVERY_CHALLAN",
      entityId: "dc-uuid-67890",
    });
    expect(target).toBe("/dcs/dc-uuid-67890");
  });

  it("resolves registration request notification target URL", () => {
    const target = getNotificationTargetUrl({
      entityType: "RegistrationRequest",
      entityId: "req-uuid-9999",
    });
    expect(target).toBe("/admin/users/requests");
  });

  it("resolves custom targetUrl when explicitly provided", () => {
    const target = getNotificationTargetUrl({
      entityType: "DeliveryChallan",
      entityId: "dc-uuid-12345",
      targetUrl: "/admin/users/requests",
    });
    expect(target).toBe("/admin/users/requests");
  });

  it("returns null when no structured entity information is available", () => {
    const target = getNotificationTargetUrl({
      entityType: null,
      entityId: null,
    });
    expect(target).toBeNull();
  });
});
