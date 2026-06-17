import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const PRODUCTS_HEADERS = ['OEM Name', 'OEM Website', 'OEM Logo URL', 'Category', 'Product Name', 'Model Number', 'Description', 'Notes', 'Product Image URL', 'Datasheet URL', 'Datasheet Name'];
const CLI_HEADERS = ['OEM Name', 'Category', 'Product Name', 'Model Number', 'CLI Label', 'Command', 'Description'];
const LINKS_HEADERS = ['OEM Name', 'Category', 'Product Name', 'Model Number', 'Link Title', 'URL', 'Notes'];

function sheetFromRows(headers: string[], rows: (string | number)[][]) {
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  // Give columns a sane default width so the template isn't a wall of '###'
  (sheet as any)['!cols'] = headers.map(h => ({ wch: Math.max(16, h.length + 4) }));
  return sheet;
}

/**
 * Builds a multi-tab .xlsx workbook (Instructions, Products, CLI Commands,
 * Reference Links) pre-filled with one example row per data tab, writes it
 * to a temp file, and opens the native share sheet so the user can save it.
 */
export async function downloadBulkTemplate(): Promise<{ success: boolean; message: string }> {
  try {
    const wb = XLSX.utils.book_new();

    const instructions = XLSX.utils.aoa_to_sheet([
      ['NetTrouble — Bulk Import Template'],
      [''],
      ['How to use this file'],
      ['1. Fill in the "Products" tab — one row per product. OEM Name, Category, and Product Name are required.'],
      ['2. (Optional) Fill in the "CLI Commands" tab — one row per command. Re-type the same OEM Name / Category / Product Name / Model Number you used on the Products tab so the app knows which product it belongs to.'],
      ['3. (Optional) Fill in the "Reference Links" tab the same way for articles or links.'],
      ['4. Delete the example row (row 2) on each tab, or just overwrite it with your own data.'],
      ['5. Save the file, then in the app go to Settings > Bulk Import > Upload Filled Template.'],
      [''],
      ['Adding logos, photos & datasheets'],
      ['Excel files can\'t carry actual image/PDF files in a way this app can map row-by-row, so instead use a direct link:'],
      ['- OEM Logo URL: a direct link to the OEM\'s logo image (png/jpg). Only needs to be filled once per OEM — first one found is used.'],
      ['- Product Image URL: a direct link to a photo of that specific product.'],
      ['- Datasheet URL: a direct link to the product\'s PDF datasheet. "Datasheet Name" is optional — leave blank to use the filename from the link.'],
      ['The app downloads these during import so logos/photos work offline afterward; datasheets are saved to the device but still need internet to fetch at import time.'],
      ['Links must point directly to the file (not a webpage that previews it). Google Drive / Dropbox "share" links usually need to be converted to a direct-download link first.'],
      ['If a link fails to download, that one row just skips the attachment — the OEM/product is still created normally, and you\'ll see which ones failed in the import summary.'],
      [''],
      ['Notes'],
      ['- If an OEM, Category, or Product does not exist yet in the app, it is created automatically.'],
      ['- If it already exists (matched by name, not case-sensitive), new CLI commands / links get added to it instead of creating a duplicate.'],
      ['- Model Number can be left blank. Only fill it in if you have two products with the same name under the same OEM/Category and need to tell them apart.'],
    ]);
    (instructions as any)['!cols'] = [{ wch: 100 }];
    XLSX.utils.book_append_sheet(wb, instructions, 'Instructions');

    const productsSheet = sheetFromRows(PRODUCTS_HEADERS, [
      ['Cisco', 'https://www.cisco.com', '', 'Switch', 'Catalyst 9300', 'C9300-24P-A', '24-port PoE+ access switch', 'Common in branch wiring closets', '', '', ''],
    ]);
    XLSX.utils.book_append_sheet(wb, productsSheet, 'Products');

    const cliSheet = sheetFromRows(CLI_HEADERS, [
      ['Cisco', 'Switch', 'Catalyst 9300', 'C9300-24P-A', 'Show interface status', 'show interfaces status', 'Lists port status, speed and duplex'],
    ]);
    XLSX.utils.book_append_sheet(wb, cliSheet, 'CLI Commands');

    const linksSheet = sheetFromRows(LINKS_HEADERS, [
      ['Cisco', 'Switch', 'Catalyst 9300', 'C9300-24P-A', 'Official Datasheet', 'https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9300-series-switches/nb-06-cat9300-ser-data-sheet-cte-en.html', ''],
    ]);
    XLSX.utils.book_append_sheet(wb, linksSheet, 'Reference Links');

    const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const fileUri = `${FileSystem.cacheDirectory}NetTrouble_Bulk_Import_Template.xlsx`;
    await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Save Bulk Import Template',
        UTI: 'org.openxmlformats.spreadsheetml.sheet',
      });
      return { success: true, message: 'Template ready — choose where to save it.' };
    }
    return { success: true, message: `Saved to ${fileUri}` };
  } catch (e: any) {
    console.error('Template export failed', e);
    return { success: false, message: e?.message || 'Failed to create the template.' };
  }
}
