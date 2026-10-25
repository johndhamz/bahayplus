import { describe, expect, it } from "vitest";
import {
  add,
  allocateEvenly,
  applyBasisPoints,
  compare,
  formatPeso,
  formatPesoCompact,
  money,
  MoneyError,
  parsePesoInput,
  subtract,
} from "@bahayplus/types/money";

describe("money", () => {
  it("only accepts safe integer centavos", () => {
    expect(() => money(10.5)).toThrow(MoneyError);
    expect(() => money(Number.MAX_SAFE_INTEGER + 1)).toThrow(MoneyError);
    expect(money(100).currency).toBe("PHP");
  });

  it("adds and subtracts without float drift", () => {
    // 0.1 + 0.2 in pesos must be exactly 0.30
    expect(add(money(10), money(20)).amountCentavos).toBe(30);
    expect(subtract(money(100), money(250)).amountCentavos).toBe(-150);
    expect(compare(money(1), money(2))).toBe(-1);
  });

  it("parses peso input strings exactly", () => {
    expect(parsePesoInput("1,234.5")?.amountCentavos).toBe(123_450);
    expect(parsePesoInput("₱99")?.amountCentavos).toBe(9_900);
    expect(parsePesoInput("PHP 10.05")?.amountCentavos).toBe(1_005);
    expect(parsePesoInput("0.1")?.amountCentavos).toBe(10);
    expect(parsePesoInput("-5.00")?.amountCentavos).toBe(-500);
  });

  it("rejects malformed amounts", () => {
    for (const bad of ["", "abc", "1.234", "1,23", "12,34.00", "1e3", "₱", "10.", "USD 5"]) {
      expect(parsePesoInput(bad), bad).toBeNull();
    }
  });

  it("formats as Philippine pesos", () => {
    expect(formatPeso(money(123_450))).toBe("₱1,234.50");
    expect(formatPeso(5)).toBe("₱0.05");
    expect(formatPeso(-150)).toBe("-₱1.50");
    expect(formatPeso(100_000_000_00)).toBe("₱100,000,000.00");
  });

  it("formats compact axis labels", () => {
    expect(formatPesoCompact(95_000)).toBe("₱950");
    expect(formatPesoCompact(150_000)).toBe("₱1.5K");
    expect(formatPesoCompact(1_234_500)).toBe("₱12K");
    expect(formatPesoCompact(240_000_000)).toBe("₱2.4M");
    expect(formatPesoCompact(0)).toBe("₱0");
  });

  it("applies basis points with half-away-from-zero rounding", () => {
    expect(applyBasisPoints(money(10_000), 1_000).amountCentavos).toBe(1_000); // 10% of ₱100
    expect(applyBasisPoints(money(105), 5_000).amountCentavos).toBe(53); // 52.5 → 53
    expect(applyBasisPoints(money(-105), 5_000).amountCentavos).toBe(-53);
    expect(applyBasisPoints(money(999_999_999_999), 1).amountCentavos).toBe(100_000_000);
  });

  it("allocates evenly with no lost centavos", () => {
    const parts = allocateEvenly(money(10_000), 3).map((m) => m.amountCentavos);
    expect(parts).toEqual([3_334, 3_333, 3_333]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(10_000);
    expect(allocateEvenly(money(-10), 3).map((m) => m.amountCentavos)).toEqual([-4, -3, -3]);
    expect(() => allocateEvenly(money(1), 0)).toThrow(MoneyError);
  });
});
