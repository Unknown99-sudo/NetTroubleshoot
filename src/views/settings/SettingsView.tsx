import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../store';
import { OEM, Category, Product } from '../../types';
import { colors } from '../../theme/colors';
import { exportDataToFile, pickImportFile } from '../../utils/exportImport';
import OEMFormModal from './OEMFormModal';
import CategoryFormModal from './CategoryFormModal';
import ProductFormModal from './ProductFormModal';
import ProductEditModal from './ProductEditModal';

type ToastType = 'success' | 'error';
interface Toast { type: ToastType; message: string }

export default function SettingsView() {
  const store = useAppStore();

  const [toast, setToast] = useState<Toast | null>(null);
  const [expandedOEMs, setExpandedOEMs] = useState<Set<string>>(new Set());
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [showOEMForm, setShowOEMForm] = useState(false);
  const [editingOEM, setEditingOEM] = useState<OEM | null>(null);
  const [showCatForm, setShowCatForm] = useState<{ oemId: string } | null>(null);
  const [editingCat, setEditingCat] = useState<{ oemId: string; cat: Category } | null>(null);
  const [showProductForm, setShowProductForm] = useState<{ oemId: string; catId: string } | null>(null);
  const [editingProduct, setEditingProduct] = useState<{ oemId: string; catId: string; product: Product } | null>(null);

  const showToast = (type: ToastType, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const toggleOEM = (id: string) =>
    setExpandedOEMs(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const toggleCat = (id: string) =>
    setExpandedCats(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  // ── FIXED: Native export using expo-file-system + expo-sharing ──
  const handleExport = async () => {
    const json = store.getExportJSON();
    const result = await exportDataToFile(json);
    showToast(result.success ? 'success' : 'error', result.message);
  };

  // ── FIXED: Native import using expo-document-picker ──
  const handleImport = async () => {
    const picked = await pickImportFile();
    if (!picked.success || picked.message === 'cancelled') return;
    if (!picked.content) {
      showToast('error', picked.message ?? 'Could not read file.');
      return;
    }
    const result = store.importData(picked.content);
    showToast(result.success ? 'success' : 'error', result.message);
  };

  const totalProducts = store.data.oems.reduce(
    (a, o) => a + o.categories.reduce((b, c) => b + c.products.length, 0), 0
  );

  return (
    <View style={styles.container}>
      {/* Toast */}
      {toast && (
        <View style={[styles.toast, toast.type === 'success' ? styles.toastSuccess : styles.toastError]}>
          <Ionicons
            name={toast.type === 'success' ? 'checkmark-circle' : 'close-circle'}
            size={16}
            color={colors.white}
          />
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Data Management */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Data Management</Text>
          <View style={styles.dataButtons}>
            <TouchableOpacity onPress={handleExport} style={styles.exportBtn}>
              <Ionicons name="download-outline" size={15} color={colors.white} />
              <Text style={styles.exportBtnText}>Export Data</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleImport} style={styles.importBtn}>
              <Ionicons name="cloud-upload-outline" size={15} color={colors.white} />
              <Text style={styles.importBtnText}>Import Data</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.dataHint}>
            Export your data to share with colleagues, or import a previously exported backup.
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.blue400 }]}>{store.data.oems.length}</Text>
            <Text style={styles.statLabel}>OEMs</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.green400 }]}>{totalProducts}</Text>
            <Text style={styles.statLabel}>Products</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.yellow400 }]}>{store.data.favorites.length}</Text>
            <Text style={styles.statLabel}>Favorites</Text>
          </View>
        </View>

        {/* OEM Management */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>OEM Manufacturers</Text>
            <TouchableOpacity onPress={() => setShowOEMForm(true)} style={styles.addOEMBtn}>
              <Ionicons name="add" size={13} color={colors.white} />
              <Text style={styles.addOEMText}>Add OEM</Text>
            </TouchableOpacity>
          </View>

          {store.data.oems.length === 0 && (
            <View style={styles.emptyOEM}>
              <Text style={styles.emptyOEMText}>No OEMs added yet. Tap "Add OEM" to get started.</Text>
            </View>
          )}

          {store.data.oems.map(oem => (
            <View key={oem.id} style={styles.oemCard}>
              {/* OEM row */}
              <View style={styles.oemRow}>
                {oem.logo ? (
                  <Image source={{ uri: oem.logo }} style={styles.oemLogo} />
                ) : (
                  <View style={styles.oemLogoPlaceholder}>
                    <Ionicons name="business-outline" size={16} color={colors.blue400} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.oemName}>{oem.name}</Text>
                  <Text style={styles.oemMeta}>
                    {oem.categories.length} categor{oem.categories.length !== 1 ? 'ies' : 'y'} •{' '}
                    {oem.categories.reduce((a, c) => a + c.products.length, 0)} products
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setEditingOEM(oem)} style={styles.iconBtn}>
                  <Ionicons name="pencil-outline" size={14} color={colors.gray400} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setDeleteConfirm(deleteConfirm === oem.id ? null : oem.id)}
                  style={styles.iconBtn}
                >
                  <Ionicons name="trash-outline" size={14} color={colors.gray400} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => toggleOEM(oem.id)} style={styles.iconBtn}>
                  <Ionicons
                    name={expandedOEMs.has(oem.id) ? 'chevron-down' : 'chevron-forward'}
                    size={14}
                    color={colors.gray400}
                  />
                </TouchableOpacity>
              </View>

              {/* Delete confirm */}
              {deleteConfirm === oem.id && (
                <View style={styles.deleteConfirm}>
                  <Ionicons name="warning-outline" size={14} color={colors.red400} />
                  <Text style={styles.deleteConfirmText}>Delete "{oem.name}" and all its data?</Text>
                  <TouchableOpacity
                    onPress={() => { store.deleteOEM(oem.id); setDeleteConfirm(null); }}
                    style={styles.deleteBtn}
                  >
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setDeleteConfirm(null)} style={styles.cancelSmallBtn}>
                    <Text style={styles.cancelSmallText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Categories */}
              {expandedOEMs.has(oem.id) && (
                <View style={styles.categoriesContainer}>
                  <View style={styles.catHeaderRow}>
                    <Text style={styles.catHeaderLabel}>Categories</Text>
                    <TouchableOpacity onPress={() => setShowCatForm({ oemId: oem.id })} style={styles.addCatBtn}>
                      <Ionicons name="add" size={12} color={colors.purple400} />
                      <Text style={styles.addCatText}>Add Category</Text>
                    </TouchableOpacity>
                  </View>

                  {oem.categories.length === 0 && (
                    <Text style={styles.emptyCatText}>No categories. Add one above.</Text>
                  )}

                  {oem.categories.map(cat => (
                    <View key={cat.id}>
                      <View style={styles.catRow}>
                        <Ionicons name="layers-outline" size={12} color={colors.purple400} />
                        <Text style={styles.catName}>{cat.name}</Text>
                        <Text style={styles.catCount}>{cat.products.length} prod.</Text>
                        <TouchableOpacity onPress={() => setEditingCat({ oemId: oem.id, cat })} style={styles.iconBtnSm}>
                          <Ionicons name="pencil-outline" size={12} color={colors.gray500} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => store.deleteCategory(oem.id, cat.id)} style={styles.iconBtnSm}>
                          <Ionicons name="trash-outline" size={12} color={colors.gray500} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => toggleCat(cat.id)} style={styles.iconBtnSm}>
                          <Ionicons
                            name={expandedCats.has(cat.id) ? 'chevron-down' : 'chevron-forward'}
                            size={12}
                            color={colors.gray500}
                          />
                        </TouchableOpacity>
                      </View>

                      {/* Products */}
                      {expandedCats.has(cat.id) && (
                        <View style={styles.productsContainer}>
                          <View style={styles.prodHeaderRow}>
                            <Text style={styles.prodHeaderLabel}>Products</Text>
                            <TouchableOpacity
                              onPress={() => setShowProductForm({ oemId: oem.id, catId: cat.id })}
                              style={styles.addProdBtn}
                            >
                              <Ionicons name="add" size={11} color={colors.green400} />
                              <Text style={styles.addProdText}>Add Product</Text>
                            </TouchableOpacity>
                          </View>
                          {cat.products.length === 0 && (
                            <Text style={styles.emptyProdText}>No products yet.</Text>
                          )}
                          {cat.products.map(prod => (
                            <View key={prod.id} style={styles.prodRow}>
                              {prod.image ? (
                                <Image source={{ uri: prod.image }} style={styles.prodThumb} />
                              ) : (
                                <View style={styles.prodThumbPlaceholder}>
                                  <Ionicons name="cube-outline" size={12} color={colors.gray500} />
                                </View>
                              )}
                              <View style={{ flex: 1 }}>
                                <Text style={styles.prodName} numberOfLines={1}>{prod.name}</Text>
                                <Text style={styles.prodModel} numberOfLines={1}>{prod.model}</Text>
                              </View>
                              <TouchableOpacity
                                onPress={() => setEditingProduct({ oemId: oem.id, catId: cat.id, product: prod })}
                                style={styles.iconBtnSm}
                              >
                                <Ionicons name="pencil-outline" size={11} color={colors.gray500} />
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => store.deleteProduct(oem.id, cat.id, prod.id)}
                                style={styles.iconBtnSm}
                              >
                                <Ionicons name="trash-outline" size={11} color={colors.gray500} />
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Modals */}
      {showOEMForm && (
        <OEMFormModal
          onClose={() => setShowOEMForm(false)}
          onSave={(n, l, w) => { store.addOEM(n, l, w); setShowOEMForm(false); }}
        />
      )}
      {editingOEM && (
        <OEMFormModal
          initial={editingOEM}
          onClose={() => setEditingOEM(null)}
          onSave={(n, l, w) => { store.updateOEM(editingOEM.id, { name: n, logo: l, website: w }); setEditingOEM(null); }}
        />
      )}
      {showCatForm && (
        <CategoryFormModal
          onClose={() => setShowCatForm(null)}
          onSave={n => { store.addCategory(showCatForm.oemId, n); setShowCatForm(null); }}
        />
      )}
      {editingCat && (
        <CategoryFormModal
          initial={editingCat.cat}
          onClose={() => setEditingCat(null)}
          onSave={n => { store.updateCategory(editingCat.oemId, editingCat.cat.id, { name: n }); setEditingCat(null); }}
        />
      )}
      {showProductForm && (
        <ProductFormModal
          oemId={showProductForm.oemId}
          catId={showProductForm.catId}
          onClose={() => setShowProductForm(null)}
        />
      )}
      {editingProduct && (
        <ProductEditModal
          oemId={editingProduct.oemId}
          catId={editingProduct.catId}
          product={editingProduct.product}
          onClose={() => setEditingProduct(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg950 },
  toast: {
    position: 'absolute', top: 16, alignSelf: 'center', zIndex: 100,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, elevation: 10,
  },
  toastSuccess: { backgroundColor: colors.green600 },
  toastError: { backgroundColor: colors.red600 },
  toastText: { fontSize: 13, fontWeight: '500', color: colors.white },
  scrollContent: { padding: 14, gap: 12 },
  section: { gap: 10 },
  sectionLabel: {
    fontSize: 11, color: colors.gray400, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  dataButtons: { flexDirection: 'row', gap: 10 },
  exportBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, backgroundColor: colors.blue600,
    borderRadius: 12,
  },
  exportBtnText: { fontSize: 13, fontWeight: '500', color: colors.white },
  importBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, backgroundColor: colors.bg700,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border600,
  },
  importBtnText: { fontSize: 13, fontWeight: '500', color: colors.white },
  dataHint: { fontSize: 11, color: colors.gray500, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: colors.bg800_60,
    borderWidth: 1, borderColor: colors.border700_60,
    borderRadius: 12, padding: 12, alignItems: 'center',
  },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 11, color: colors.gray400, marginTop: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addOEMBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: colors.blue600, borderRadius: 8,
  },
  addOEMText: { fontSize: 12, fontWeight: '500', color: colors.white },
  emptyOEM: {
    paddingVertical: 28, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border700, borderStyle: 'dashed',
    borderRadius: 12, backgroundColor: colors.bg800_40,
  },
  emptyOEMText: { fontSize: 13, color: colors.gray500, textAlign: 'center' },
  oemCard: {
    backgroundColor: colors.bg800_60, borderWidth: 1,
    borderColor: colors.border700_60, borderRadius: 16, overflow: 'hidden', marginBottom: 8,
  },
  oemRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  oemLogo: { width: 38, height: 38, borderRadius: 8, backgroundColor: colors.bg700 },
  oemLogoPlaceholder: {
    width: 38, height: 38, borderRadius: 8,
    backgroundColor: colors.blue600_20, borderWidth: 1, borderColor: colors.blue600_30,
    alignItems: 'center', justifyContent: 'center',
  },
  oemName: { fontSize: 14, fontWeight: '600', color: colors.white },
  oemMeta: { fontSize: 11, color: colors.gray400, marginTop: 1 },
  iconBtn: { padding: 6 },
  iconBtnSm: { padding: 4 },
  deleteConfirm: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 12, marginBottom: 10,
    padding: 10, backgroundColor: colors.red500_10,
    borderWidth: 1, borderColor: colors.red500_30, borderRadius: 10,
  },
  deleteConfirmText: { flex: 1, fontSize: 12, color: '#fca5a5' },
  deleteBtn: {
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: colors.red600, borderRadius: 8,
  },
  deleteBtnText: { fontSize: 12, fontWeight: '500', color: colors.white },
  cancelSmallBtn: {
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: colors.bg700, borderRadius: 8,
  },
  cancelSmallText: { fontSize: 12, fontWeight: '500', color: colors.white },
  categoriesContainer: {
    borderTopWidth: 1, borderTopColor: colors.border700_60,
  },
  catHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.bg800_40,
  },
  catHeaderLabel: { fontSize: 12, color: colors.gray400, fontWeight: '500' },
  addCatBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  addCatText: { fontSize: 12, color: colors.purple400 },
  emptyCatText: { fontSize: 12, color: colors.gray500, textAlign: 'center', paddingVertical: 12 },
  catRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: colors.border700_40,
  },
  catName: { flex: 1, fontSize: 13, fontWeight: '500', color: colors.gray200 },
  catCount: { fontSize: 11, color: colors.gray500 },
  productsContainer: {
    backgroundColor: 'rgba(3,7,18,0.3)',
    paddingBottom: 6,
  },
  prodHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 6,
  },
  prodHeaderLabel: { fontSize: 11, color: colors.gray500 },
  addProdBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  addProdText: { fontSize: 11, color: colors.green400 },
  emptyProdText: { fontSize: 11, color: colors.gray600, textAlign: 'center', paddingVertical: 8 },
  prodRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: colors.border700_40,
  },
  prodThumb: { width: 30, height: 30, borderRadius: 6, backgroundColor: colors.bg700 },
  prodThumbPlaceholder: {
    width: 30, height: 30, borderRadius: 6, backgroundColor: colors.bg700,
    alignItems: 'center', justifyContent: 'center',
  },
  prodName: { fontSize: 12, fontWeight: '500', color: colors.white },
  prodModel: { fontSize: 11, color: colors.gray500, marginTop: 1 },
});
