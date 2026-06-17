import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppData, OEM, Category, Product, CLICommand, DataSheet,
  BulkProductRow, BulkCLIRow, BulkLinkRow, BulkImportStats,
} from './types';

const STORAGE_KEY = 'nettrouble_data';
const uuidv4 = () => `${Date.now()}_${Math.random().toString(36).slice(2,10)}`;

const defaultData: AppData = {
  oems: [],
  favorites: [],
  version: '1.0.0',
};

// Singleton state management via custom hook
let _data: AppData = defaultData;
let _loaded = false;
const _listeners: Array<() => void> = [];

function notify() {
  _listeners.forEach(fn => fn());
}

async function saveData(data: AppData) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore write errors
  }
}

async function loadData(): Promise<AppData> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore parse/read errors
  }
  return defaultData;
}

export function useAppStore() {
  const [, forceUpdate] = useState(0);
  const [ready, setReady] = useState(_loaded);

  useEffect(() => {
    const fn = () => forceUpdate(n => n + 1);
    _listeners.push(fn);

    if (!_loaded) {
      loadData().then(data => {
        _data = data;
        _loaded = true;
        setReady(true);
        notify();
      });
    }

    return () => {
      const idx = _listeners.indexOf(fn);
      if (idx > -1) _listeners.splice(idx, 1);
    };
  }, []);

  // ── OEM ──────────────────────────────────────────
  const addOEM = (name: string, logo: string, website: string) => {
    const oem: OEM = { id: uuidv4(), name, logo, website, categories: [] };
    _data = { ..._data, oems: [..._data.oems, oem] };
    saveData(_data);
    notify();
    return oem;
  };

  const updateOEM = (id: string, patch: Partial<OEM>) => {
    _data = {
      ..._data,
      oems: _data.oems.map(o => (o.id === id ? { ...o, ...patch } : o)),
    };
    saveData(_data);
    notify();
  };

  const deleteOEM = (id: string) => {
    _data = { ..._data, oems: _data.oems.filter(o => o.id !== id) };
    saveData(_data);
    notify();
  };

  // ── Category ─────────────────────────────────────
  const addCategory = (oemId: string, name: string) => {
    const cat: Category = { id: uuidv4(), name, products: [] };
    _data = {
      ..._data,
      oems: _data.oems.map(o =>
        o.id === oemId ? { ...o, categories: [...o.categories, cat] } : o
      ),
    };
    saveData(_data);
    notify();
    return cat;
  };

  const updateCategory = (oemId: string, catId: string, patch: Partial<Category>) => {
    _data = {
      ..._data,
      oems: _data.oems.map(o =>
        o.id === oemId
          ? {
              ...o,
              categories: o.categories.map(c =>
                c.id === catId ? { ...c, ...patch } : c
              ),
            }
          : o
      ),
    };
    saveData(_data);
    notify();
  };

  const deleteCategory = (oemId: string, catId: string) => {
    _data = {
      ..._data,
      oems: _data.oems.map(o =>
        o.id === oemId
          ? { ...o, categories: o.categories.filter(c => c.id !== catId) }
          : o
      ),
    };
    saveData(_data);
    notify();
  };

  // ── Product ───────────────────────────────────────
  const addProduct = (
    oemId: string,
    catId: string,
    data: { name: string; model: string; image: string; description: string; notes: string }
  ) => {
    const prod: Product = {
      id: uuidv4(),
      ...data,
      datasheets: [],
      cliCommands: [],
    };
    _data = {
      ..._data,
      oems: _data.oems.map(o =>
        o.id === oemId
          ? {
              ...o,
              categories: o.categories.map(c =>
                c.id === catId ? { ...c, products: [...c.products, prod] } : c
              ),
            }
          : o
      ),
    };
    saveData(_data);
    notify();
    return prod;
  };

  const updateProduct = (oemId: string, catId: string, prodId: string, patch: Partial<Product>) => {
    _data = {
      ..._data,
      oems: _data.oems.map(o =>
        o.id === oemId
          ? {
              ...o,
              categories: o.categories.map(c =>
                c.id === catId
                  ? {
                      ...c,
                      products: c.products.map(p =>
                        p.id === prodId ? { ...p, ...patch } : p
                      ),
                    }
                  : c
              ),
            }
          : o
      ),
    };
    saveData(_data);
    notify();
  };

  const deleteProduct = (oemId: string, catId: string, prodId: string) => {
    _data = {
      ..._data,
      oems: _data.oems.map(o =>
        o.id === oemId
          ? {
              ...o,
              categories: o.categories.map(c =>
                c.id === catId
                  ? { ...c, products: c.products.filter(p => p.id !== prodId) }
                  : c
              ),
            }
          : o
      ),
      favorites: _data.favorites.filter(f => f !== prodId),
    };
    saveData(_data);
    notify();
  };

  // ── Datasheet ─────────────────────────────────────
  const addDatasheet = (
    oemId: string, catId: string, prodId: string, ds: Omit<DataSheet, 'id'>
  ) => {
    const sheet: DataSheet = { id: uuidv4(), ...ds };
    const prod = getProduct(oemId, catId, prodId);
    if (!prod) return;
    updateProduct(oemId, catId, prodId, { datasheets: [...prod.datasheets, sheet] });
  };

  const deleteDatasheet = (oemId: string, catId: string, prodId: string, dsId: string) => {
    const prod = getProduct(oemId, catId, prodId);
    if (!prod) return;
    updateProduct(oemId, catId, prodId, { datasheets: prod.datasheets.filter(d => d.id !== dsId) });
  };

  // ── CLI Commands ──────────────────────────────────
  const addCLICommand = (
    oemId: string, catId: string, prodId: string, cmd: Omit<CLICommand, 'id'>
  ) => {
    const cli: CLICommand = { id: uuidv4(), ...cmd };
    const prod = getProduct(oemId, catId, prodId);
    if (!prod) return;
    updateProduct(oemId, catId, prodId, { cliCommands: [...prod.cliCommands, cli] });
  };

  const updateCLICommand = (
    oemId: string, catId: string, prodId: string, cmdId: string, patch: Partial<CLICommand>
  ) => {
    const prod = getProduct(oemId, catId, prodId);
    if (!prod) return;
    updateProduct(oemId, catId, prodId, {
      cliCommands: prod.cliCommands.map(c => (c.id === cmdId ? { ...c, ...patch } : c)),
    });
  };

  const deleteCLICommand = (
    oemId: string, catId: string, prodId: string, cmdId: string
  ) => {
    const prod = getProduct(oemId, catId, prodId);
    if (!prod) return;
    updateProduct(oemId, catId, prodId, {
      cliCommands: prod.cliCommands.filter(c => c.id !== cmdId),
    });
  };

  // ── Favorites ─────────────────────────────────────
  const toggleFavorite = (prodId: string) => {
    const favs = _data.favorites.includes(prodId)
      ? _data.favorites.filter(f => f !== prodId)
      : [..._data.favorites, prodId];
    _data = { ..._data, favorites: favs };
    saveData(_data);
    notify();
  };

  // ── Export / Import ───────────────────────────────
  // Returns the JSON string to be written to a file and shared.
  const getExportJSON = (): string => {
    const exportObj: AppData = { ..._data, exportedAt: new Date().toISOString() };
    return JSON.stringify(exportObj, null, 2);
  };

  const importData = (jsonStr: string): { success: boolean; message: string } => {
    try {
      const parsed: AppData = JSON.parse(jsonStr);
      if (!parsed.oems || !Array.isArray(parsed.oems)) {
        return { success: false, message: 'Invalid file format: missing oems array.' };
      }
      _data = {
        oems: parsed.oems,
        favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
        version: '1.0.0',
      };
      saveData(_data);
      notify();
      return { success: true, message: `Imported ${parsed.oems.length} OEM(s) successfully.` };
    } catch (e) {
      return { success: false, message: 'Failed to parse the file. Ensure it is a valid JSON export.' };
    }
  };

  // ── Bulk Import (spreadsheet) ─────────────────────
  // Merges parsed rows from the bulk-import template into the existing
  // data set. OEM / Category / Product are matched by name (case-insensitive,
  // trimmed) and auto-created if no match is found, so the same workbook can
  // be re-imported later to add more commands/links without duplicating
  // anything already in the app.
  const bulkImportRows = (parsed: {
    products: BulkProductRow[];
    cli: BulkCLIRow[];
    links: BulkLinkRow[];
  }): BulkImportStats => {
    const norm = (s?: string) => (s || '').trim().toLowerCase();

    // Deep-ish copy so we can mutate freely while building the new dataset.
    const oems: OEM[] = _data.oems.map(o => ({
      ...o,
      categories: o.categories.map(c => ({
        ...c,
        products: c.products.map(p => ({
          ...p,
          cliCommands: [...p.cliCommands],
          datasheets: [...p.datasheets],
          referenceLinks: [...(p.referenceLinks || [])],
        })),
      })),
    }));

    const stats: BulkImportStats = {
      oemsCreated: 0, categoriesCreated: 0, productsCreated: 0,
      cliAdded: 0, linksAdded: 0, attachmentsAdded: 0, errors: [],
    };

    const findOrCreateOEM = (name: string, website?: string, logo?: string): OEM => {
      let oem = oems.find(o => norm(o.name) === norm(name));
      if (!oem) {
        oem = { id: uuidv4(), name: name.trim(), logo: '', website: (website || '').trim(), categories: [] };
        oems.push(oem);
        stats.oemsCreated++;
      } else if (website && !oem.website) {
        oem.website = website.trim();
      }
      if (logo && !oem.logo) {
        oem.logo = logo;
        stats.attachmentsAdded++;
      }
      return oem;
    };

    const findOrCreateCategory = (oem: OEM, name: string): Category => {
      let cat = oem.categories.find(c => norm(c.name) === norm(name));
      if (!cat) {
        cat = { id: uuidv4(), name: name.trim(), products: [] };
        oem.categories.push(cat);
        stats.categoriesCreated++;
      }
      return cat;
    };

    const findOrCreateProduct = (cat: Category, productName: string, model?: string): Product => {
      let prod = cat.products.find(
        p => norm(p.name) === norm(productName) && norm(p.model) === norm(model)
      );
      if (!prod) {
        prod = {
          id: uuidv4(), name: productName.trim(), model: (model || '').trim(),
          image: '', description: '', notes: '',
          datasheets: [], cliCommands: [], referenceLinks: [],
        };
        cat.products.push(prod);
        stats.productsCreated++;
      }
      return prod;
    };

    for (const row of parsed.products) {
      const oem = findOrCreateOEM(row.oemName, row.oemWebsite, row.resolvedOemLogo);
      const cat = findOrCreateCategory(oem, row.category);
      const prod = findOrCreateProduct(cat, row.productName, row.model);
      if (row.description) prod.description = row.description;
      if (row.notes) prod.notes = row.notes;
      if (row.resolvedImage && !prod.image) {
        prod.image = row.resolvedImage;
        stats.attachmentsAdded++;
      }
      if (row.resolvedDatasheet) {
        const alreadyHas = prod.datasheets.some(d => norm(d.name) === norm(row.resolvedDatasheet!.name));
        if (!alreadyHas) {
          prod.datasheets.push({ id: uuidv4(), ...row.resolvedDatasheet });
          stats.attachmentsAdded++;
        }
      }
    }

    for (const row of parsed.cli) {
      const oem = findOrCreateOEM(row.oemName);
      const cat = findOrCreateCategory(oem, row.category);
      const prod = findOrCreateProduct(cat, row.productName, row.model);
      const isDuplicate = prod.cliCommands.some(
        c => norm(c.label) === norm(row.label) && norm(c.command) === norm(row.command)
      );
      if (!isDuplicate) {
        prod.cliCommands.push({
          id: uuidv4(), label: row.label.trim(), command: row.command.trim(),
          description: (row.description || '').trim(),
        });
        stats.cliAdded++;
      }
    }

    for (const row of parsed.links) {
      const oem = findOrCreateOEM(row.oemName);
      const cat = findOrCreateCategory(oem, row.category);
      const prod = findOrCreateProduct(cat, row.productName, row.model);
      prod.referenceLinks = prod.referenceLinks || [];
      const isDuplicate = prod.referenceLinks.some(l => norm(l.url) === norm(row.url));
      if (!isDuplicate) {
        prod.referenceLinks.push({
          id: uuidv4(), title: row.title.trim(), url: row.url.trim(),
          notes: (row.notes || '').trim(),
        });
        stats.linksAdded++;
      }
    }

    _data = { ..._data, oems };
    saveData(_data);
    notify();
    return stats;
  };

  // ── Helpers ───────────────────────────────────────
  function getProduct(oemId: string, catId: string, prodId: string): Product | undefined {
    const oem = _data.oems.find(o => o.id === oemId);
    const cat = oem?.categories.find(c => c.id === catId);
    return cat?.products.find(p => p.id === prodId);
  }

  const getAllProducts = useCallback((): Array<{ product: Product; oem: OEM; category: Category }> => {
    const result: Array<{ product: Product; oem: OEM; category: Category }> = [];
    for (const oem of _data.oems) {
      for (const cat of oem.categories) {
        for (const product of cat.products) {
          result.push({ product, oem, category: cat });
        }
      }
    }
    return result;
  }, []);

  return {
    data: _data,
    ready,
    addOEM, updateOEM, deleteOEM,
    addCategory, updateCategory, deleteCategory,
    addProduct, updateProduct, deleteProduct,
    addDatasheet, deleteDatasheet,
    addCLICommand, updateCLICommand, deleteCLICommand,
    toggleFavorite,
    getExportJSON, importData,
    bulkImportRows,
    getAllProducts,
    getProduct,
  };
}
