import type { Vendor } from "../lib/types.ts"

export const SEED_VENDORS: readonly Vendor[] = [
  {
    name: "Pennine Office Supplies Ltd",
    country: "United Kingdom",
    taxId: "GB987654321",
    accountNumber: "GB82WEST12345698765432",
  },
  {
    name: "Sundaram Steel Works Pvt Ltd",
    country: "India",
    taxId: "33AAACS9999M1Z7",
    accountNumber: "90400567890123",
  },
  {
    name: "Lakeview Print Co",
    country: "United States",
    taxId: "36-9876543",
    accountNumber: "000987654321",
  },
]

export function cloneSeedVendors(): Vendor[] {
  return SEED_VENDORS.map((vendor) => ({ ...vendor }))
}
