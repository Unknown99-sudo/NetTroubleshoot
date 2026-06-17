import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { BulkProductRow, BulkCLIRow, BulkLinkRow, ParsedBulkWorkbook } from '../types';
import { downloadImageAsDataUri, downloadDatasheetFile } from './assetDownload';

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '');

// header label -> field name, per sheet
const PRODUCTS_FIELD_MAP: Record<string, string> = {
  [norm('OEM Name')]: 'oemName',
  [norm('OEM Website')]: 'oemWebsite',
  [norm('OEM Logo URL')]: 'oemLogoUrl',
  [norm('Category')]: 'category',
  [norm('Product Name')]: 'productName',
  [norm('Model Number')]: 'model',
  [norm('Model')]: 'model',
  [norm('Description')]: 'description',
  [norm('Notes')]: 'notes',
  [norm('Product Image URL')]: 'imageUrl',
  [norm('Image URL')]: 'imageUrl',
  [norm('Datasheet URL')]: 'datasheetUrl',
  [norm('Datasheet Name')]: 'datasheetName',
};

const CLI_FIELD_MAP: Record<string, string> = {
  [norm('OEM Name')]: 'oemName',
  [norm('Category')]: 'category',
  [norm('Product Name')]: 'productName',
  [norm('Model Number')]: 'model',
  [norm('Model')]: 'model',
  [norm('CLI Label')]: 'label',
  [norm('Label')]: 'label',
  [norm('Command')]: 'command',
  [norm('Commands')]: 'command',
  [norm('Description')]: 'description',
};

const LINKS_FIELD_MAP: Record<string, string> = {
  [norm('OEM Name')]: 'oemName',
  [norm('Category')]: 'category',
  [norm('Product Name')]: 'productName',
  [norm('Model Number')]: 'model',
  [norm('Model')]: 'model',
  [norm('Link Title')]: 'title',
  [norm('Title')]: 'title',
  [norm('URL')]: 'url',
  [norm('Link')]: 'url',
  [norm('Notes')]: 'notes',
};

function getCell(row: Record<string, any>, map: Record<string, string>, field: string): string {
  for (const key of Object.keys(row)) {
    if (map[norm(key)] === field) {
      const v = row[key];
      return v === undefined || v === null ? '' : String(v).trim();
    }
  }
  return '';
}

function findSheetName(wb: XLSX.WorkBook, candidates: string[]): string | undefined {
  return wb.SheetNames.find(n => candidates.some(c => norm(c) === norm(n)));
}

function parseWorkbook(wb: XLSX.WorkBook): ParsedBulkWorkbook {
  const parseErrors: string[] = [];
  const products: BulkProductRow[] = [];
  const cli: BulkCLIRow[] = [];
  const links: BulkLinkRow[] = [];

  const productsSheetName = findSheetName(wb, ['Products']);
  if (productsSheetName) {
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[productsSheetName], { defval: '' });
    rows.forEach((row, idx) => {
      const oemName = getCell(row, PRODUCTS_FIELD_MAP, 'oemName');
      const category = getCell(row, PRODUCTS_FIELD_MAP, 'category');
      const productName = getCell(row, PRODUCTS_FIELD_MAP, 'productName');
      if (!oemName && !category && !productName) return; // fully blank row, skip silently
      if (!oemName || !category || !productName) {
        parseErrors.push(`Products row ${idx + 2}: missing OEM Name, Category, or Product Name — skipped.`);
        return;
      }
      products.push({
        oemName, category, productName,
        oemWebsite: getCell(row, PRODUCTS_FIELD_MAP, 'oemWebsite'),
        model: getCell(row, PRODUCTS_FIELD_MAP, 'model'),
        description: getCell(row, PRODUCTS_FIELD_MAP, 'description'),
        notes: getCell(row, PRODUCTS_FIELD_MAP, 'notes'),
        oemLogoUrl: getCell(row, PRODUCTS_FIELD_MAP, 'oemLogoUrl'),
        imageUrl: getCell(row, PRODUCTS_FIELD_MAP, 'imageUrl'),
        datasheetUrl: getCell(row, PRODUCTS_FIELD_MAP, 'datasheetUrl'),
        datasheetName: getCell(row, PRODUCTS_FIELD_MAP, 'datasheetName'),
      });
    });
  }

  const cliSheetName = findSheetName(wb, ['CLI Commands', 'CLI', 'Commands']);
  if (cliSheetName) {
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[cliSheetName], { defval: '' });
    rows.forEach((row, idx) => {
      const oemName = getCell(row, CLI_FIELD_MAP, 'oemName');
      const category = getCell(row, CLI_FIELD_MAP, 'category');
      const productName = getCell(row, CLI_FIELD_MAP, 'productName');
      const label = getCell(row, CLI_FIELD_MAP, 'label');
      const command = getCell(row, CLI_FIELD_MAP, 'command');
      if (!oemName && !category && !productName && !label && !command) return;
      if (!oemName || !category || !productName || !label || !command) {
        parseErrors.push(`CLI Commands row ${idx + 2}: missing OEM Name, Category, Product Name, Label, or Command — skipped.`);
        return;
      }
      cli.push({
        oemName, category, productName, label, command,
        model: getCell(row, CLI_FIELD_MAP, 'model'),
        description: getCell(row, CLI_FIELD_MAP, 'description'),
      });
    });
  }

  const linksSheetName = findSheetName(wb, ['Reference Links', 'Links']);
  if (linksSheetName) {
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[linksSheetName], { defval: '' });
    rows.forEach((row, idx) => {
      const oemName = getCell(row, LINKS_FIELD_MAP, 'oemName');
      const category = getCell(row, LINKS_FIELD_MAP, 'category');
      const productName = getCell(row, LINKS_FIELD_MAP, 'productName');
      const title = getCell(row, LINKS_FIELD_MAP, 'title');
      const url = getCell(row, LINKS_FIELD_MAP, 'url');
      if (!oemName && !category && !productName && !title && !url) return;
      if (!oemName || !category || !productName || !title || !url) {
        parseErrors.push(`Reference Links row ${idx + 2}: missing OEM Name, Category, Product Name, Title, or URL — skipped.`);
        return;
      }
      links.push({
        oemName, category, productName, title, url,
        model: getCell(row, LINKS_FIELD_MAP, 'model'),
        notes: getCell(row, LINKS_FIELD_MAP, 'notes'),
      });
    });
  }

  if (!productsSheetName && !cliSheetName && !linksSheetName) {
    parseErrors.push('No recognizable tabs found. Expected sheets named "Products", "CLI Commands", and/or "Reference Links" — make sure you used the downloaded template.');
  }

  return { products, cli, links, parseErrors };
}

/**
 * Downloads any OEM Logo URL / Product Image URL / Datasheet URL values
 * found in the parsed Products rows and attaches the resolved data
 * (base64 data URIs for images, local file URIs for datasheets) onto each
 * row as resolvedOemLogo / resolvedImage / resolvedDatasheet, so the
 * synchronous store merge never has to touch the network itself.
 * Best-effort: a failed download just skips that one asset and adds a
 * note to parseErrors rather than failing the whole import.
 */
export async function resolveBulkAssets(
  parsed: ParsedBulkWorkbook,
  onProgress?: (done: number, total: number) => void
): Promise<ParsedBulkWorkbook> {
  const oemLogoUrlByName = new Map<string, string>();
  for (const row of parsed.products) {
    const key = norm(row.oemName);
    if (row.oemLogoUrl && !oemLogoUrlByName.has(key)) {
      oemLogoUrlByName.set(key, row.oemLogoUrl);
    }
  }

  const rowsWithImage = parsed.products.filter(r => !!r.imageUrl);
  const rowsWithDatasheet = parsed.products.filter(r => !!r.datasheetUrl);
  const total = oemLogoUrlByName.size + rowsWithImage.length + rowsWithDatasheet.length;
  let done = 0;
  const tick = () => { done++; onProgress?.(done, total); };

  if (total === 0) return parsed;

  const oemLogoDataByName = new Map<string, string>();
  for (const [key, url] of oemLogoUrlByName) {
    const dataUri = await downloadImageAsDataUri(url);
    if (dataUri) {
      oemLogoDataByName.set(key, dataUri);
    } else {
      parsed.parseErrors.push(`Could not download OEM logo from ${url} — skipped, OEM was still created/updated without it.`);
    }
    tick();
  }
  for (const row of parsed.products) {
    const logo = oemLogoDataByName.get(norm(row.oemName));
    if (logo) row.resolvedOemLogo = logo;
  }

  for (const row of rowsWithImage) {
    const dataUri = await downloadImageAsDataUri(row.imageUrl!);
    if (dataUri) {
      row.resolvedImage = dataUri;
    } else {
      // Fall back to storing the raw URL — the Image component can still
      // render a remote http(s) link directly, it just needs network access.
      row.resolvedImage = row.imageUrl;
      parsed.parseErrors.push(`Could not download the product photo for "${row.productName}" — stored the link instead, which needs internet to display.`);
    }
    tick();
  }

  for (const row of rowsWithDatasheet) {
    const file = await downloadDatasheetFile(row.datasheetUrl!, row.datasheetName);
    if (file) {
      row.resolvedDatasheet = file;
    } else {
      parsed.parseErrors.push(`Could not download the datasheet for "${row.productName}" from ${row.datasheetUrl} — add it manually in the app instead.`);
    }
    tick();
  }

  return parsed;
}

/**
 * Opens the native document picker so the user can select a filled-in
 * .xlsx bulk-import file, reads it as base64, parses it into the three
 * flat row arrays the store knows how to merge, and downloads any
 * OEM logo / product image / datasheet URLs included in the sheet.
 */
export async function pickBulkImportFile(
  onAssetProgress?: (done: number, total: number) => void
): Promise<{ success: boolean; data?: ParsedBulkWorkbook; message?: string }> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        '*/*',
      ],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled) return { success: false, message: 'cancelled' };

    const asset = result.assets?.[0];
    if (!asset) return { success: false, message: 'No file selected.' };

    const base64 = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const wb = XLSX.read(base64, { type: 'base64' });
    const data = parseWorkbook(wb);

    if (data.products.length === 0 && data.cli.length === 0 && data.links.length === 0 && data.parseErrors.length === 0) {
      return { success: false, message: 'The file has no data rows to import. Fill in at least the "Products" tab and try again.' };
    }

    await resolveBulkAssets(data, onAssetProgress);

    return { success: true, data };
  } catch (e: any) {
    console.error('Bulk import read failed', e);
    return { success: false, message: e?.message || 'Could not read the selected file. Make sure it is a valid .xlsx file.' };
  }
}
