import { describe, it, expect } from "vitest";
import { hasNumericCoordinates } from "@/lib/utils/coordinates";

describe("hasNumericCoordinates", () => {
  it("returns true for valid non-zero coordinates", () => {
    expect(hasNumericCoordinates({ lat: 31.23, lng: 121.47 })).toBe(true);
  });

  it("returns false when both are zero (null island)", () => {
    expect(hasNumericCoordinates({ lat: 0, lng: 0 })).toBe(false);
  });

  it("returns true when only one dimension is zero", () => {
    expect(hasNumericCoordinates({ lat: 0, lng: 121 })).toBe(true);
    expect(hasNumericCoordinates({ lat: 31, lng: 0 })).toBe(true);
  });

  it("returns false for null/undefined input", () => {
    expect(hasNumericCoordinates(null)).toBe(false);
    expect(hasNumericCoordinates(undefined)).toBe(false);
  });

  it("returns false for non-numeric values", () => {
    expect(hasNumericCoordinates({ lat: "31" as unknown, lng: 121 })).toBe(false);
    expect(hasNumericCoordinates({ lat: NaN, lng: 121 })).toBe(false);
    expect(hasNumericCoordinates({ lat: Infinity, lng: 121 })).toBe(false);
  });

  it("returns false for missing fields", () => {
    expect(hasNumericCoordinates({ lat: 31 })).toBe(false);
    expect(hasNumericCoordinates({})).toBe(false);
  });
});
