import { describe, it, expect } from "vitest";
import { formatDateDMY, formatDateTimeDMY, normalizeDateInput } from "./dateFormat";

describe("formatDateDMY", () => {
  it("returns '—' when date is null, undefined, or empty string", () => {
    expect(formatDateDMY(null)).toBe("—");
    expect(formatDateDMY(undefined)).toBe("—");
    expect(formatDateDMY("")).toBe("—");
    expect(formatDateDMY("   ")).toBe("—");
  });

  it("returns the same string if already formatted as DD-MM-AAAA", () => {
    expect(formatDateDMY("08-09-2026")).toBe("08-09-2026");
    expect(formatDateDMY("20-11-2026")).toBe("20-11-2026");
  });

  it("formats ISO date string YYYY-MM-DD correctly to DD-MM-AAAA", () => {
    expect(formatDateDMY("2026-09-08")).toBe("08-09-2026");
    expect(formatDateDMY("2026-09-08T15:30:00Z")).toBe("08-09-2026");
  });

  it("formats valid Date objects correctly", () => {
    const d = new Date(2026, 8, 8); // September 8, 2026
    expect(formatDateDMY(d)).toBe("08-09-2026");
  });

  it("handles non-ISO string dates using Date fallback or returning trimmed string", () => {
    expect(formatDateDMY("2026/09/08")).toBe("08-09-2026");
    expect(formatDateDMY("invalid-date-string")).toBe("invalid-date-string");
  });

  it("returns '—' for invalid Date object", () => {
    const invalidDate = new Date("invalid");
    expect(formatDateDMY(invalidDate)).toBe("—");
  });

  it("catches errors and returns '—' when processing throws an exception", () => {
    // Passing an object that throws when trimmed or converted in string checks
    const maliciousInput = {
      trim() {
        throw new Error("Unexpected error during string operation");
      },
    } as unknown as string;

    expect(formatDateDMY(maliciousInput)).toBe("—");
  });
});

describe("formatDateTimeDMY", () => {
  it("returns '—' when date is null or undefined", () => {
    expect(formatDateTimeDMY(null)).toBe("—");
    expect(formatDateTimeDMY(undefined)).toBe("—");
  });

  it("formats date and time string correctly", () => {
    const dateStr = "2026-09-08T12:34:56";
    const result = formatDateTimeDMY(dateStr, true);
    expect(result).toMatch(/^08-09-2026 12:34:56$/);
  });

  it("formats date and time without seconds when includeSeconds is false", () => {
    const dateStr = "2026-09-08T12:34:56";
    const result = formatDateTimeDMY(dateStr, false);
    expect(result).toMatch(/^08-09-2026 12:34$/);
  });
});

describe("normalizeDateInput", () => {
  it("returns null for null, undefined, or empty strings", () => {
    expect(normalizeDateInput(null)).toBeNull();
    expect(normalizeDateInput(undefined)).toBeNull();
    expect(normalizeDateInput("")).toBeNull();
    expect(normalizeDateInput("   ")).toBeNull();
  });

  it("returns YYYY-MM-DD unchanged if already in YYYY-MM-DD format", () => {
    expect(normalizeDateInput("2026-09-08")).toBe("2026-09-08");
  });

  it("converts DD-MM-AAAA or DD/MM/AAAA to YYYY-MM-DD format", () => {
    expect(normalizeDateInput("08-09-2026")).toBe("2026-09-08");
    expect(normalizeDateInput("08/09/2026")).toBe("2026-09-08");
  });

  it("returns null for unrecognized formats", () => {
    expect(normalizeDateInput("invalid")).toBeNull();
  });
});
