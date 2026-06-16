import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store';
import { Product, OEM, Category } from '../types';
import Badge from '../components/Badge';
import ProductDetailModal from './ProductDetailModal';
import { colors } from '../theme/colors';

export default function FavoritesView() {
  const store = useAppStore();
  const [selected, setSelected] = useState<{ product: Product; oem: OEM; category: Category } | null>(null);

  const favorites = store.getAllProducts().filter(({ product }) =>
    store.data.favorites.includes(product.id)
  );

  if (favorites.length === 0) {
    return (
      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <Ionicons name="star-outline" size={36} color={colors.gray600} />
        </View>
        <Text style={styles.emptyTitle}>No favorites yet</Text>
        <Text style={styles.emptySubtitle}>Star a device from the Home tab to add it here</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.topBarText}>
          {favorites.length} starred device{favorites.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {favorites.map(({ product, oem, category }) => (
          <TouchableOpacity
            key={product.id}
            style={styles.card}
            onPress={() => setSelected({ product, oem, category })}
            activeOpacity={0.75}
          >
            {product.image ? (
              <Image source={{ uri: product.image }} style={styles.thumb} />
            ) : (
              <View style={styles.thumbPlaceholder}>
                <Ionicons name="cube-outline" size={22} color={colors.gray500} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.productModel}>{product.model}</Text>
              <View style={styles.badges}>
                <Badge label={oem.name} color="blue" />
                <Badge label={category.name} color="purple" />
              </View>
              <View style={styles.metaRow}>
                {product.datasheets.length > 0 && (
                  <View style={styles.metaItem}>
                    <Ionicons name="document-text-outline" size={10} color={colors.gray500} />
                    <Text style={styles.metaText}>
                      {product.datasheets.length} sheet{product.datasheets.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                )}
                {product.cliCommands.length > 0 && (
                  <View style={styles.metaItem}>
                    <Ionicons name="terminal-outline" size={10} color={colors.gray500} />
                    <Text style={styles.metaText}>
                      {product.cliCommands.length} cmd{product.cliCommands.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity
                onPress={() => store.toggleFavorite(product.id)}
                style={styles.removeBtn}
              >
                <Ionicons name="trash-outline" size={14} color={colors.yellow400} />
              </TouchableOpacity>
              <Ionicons name="chevron-forward" size={14} color={colors.gray500} />
            </View>
          </TouchableOpacity>
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
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
    backgroundColor: colors.bg950,
  },
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
  topBar: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border800,
  },
  topBarText: { fontSize: 13, color: colors.gray400 },
  list: { padding: 12, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: colors.bg800_60,
    borderWidth: 1,
    borderColor: colors.border700_60,
    borderRadius: 16,
    gap: 12,
  },
  thumb: { width: 52, height: 52, borderRadius: 12, backgroundColor: colors.bg700 },
  thumbPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.bg700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productName: { fontSize: 13, fontWeight: '600', color: colors.white },
  productModel: { fontSize: 12, color: colors.gray400, marginTop: 1 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  metaRow: { flexDirection: 'row', gap: 10, marginTop: 5 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 10, color: colors.gray500 },
  actions: { alignItems: 'flex-end', gap: 8 },
  removeBtn: { padding: 4 },
});
