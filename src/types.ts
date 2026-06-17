export interface CLICommand {
  id: string;
  label: string;
  command: string;
  description: string;
}

export interface DataSheet {
  id: string;
  name: string;
  fileData: string; // uri/path or data
  fileType: string;
  size?: number;
}

export interface Product {
  id: string;
  name: string;
  model: string;
  image: string; // base64 data URI or url
  description: string;
  datasheets: DataSheet[];
  cliCommands: CLICommand[];
  notes: string;
  referenceLinks?: { id:string; title:string; url:string; notes?:string }[];
}

export interface Category {
  id: string;
  name: string; // e.g. "Switch", "Router"
  products: Product[];
}

export interface OEM {
  id: string;
  name: string;
  logo: string; // base64 data URI or url
  website: string;
  categories: Category[];
}

export interface AppData {
  oems: OEM[];
  favorites: string[]; // product ids
  version: string;
  exportedAt?: string;
}

// ── Bulk import (spreadsheet) ───────────────────────
// Flat row shapes parsed from the "Products" / "CLI Commands" / "Reference
// Links" tabs of the bulk-import template. OEM/Category/Product are matched
// by name (case-insensitive) and auto-created if they don't exist yet.

export interface BulkProductRow {
  oemName: string;
  oemWebsite?: string;
  category: string;
  productName: string;
  model?: string;
  description?: string;
  notes?: string;
  // Optional links to fetch and attach during import (see bulkImport.ts)
  oemLogoUrl?: string;
  imageUrl?: string;
  datasheetUrl?: string;
  datasheetName?: string;
  // Filled in by resolveBulkAssets() after downloading the above, before
  // the row reaches the store's merge logic.
  resolvedOemLogo?: string;
  resolvedImage?: string;
  resolvedDatasheet?: { name: string; fileData: string; fileType: string; size?: number };
}

export interface BulkCLIRow {
  oemName: string;
  category: string;
  productName: string;
  model?: string;
  label: string;
  command: string;
  description?: string;
}

export interface BulkLinkRow {
  oemName: string;
  category: string;
  productName: string;
  model?: string;
  title: string;
  url: string;
  notes?: string;
}

export interface ParsedBulkWorkbook {
  products: BulkProductRow[];
  cli: BulkCLIRow[];
  links: BulkLinkRow[];
  parseErrors: string[];
}

export interface BulkImportStats {
  oemsCreated: number;
  categoriesCreated: number;
  productsCreated: number;
  cliAdded: number;
  linksAdded: number;
  attachmentsAdded: number;
  errors: string[];
}
