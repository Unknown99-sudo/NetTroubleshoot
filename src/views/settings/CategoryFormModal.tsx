import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Modal from '../../components/Modal';
import Input from '../../components/Input';
import { Category } from '../../types';
import { colors, useThemeMode } from '../../theme/colors';

const PRESETS = ['Switch', 'Router', 'Firewall', 'Access Point', 'Server', 'Storage', 'UPS', 'Cable', 'Module', 'Other'];

interface Props {
  initial?: Category;
  onClose: () => void;
  onSave: (name: string) => void;
}

export default function CategoryFormModal({ initial, onClose, onSave }: Props) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  const [name, setName] = useState(initial?.name ?? '');

  return (
    <Modal title={initial ? 'Edit Category' : 'Add Category'} onClose={onClose} size="sm">
      <View style={styles.container}>
        <Text style={styles.label}>Quick select</Text>
        <View style={styles.presets}>
          {PRESETS.map(p => (
            <TouchableOpacity
              key={p}
              onPress={() => setName(p)}
              style={[styles.presetBtn, name === p && styles.presetBtnActive]}
            >
              <Text style={[styles.presetText, name === p && styles.presetTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Input
          label="Category Name *"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Switch, Router, Firewall..."
        />

        <View style={styles.actions}>
          <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { if (name.trim()) onSave(name.trim()); }}
            disabled={!name.trim()}
            style={[styles.saveBtn, !name.trim() && styles.saveBtnDisabled]}
          >
            <Text style={styles.saveText}>{initial ? 'Save Changes' : 'Add Category'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: typeof import('../../theme/colors').colors) => StyleSheet.create({
  container: { gap: 14 },
  label: { fontSize: 11, color: colors.gray400, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 1 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  presetBtn: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1,
    backgroundColor: colors.bg700, borderColor: colors.border600,
  },
  presetBtnActive: { backgroundColor: colors.purple600, borderColor: colors.purple500 },
  presetText: { fontSize: 12, fontWeight: '500', color: colors.gray300 },
  presetTextActive: { color: colors.white },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  cancelBtn: {
    flex: 1, paddingVertical: 12, backgroundColor: colors.bg700,
    borderRadius: 12, alignItems: 'center',
  },
  cancelText: { fontSize: 13, fontWeight: '500', color: colors.white },
  saveBtn: {
    flex: 1, paddingVertical: 12, backgroundColor: colors.purple600,
    borderRadius: 12, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveText: { fontSize: 13, fontWeight: '500', color: colors.white },
});
