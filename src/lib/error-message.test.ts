import { describe, expect, it } from "vitest";
import { localizeErrorMessage } from "@/lib/error-message";

describe("localizeErrorMessage", () => {
  it("maps known database error codes to localized messages", () => {
    expect(localizeErrorMessage("DB_PROJECT_NOT_FOUND", "en")).toBe(
      "Project not found.",
    );
    expect(localizeErrorMessage("DB_PROJECT_NOT_FOUND", "th")).toBe(
      "ไม่พบโปรเจกต์",
    );
  });

  it("localizes restore-blocked reasons with reason mapping", () => {
    const localized = localizeErrorMessage(
      "DB_RESTORE_BLOCKED:2 pending outbox change(s) and 1 open conflict(s)",
      "th",
    );
    expect(localized).toContain("การกู้คืนถูกบล็อก");
    expect(localized).toContain("2 การเปลี่ยนแปลงคิวขาออกที่รออยู่");
    expect(localized).toContain("1 คอนฟลิกต์ที่เปิดอยู่");
  });

  it("maps E2E transport status errors with parameterized messages", () => {
    expect(localizeErrorMessage("E2E_TRANSPORT_REQUEST_FAILED:503", "en")).toBe(
      "E2E transport request failed (503).",
    );
  });

  it("falls back to original message when no mapping exists", () => {
    expect(localizeErrorMessage("custom.error.value", "en")).toBe(
      "custom.error.value",
    );
  });
});
