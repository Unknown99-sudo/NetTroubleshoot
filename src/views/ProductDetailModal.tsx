import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, Alert, TextInput, Linking
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { OEM, Category, Product } from '../types';
import { useAppStore } from '../store';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import { colors } from '../theme/colors';
import { openDatasheet } from '../utils/openDatasheet';

interface Props {
  product: Product;
  oem: OEM;
  category: Category;
  onClose: () => void;
}

type Tab = 'info' | 'cli' | 'datasheets' | 'links';

export default function ProductDetailModal({ product, oem, category, onClose }: Props) {
  const store = useAppStore();
  const isFav = store.data.favorites.includes(product.id);
  const [tab, setTab] = useState<Tab>('info');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedCmd, setExpandedCmd] = useState<string | null>(null);
  const [cliSearch,setCliSearch]=useState('');

  const copyCmd = async (id: string, cmd: string) => {
    await Clipboard.setStringAsync(cmd);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const tabs = [
    { id: 'info' as Tab, label: 'Info', icon: 'information-circle-outline' },
    { id: 'cli' as Tab, label: `CLI (${product.cliCommands.length})`, icon: 'terminal-outline' },
    { id: 'datasheets' as Tab, label: `Docs (${product.datasheets.length})`, icon: 'document-text-outline' },
    { id: 'links' as Tab, label: `Links (${product.referenceLinks?.length || 0})`, icon: 'link-outline' },
  ];

  return (
    <Modal title={product.name} onClose={onClose} size="xl">
      {/* Header card */}
      <View style={styles.headerCard}>
        {product.image ? (
          <Image source={{ uri: product.image }} style={styles.productImage} />
        ) : (
          <View style={styles.productImagePlaceholder}>
            <Ionicons name="cube-outline" size={28} color={colors.gray500} />
          </View>
        )}
        <View style={styles.headerInfo}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.productModel}>{product.model}</Text>
            </View>
            <TouchableOpacity
              onPress={() => store.toggleFavorite(product.id)}
              style={[styles.favBtn, isFav && styles.favBtnActive]}
            >
              <Ionicons
                name={isFav ? 'star' : 'star-outline'}
                size={16}
                color={isFav ? colors.yellow400 : colors.gray400}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.badges}>
            <Badge label={oem.name} color="blue" />
            <Badge label={category.name} color="purple" />
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {tabs.map(t => (
          <TouchableOpacity
            key={t.id}
            onPress={() => setTab(t.id)}
            style={[styles.tabBtn, tab === t.id && styles.tabBtnActive]}
          >
            <Ionicons
              name={t.icon as any}
              size={13}
              color={tab === t.id ? colors.white : colors.gray400}
            />
            <Text style={[styles.tabLabel, tab === t.id && styles.tabLabelActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Info tab */}
      {tab === 'info' && (
        <View style={styles.tabContent}>
          {product.description ? (
            <View style={{ marginBottom: 16 }}>
              <Text style={styles.sectionLabel}>Description</Text>
              <Text style={styles.bodyText}>{product.description}</Text>
            </View>
          ) : null}
          {product.notes ? (
            <View style={styles.notesCard}>
              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notesText}>{product.notes}</Text>
            </View>
          ) : null}
          {!product.description && !product.notes ? (
            <Text style={styles.emptyText}>No additional info available.</Text>
          ) : null}
        </View>
      )}

      {/* CLI tab */}
      {tab === 'cli' && (
        <View style={styles.tabContent}>
          <Text style={{color:'white',marginBottom:6}}>{product.cliCommands.filter(cmd => (cmd.label+' '+cmd.command+' '+(cmd.description||'')).toLowerCase().includes(cliSearch.toLowerCase())).length} result(s)</Text><TextInput value={cliSearch} onChangeText={setCliSearch} placeholder='Search commands...' placeholderTextColor={colors.gray500} style={{borderWidth:1,borderColor:colors.border700,padding:10,borderRadius:8,marginBottom:8,color:colors.white,backgroundColor:colors.bg800}} />
          {product.cliCommands.filter(cmd => (cmd.label+' '+cmd.command+' '+(cmd.description||'')).toLowerCase().includes(cliSearch.toLowerCase())).length === 0 ? (
            <Text style={styles.emptyText}>{cliSearch.length>0 ? 'No matching commands found.' : 'No CLI commands added yet.'}</Text>
          ) : (
            product.cliCommands.filter(cmd => (cmd.label+' '+cmd.command+' '+(cmd.description||'')).toLowerCase().includes(cliSearch.toLowerCase())).map(cmd => (
              <View key={cmd.id} style={styles.cliCard}>
                <TouchableOpacity
                  style={styles.cliHeader}
                  onPress={() => setExpandedCmd(expandedCmd === cmd.id ? null : cmd.id)}
                >
                  <Ionicons name="terminal-outline" size={14} color={colors.green400} />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.cliLabel}>{cmd.label}</Text>
                    {cmd.description ? (
                      <Text style={styles.cliDesc} numberOfLines={1}>{cmd.description}</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    onPress={() => copyCmd(cmd.id, cmd.command)}
                    style={styles.copyBtn}
                  >
                    <Ionicons
                      name={copiedId === cmd.id ? 'checkmark' : 'copy-outline'}
                      size={13}
                      color={copiedId === cmd.id ? colors.green400 : colors.gray400}
                    />
                  </TouchableOpacity>
                  <Ionicons
                    name={expandedCmd === cmd.id ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color={colors.gray400}
                  />
                </TouchableOpacity>
                {expandedCmd === cmd.id && (
                  <View style={styles.cliBody}>
                    <Text style={styles.cliCode}>{cmd.command}</Text>
                    {cmd.description ? (
                      <Text style={styles.cliDescExpanded}>{cmd.description}</Text>
                    ) : null}
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      )}


      {tab === 'links' && (
        <View style={styles.tabContent}>
          {!product.referenceLinks || product.referenceLinks.length===0 ? (
            <Text style={styles.emptyText}>No reference links added.</Text>
          ) : product.referenceLinks.map((l:any)=>(
            <TouchableOpacity key={l.id} style={styles.cliCard} onPress={()=>Linking.openURL(l.url)}>
              <Text style={styles.cliLabel}>{l.title}</Text>
              <Text style={styles.cliDesc}>{l.url}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Datasheets tab */}
      {tab === 'datasheets' && (
        <View style={styles.tabContent}>
          {product.datasheets.length === 0 ? (
            <Text style={styles.emptyText}>No datasheets uploaded yet.</Text>
          ) : (
            product.datasheets.map(ds => (
              <View key={ds.id} style={styles.dsRow}>
                <View style={styles.dsIcon}>
                  <Ionicons name="document-text-outline" size={16} color={colors.red400} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dsName} numberOfLines={1}>{ds.name}</Text>
                  <Text style={styles.dsType}>{ds.fileType || 'Document'}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => openDatasheet(ds.fileData, ds.name)}
                  style={styles.dsOpenBtn}
                >
                  <Ionicons name="download-outline" size={14} color={colors.gray300} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    padding: 14,
    backgroundColor: colors.bg800_60,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border700_60,
  },
  productImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: colors.bg700,
  },
  productImagePlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: colors.bg700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: { flex: 1 },
  headerTop: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  productName: { fontSize: 16, fontWeight: '700', color: colors.white },
  productModel: { fontSize: 13, color: colors.gray400, marginTop: 2 },
  favBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.bg700,
  },
  favBtnActive: {
    backgroundColor: colors.yellow500_20,
  },
  badges: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.bg800,
    padding: 4,
    borderRadius: 12,
    marginBottom: 14,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  tabBtnActive: { backgroundColor: colors.blue600 },
  tabLabel: { fontSize: 11, color: colors.gray400, fontWeight: '500' },
  tabLabelActive: { color: colors.white },
  tabContent: { gap: 10 },
  sectionLabel: {
    fontSize: 11,
    color: colors.gray400,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  bodyText: { fontSize: 13, color: colors.gray200, lineHeight: 20 },
  notesCard: {
    padding: 14,
    backgroundColor: colors.yellow500_10,
    borderWidth: 1,
    borderColor: colors.yellow500_20,
    borderRadius: 12,
  },
  notesLabel: {
    fontSize: 11,
    color: colors.yellow400,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  notesText: { fontSize: 13, color: colors.yellow100_80, lineHeight: 20 },
  emptyText: { fontSize: 13, color: colors.gray500, textAlign: 'center', paddingVertical: 32 },
  cliCard: {
    backgroundColor: colors.bg800,
    borderWidth: 1,
    borderColor: colors.border700,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cliHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 4,
  },
  cliLabel: { fontSize: 13, fontWeight: '500', color: colors.white },
  cliDesc: { fontSize: 11, color: colors.gray400, marginTop: 1 },
  copyBtn: { padding: 6 },
  cliBody: {
    borderTopWidth: 1,
    borderTopColor: colors.border700,
    backgroundColor: colors.bg950,
    padding: 12,
  },
  cliCode: {
    fontSize: 12,
    color: '#86efac',
    fontFamily: 'monospace',
  },
  cliDescExpanded: {
    fontSize: 12,
    color: colors.gray400,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border700,
  },
  dsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: colors.bg800,
    borderWidth: 1,
    borderColor: colors.border700,
    borderRadius: 12,
  },
  dsIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.red500_20,
    borderWidth: 1,
    borderColor: colors.red500_30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dsName: { fontSize: 13, fontWeight: '500', color: colors.white },
  dsType: { fontSize: 11, color: colors.gray400, marginTop: 1 },
  dsOpenBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.bg700,
  },
});
