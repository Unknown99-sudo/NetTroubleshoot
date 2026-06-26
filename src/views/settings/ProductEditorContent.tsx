import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Input, { Textarea } from '../../components/Input';
import { CLICommand, DataSheet } from '../../types';
import { pickImageAsBase64 } from '../../utils/imagePicker';
import { pickDatasheets } from '../../utils/datasheetPicker';
import { colors, useThemeMode } from '../../theme/colors';
const uuidv4 = () => `${Date.now()}_${Math.random().toString(36).slice(2,10)}`;

type Tab = 'info' | 'cli' | 'datasheets' | 'links';

export interface ProductEditorState {
  name: string;
  model: string;
  description: string;
  notes: string;
  image: string;
  cliCommands: CLICommand[];
  datasheets: DataSheet[];
  referenceLinks: {id:string;title:string;url:string;notes?:string}[];
}

interface Props {
  initial: ProductEditorState;
  onChange: (state: ProductEditorState) => void;
  accentColor?: string;
}

export default function ProductEditorContent({ initial, onChange, accentColor = colors.blue600 }: Props) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  const [tab, setTab] = useState<Tab>('info');
  const [state, setState] = useState<ProductEditorState>(initial);

  const update = (patch: Partial<ProductEditorState>) => {
    const next = { ...state, ...patch };
    setState(next);
    onChange(next);
  };

  // CLI form state
  const [showCmdForm, setShowCmdForm] = useState(false);
  const [newCmdLabel, setNewCmdLabel] = useState('');
  const [newCmdCmd, setNewCmdCmd] = useState('');
  const [newCmdDesc, setNewCmdDesc] = useState('');
  const [expandedCmd, setExpandedCmd] = useState<string | null>(null);

  const handleImagePick = async () => {
    const uri = await pickImageAsBase64();
    if (uri) update({ image: uri });
  };

  const handleDatasheetPick = async () => {
    const picked = await pickDatasheets();
    if (picked.length > 0) {
      const withIds: DataSheet[] = picked.map(ds => ({ id: uuidv4(), ...ds }));
      update({ datasheets: [...state.datasheets, ...withIds] });
    }
  };

  const addCLICommand = () => {
    if (!newCmdLabel.trim() || !newCmdCmd.trim()) return;
    const cmd: CLICommand = {
      id: uuidv4(),
      label: newCmdLabel.trim(),
      command: newCmdCmd.trim(),
      description: newCmdDesc.trim(),
    };
    update({ cliCommands: [...state.cliCommands, cmd] });
    setNewCmdLabel(''); setNewCmdCmd(''); setNewCmdDesc('');
    setShowCmdForm(false);
  };

  const removeCmd = (id: string) => update({ cliCommands: state.cliCommands.filter(c => c.id !== id) });
  const removeDs = (id: string) => update({ datasheets: state.datasheets.filter(d => d.id !== id) });

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'info', label: 'Info', icon: 'image-outline' },
    { id: 'cli', label: `CLI (${state.cliCommands.length})`, icon: 'terminal-outline' },
    { id: 'datasheets', label: `Docs (${state.datasheets.length})`, icon: 'document-text-outline' },
    { id: 'links', label: `Links (${state.referenceLinks?.length||0})`, icon: 'link-outline' },
  ];

  return (
    <View>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {tabs.map(t => (
          <TouchableOpacity
            key={t.id}
            onPress={() => setTab(t.id)}
            style={[styles.tabBtn, tab === t.id && { backgroundColor: accentColor }]}
          >
            <Ionicons name={t.icon as any} size={12} color={tab === t.id ? colors.white : colors.gray400} />
            <Text style={[styles.tabLabel, tab === t.id && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Info tab */}
      {tab === 'info' && (
        <View style={styles.tabContent}>
          <Text style={styles.fieldLabel}>Product Image</Text>
          <View style={styles.imageRow}>
            {state.image ? (
              <Image source={{ uri: state.image }} style={styles.imagePreview} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="cube-outline" size={24} color={colors.gray500} />
              </View>
            )}
            <View style={{ gap: 6 }}>
              <TouchableOpacity onPress={handleImagePick} style={styles.uploadBtn}>
                <Ionicons name="cloud-upload-outline" size={14} color={colors.white} />
                <Text style={styles.uploadBtnText}>Upload Image</Text>
              </TouchableOpacity>
              {state.image ? (
                <TouchableOpacity onPress={() => update({ image: '' })}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <Input label="Product Name *" value={state.name} onChangeText={v => update({ name: v })} placeholder="e.g. Catalyst 9300" />
          <Input label="Model Number" value={state.model} onChangeText={v => update({ model: v })} placeholder="e.g. C9300-24P-A" />
          <Textarea label="Description" value={state.description} onChangeText={v => update({ description: v })} placeholder="Brief description..." numberOfLines={3} />
          <Textarea label="Notes / Troubleshooting" value={state.notes} onChangeText={v => update({ notes: v })} placeholder="Tips, known issues..." numberOfLines={4} />
        </View>
      )}

      {/* CLI tab */}
      {tab === 'cli' && (
        <View style={styles.tabContent}>
          {!showCmdForm && (
            <TouchableOpacity onPress={() => setShowCmdForm(true)} style={styles.dashedBtn}>
              <Ionicons name="add-outline" size={15} color={colors.green400} />
              <Text style={styles.dashedBtnText}>Add CLI Command</Text>
            </TouchableOpacity>
          )}
          {showCmdForm && (
            <View style={styles.cmdForm}>
              <Text style={styles.cmdFormTitle}>New CLI Command</Text>
              <Input label="Label *" value={newCmdLabel} onChangeText={setNewCmdLabel} placeholder="e.g. Show interfaces" />
              <Textarea label="Command(s) *" value={newCmdCmd} onChangeText={setNewCmdCmd} placeholder="show interfaces" numberOfLines={4} />
              <Input label="Description" value={newCmdDesc} onChangeText={setNewCmdDesc} placeholder="What this does..." />
              <View style={styles.cmdFormActions}>
                <TouchableOpacity onPress={() => { setShowCmdForm(false); setNewCmdLabel(''); setNewCmdCmd(''); setNewCmdDesc(''); }} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={addCLICommand}
                  disabled={!newCmdLabel.trim() || !newCmdCmd.trim()}
                  style={[styles.addCmdBtn, (!newCmdLabel.trim() || !newCmdCmd.trim()) && styles.disabledBtn]}
                >
                  <Text style={styles.addCmdText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          {state.cliCommands.length === 0 && !showCmdForm && (
            <Text style={styles.emptyText}>No CLI commands yet.</Text>
          )}
          {state.cliCommands.map(cmd => (
            <View key={cmd.id} style={styles.cliCard}>
              <TouchableOpacity
                style={styles.cliHeader}
                onPress={() => setExpandedCmd(expandedCmd === cmd.id ? null : cmd.id)}
              >
                <Ionicons name="terminal-outline" size={14} color={colors.green400} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.cliLabel}>{cmd.label}</Text>
                  {cmd.description ? <Text style={styles.cliDescText} numberOfLines={1}>{cmd.description}</Text> : null}
                </View>
                <TouchableOpacity onPress={() => removeCmd(cmd.id)} style={{ padding: 4 }}>
                  <Ionicons name="trash-outline" size={13} color={colors.gray500} />
                </TouchableOpacity>
                <Ionicons name={expandedCmd === cmd.id ? 'chevron-up' : 'chevron-down'} size={14} color={colors.gray400} />
              </TouchableOpacity>
              {expandedCmd === cmd.id && (
                <View style={styles.cliBody}>
                  <Text style={styles.cliCode}>{cmd.command}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Datasheets tab */}
      {tab === 'datasheets' && (
        <View style={styles.tabContent}>
          <TouchableOpacity onPress={handleDatasheetPick} style={[styles.dashedBtn, styles.dashedBtnBlue]}>
            <Ionicons name="cloud-upload-outline" size={15} color={colors.blue400} />
            <Text style={[styles.dashedBtnText, { color: colors.blue400 }]}>Upload Documents</Text>
          </TouchableOpacity>
          <Text style={styles.dsHint}>Supports PDF, images, docs, and other files</Text>
          {state.datasheets.length === 0 && (
            <Text style={styles.emptyText}>No documents uploaded yet.</Text>
          )}
          {state.datasheets.map(ds => (
            <View key={ds.id} style={styles.dsRow}>
              <View style={styles.dsIcon}>
                <Ionicons name="document-text-outline" size={15} color={colors.red400} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dsName} numberOfLines={1}>{ds.name}</Text>
                <Text style={styles.dsType}>{ds.fileType}</Text>
              </View>
              <TouchableOpacity onPress={() => removeDs(ds.id)} style={{ padding: 4 }}>
                <Ionicons name="trash-outline" size={13} color={colors.gray500} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Links tab */}
      {tab === 'links' && (
        <View style={styles.tabContent}>
          <Input label="Heading" value={(state as any).linkHeading || ''} onChangeText={v => update({ linkHeading: v } as any)} placeholder="Product Articles" />
          <Textarea label="Description" value={(state as any).linkDescription || ''} onChangeText={v => update({ linkDescription: v } as any)} placeholder="Description for article links" numberOfLines={3} />
          <Text style={styles.emptyText}>Link management is enabled. Add/edit URLs in product referenceLinks data.</Text>
        </View>
      )}

    </View>
  );
}

const createStyles = (colors: typeof import('../../theme/colors').colors) => StyleSheet.create({
  tabBar: {
    flexDirection: 'row', backgroundColor: colors.bg800,
    padding: 4, borderRadius: 12, marginBottom: 14, gap: 4,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 4,
    paddingVertical: 8, borderRadius: 8,
  },
  tabLabel: { fontSize: 11, color: colors.gray400, fontWeight: '500' },
  tabLabelActive: { color: colors.white },
  tabContent: { gap: 12 },
  fieldLabel: { fontSize: 13, color: colors.gray400, fontWeight: '500', marginBottom: 4 },
  imageRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  imagePreview: { width: 72, height: 72, borderRadius: 12, backgroundColor: colors.bg700, borderWidth: 1, borderColor: colors.border600 },
  imagePlaceholder: {
    width: 72, height: 72, borderRadius: 12,
    backgroundColor: colors.bg700, borderWidth: 1,
    borderColor: colors.border600, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: colors.bg700, borderRadius: 8, borderWidth: 1, borderColor: colors.border600,
  },
  uploadBtnText: { fontSize: 13, color: colors.white },
  removeText: { fontSize: 12, color: colors.red400 },
  dashedBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderWidth: 1,
    borderColor: colors.border600, borderRadius: 12, borderStyle: 'dashed',
  },
  dashedBtnBlue: { borderColor: colors.blue500_30 },
  dashedBtnText: { fontSize: 13, color: colors.green400 },
  dsHint: { fontSize: 11, color: colors.gray500, textAlign: 'center' },
  emptyText: { fontSize: 13, color: colors.gray500, textAlign: 'center', paddingVertical: 20 },
  cmdForm: {
    padding: 14, backgroundColor: colors.bg800,
    borderWidth: 1, borderColor: colors.green500_30, borderRadius: 12, gap: 10,
  },
  cmdFormTitle: { fontSize: 13, fontWeight: '500', color: colors.green400 },
  cmdFormActions: { flexDirection: 'row', gap: 8 },
  cancelBtn: { flex: 1, paddingVertical: 10, backgroundColor: colors.bg700, borderRadius: 8, alignItems: 'center' },
  cancelText: { fontSize: 13, color: colors.white },
  addCmdBtn: { flex: 1, paddingVertical: 10, backgroundColor: colors.green600, borderRadius: 8, alignItems: 'center' },
  addCmdText: { fontSize: 13, fontWeight: '500', color: colors.white },
  disabledBtn: { opacity: 0.4 },
  cliCard: { backgroundColor: colors.bg800, borderWidth: 1, borderColor: colors.border700, borderRadius: 12, overflow: 'hidden' },
  cliHeader: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  cliLabel: { fontSize: 13, fontWeight: '500', color: colors.white },
  cliDescText: { fontSize: 11, color: colors.gray400, marginTop: 1 },
  cliBody: { borderTopWidth: 1, borderTopColor: colors.border700, backgroundColor: colors.bg950, padding: 12 },
  cliCode: { fontSize: 12, color: '#86efac', fontFamily: 'monospace' },
  dsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, backgroundColor: colors.bg800,
    borderWidth: 1, borderColor: colors.border700, borderRadius: 12,
  },
  dsIcon: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: colors.red500_20, borderWidth: 1,
    borderColor: colors.red500_30, alignItems: 'center', justifyContent: 'center',
  },
  dsName: { fontSize: 13, fontWeight: '500', color: colors.white },
  dsType: { fontSize: 11, color: colors.gray400, marginTop: 1 },
});
