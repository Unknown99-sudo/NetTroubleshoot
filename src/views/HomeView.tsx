import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store';
import { OEM, Category, Product } from '../types';
import { colors } from '../theme/colors';
import ProductDetailModal from './ProductDetailModal';

export default function HomeView({ search = '' }: { search?: string }) {
  const store = useAppStore();
  const [expandedOEMs, setExpandedOEMs] = useState<Set<string>>(new Set());
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<{ product: Product; oem: OEM; category: Category } | null>(null);

  const toggleOEM = (id: string) => {
    setExpandedOEMs(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleCat = (id: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const q = search.toLowerCase();

  const filteredOEMs = store.data.oems
    .map(oem => ({
      ...oem,
      categories: oem.categories
        .map(cat => ({
          ...cat,
          products: cat.products.filter(
            p =>
              p.name.toLowerCase().includes(q) ||
              p.model.toLowerCase().includes(q) ||
              (p.description||'').toLowerCase().includes(q) ||
              (p.notes||'').toLowerCase().includes(q) ||
              p.cliCommands.some(c => (c.label+' '+c.command+' '+(c.description||'')).toLowerCase().includes(q)) ||
              p.datasheets.some(d => (d.name||'').toLowerCase().includes(q)) ||
              cat.name.toLowerCase().includes(q) ||
              oem.name.toLowerCase().includes(q)
          ),
        }))
        .filter(cat => cat.products.length > 0),
    }))
    .filter(oem => oem.categories.length > 0);

  const isEmpty = store.data.oems.length === 0;

  const searchResults = useMemo(() => {
    if (!q) return [];
    const results:any[]=[];
    store.data.oems.forEach(oem=>oem.categories.forEach(cat=>cat.products.forEach(product=>{
      const blob=(oem.name+' '+cat.name+' '+product.name+' '+product.model).toLowerCase();
      if(blob.includes(q)) results.push({oem,cat,product});
    })));
    return results.slice(0,50);
  }, [q, store.data.oems]);


  return (
    <View style={styles.container}>
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>{search.length>0 && searchResults.length>0 && <View>{searchResults.map(r=><TouchableOpacity key={r.product.id} style={styles.productRow} onPress={()=>setSelected({product:r.product,oem:r.oem,category:r.cat})}><View style={{flex:1}}><Text style={styles.productName}>{r.product.name}</Text><Text style={styles.productModel}>{r.oem.name} › {r.cat.name}</Text></View></TouchableOpacity>)}</View>}
        {isEmpty && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="business-outline" size={36} color={colors.gray600} />
            </View>
            <Text style={styles.emptyTitle}>No devices yet</Text>
            <Text style={styles.emptySubtitle}>Go to Settings to add OEMs and products</Text>
          </View>
        )}

        {!isEmpty && filteredOEMs.length === 0 && (
          <Text style={styles.noResults}>No results for "{search}"</Text>
        )}

        {filteredOEMs.map(oem => (
          <View key={oem.id} style={styles.oemCard}>
            {/* OEM header */}
            <TouchableOpacity style={styles.oemRow} onPress={() => toggleOEM(oem.id)}>
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
                  {oem.categories.reduce((acc, c) => acc + c.products.length, 0)} products
                </Text>
              </View>
              <Ionicons
                name={expandedOEMs.has(oem.id) ? 'chevron-down' : 'chevron-forward'}
                size={16}
                color={colors.gray400}
              />
            </TouchableOpacity>

            {/* Categories */}
            {expandedOEMs.has(oem.id) && (
              <View style={styles.categoriesContainer}>
                {oem.categories.map(cat => (
                  <View key={cat.id}>
                    <TouchableOpacity
                      style={styles.catRow}
                      onPress={() => toggleCat(cat.id)}
                    >
                      <Ionicons name="layers-outline" size={14} color={colors.purple400} style={{ marginLeft: 16 }} />
                      <Text style={styles.catName}>{cat.name}</Text>
                      <Text style={styles.catCount}>{cat.products.length} products</Text>
                      <Ionicons
                        name={expandedCats.has(cat.id) ? 'chevron-down' : 'chevron-forward'}
                        size={14}
                        color={colors.gray500}
                      />
                    </TouchableOpacity>

                    {/* Products */}
                    {expandedCats.has(cat.id) && (
                      <View style={styles.productsContainer}>
                        {cat.products.map(product => {
                          const isFav = store.data.favorites.includes(product.id);
                          return (
                            <TouchableOpacity
                              key={product.id}
                              style={styles.productRow}
                              onPress={() => setSelected({ product, oem, category: cat })}
                            >
                              {product.image ? (
                                <Image source={{ uri: product.image }} style={styles.productThumb} />
                              ) : (
                                <View style={styles.productThumbPlaceholder}>
                                  <Ionicons name="cube-outline" size={16} color={colors.gray500} />
                                </View>
                              )}
                              <View style={{ flex: 1 }}>
                                <Text style={styles.productName}>{product.name}</Text>
                                <Text style={styles.productModel}>{product.model}</Text>
                                <View style={styles.productMeta}>
                                  {product.datasheets.length > 0 && (
                                    <View style={styles.metaItem}>
                                      <Ionicons name="document-text-outline" size={10} color={colors.gray500} />
                                      <Text style={styles.metaText}>{product.datasheets.length}</Text>
                                    </View>
                                  )}
                                  {product.cliCommands.length > 0 && (
                                    <View style={styles.metaItem}>
                                      <Ionicons name="terminal-outline" size={10} color={colors.gray500} />
                                      <Text style={styles.metaText}>{product.cliCommands.length}</Text>
                                    </View>
                                  )}
                                </View>
                              </View>
                              <TouchableOpacity
                                onPress={() => store.toggleFavorite(product.id)}
                                style={styles.starBtn}
                              >
                                <Ionicons
                                  name={isFav ? 'star' : 'star-outline'}
                                  size={15}
                                  color={isFav ? colors.yellow400 : colors.gray600}
                                />
                              </TouchableOpacity>
                              <Ionicons name="chevron-forward" size={15} color={colors.gray600} />
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {selected && (
        <ProductDetailModal
          product={selected.product}
          oem={selected.oem}
          category={selected.category}
          onClose={() => setSelected(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg950 },
  list: { flex: 1 },
  listContent: { padding: 12, paddingBottom: 28, gap: 10 },
  emptyState: { alignItems: 'center', paddingVertical: 80, gap: 12 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: colors.bg800,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.gray300 },
  emptySubtitle: { fontSize: 13, color: colors.gray500, textAlign: 'center' },
  noResults: { fontSize: 13, color: colors.gray500, textAlign: 'center', paddingVertical: 60 },
  oemCard: {
    backgroundColor: colors.bg800_60,
    borderWidth: 1,
    borderColor: colors.border700_60,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 2,
  },
  oemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  oemLogo: { width: 36, height: 36, borderRadius: 8, backgroundColor: colors.bg700 },
  oemLogoPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.blue600_20,
    borderWidth: 1,
    borderColor: colors.blue600_30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  oemName: { fontSize: 14, fontWeight: '600', color: colors.white },
  oemMeta: { fontSize: 11, color: colors.gray400, marginTop: 1 },
  categoriesContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.border700_60,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.bg800_40,
    gap: 6,
  },
  catName: { flex: 1, fontSize: 13, fontWeight: '500', color: colors.gray200 },
  catCount: { fontSize: 11, color: colors.gray500, marginRight: 4 },
  productsContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.border700_40,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 30,
    paddingRight: 12,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border700_40,
  },
  productThumb: { width: 38, height: 38, borderRadius: 8, backgroundColor: colors.bg700 },
  productThumbPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: colors.bg700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productName: { fontSize: 13, fontWeight: '500', color: colors.white },
  productModel: { fontSize: 11, color: colors.gray400, marginTop: 1 },
  productMeta: { flexDirection: 'row', gap: 10, marginTop: 3 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 10, color: colors.gray500 },
  starBtn: { padding: 4 },
});
