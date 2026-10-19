import { describe, it, expect } from "vitest";
import {
  parseAmount,
  formatAmount,
  monthRange,
  isRealDate,
  shiftMonth,
  addDays,
} from "./money";

describe("parseAmount", () => {
  it("converts to minor units without float errors", () => {
    expect(parseAmount("250")).toBe(25000);
    expect(parseAmount("99.5")).toBe(9950);
    expect(parseAmount("0.07")).toBe(7);
    expect(parseAmount("19.99")).toBe(1999);
  });
  it("rejects invalid input", () => {
    for (const bad of [
      "0",
      "0.00",
      "-5",
      "abc",
      "1.234",
      "",
      " ",
      "1,000",
      "1e3",
    ])
      expect(parseAmount(bad)).toBeNull();
  });
});

describe("formatAmount", () => {
  it("formats BDT with two decimals", () => {
    expect(formatAmount(1234567)).toBe("৳12,345.67");
    expect(formatAmount(5)).toBe("৳0.05");
  });
});

describe("monthRange", () => {
  it("handles year boundary", () => {
    expect(monthRange("2026-12")).toEqual({
      from: "2026-12-01",
      to: "2027-01-01",
    });
  });
  it("handles February in leap and non-leap years", () => {
    expect(monthRange("2028-02").to).toBe("2028-03-01");
    expect(monthRange("2027-02").to).toBe("2027-03-01");
  });
});

describe("isRealDate", () => {
  it("accepts real dates, rejects impossible ones", () => {
    expect(isRealDate("2028-02-29")).toBe(true);
    expect(isRealDate("2027-02-29")).toBe(false);
    expect(isRealDate("2026-13-01")).toBe(false);
    expect(isRealDate("2026-1-1")).toBe(false);
  });
});

describe("shiftMonth / addDays", () => {
  it("crosses year boundaries", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});
