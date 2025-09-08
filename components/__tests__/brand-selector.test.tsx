import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrandSelector } from "../brand-selector";

// Mock the brand context
vi.mock("@/lib/contexts/brand-context", () => ({
  useBrand: vi.fn(() => ({
    currentBrand: "1921",
    setCurrentBrand: vi.fn(),
    availableBrands: ["1921", "爸爸糖", "满杯椰", "十盏灯"],
    isLoaded: true,
  })),
}));

// Mock the brand storage utility
vi.mock("@/lib/utils/brand-storage", () => ({
  getBrandHistory: vi.fn(() => Promise.resolve(["1921", "爸爸糖"])),
}));

// Mock the select components
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select" data-value={value}>
      {children}
      <button onClick={() => onValueChange?.("爸爸糖")} data-testid="change-brand">
        Change Brand
      </button>
    </div>
  ),
  SelectTrigger: ({ children }: any) => <button data-testid="select-trigger">{children}</button>,
  SelectValue: ({ placeholder }: any) => (
    <span data-testid="select-value">{placeholder || "1921"}</span>
  ),
  SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value }: any) => (
    <div data-testid={`select-item-${value}`}>{children}</div>
  ),
}));

describe("BrandSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with current brand", () => {
    render(<BrandSelector />);

    const select = screen.getByTestId("select");
    expect(select).toHaveAttribute("data-value", "1921");
  });

  it("displays placeholder text", () => {
    render(<BrandSelector />);

    const selectValue = screen.getByTestId("select-value");
    expect(selectValue).toBeInTheDocument();
  });

  it("calls setCurrentBrand when brand is changed", async () => {
    const { useBrand } = await import("@/lib/contexts/brand-context");
    const mockSetCurrentBrand = vi.fn();

    vi.mocked(useBrand).mockReturnValue({
      currentBrand: "1921",
      setCurrentBrand: mockSetCurrentBrand,
      availableBrands: ["1921", "爸爸糖", "满杯椰", "十盏灯"],
      isLoaded: true,
      brandData: null,
      isConfigLoaded: true,
    });

    render(<BrandSelector />);

    const changeButton = screen.getByTestId("change-brand");
    await userEvent.click(changeButton);

    expect(mockSetCurrentBrand).toHaveBeenCalledWith("爸爸糖");
  });

  it("loads brand history when showHistory is true", async () => {
    const { getBrandHistory } = await import("@/lib/utils/brand-storage");

    render(<BrandSelector showHistory={true} />);

    await waitFor(() => {
      expect(getBrandHistory).toHaveBeenCalled();
    });
  });

  it("does not load brand history when showHistory is false", async () => {
    const { getBrandHistory } = await import("@/lib/utils/brand-storage");

    render(<BrandSelector showHistory={false} />);

    expect(getBrandHistory).not.toHaveBeenCalled();
  });
});
