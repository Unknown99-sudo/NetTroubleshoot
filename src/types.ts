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
