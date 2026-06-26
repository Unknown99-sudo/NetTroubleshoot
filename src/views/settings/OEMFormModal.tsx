import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Modal from '../../components/Modal';
import Input from '../../components/Input';
import { OEM } from '../../types';
import { pickImageAsBase64 } from '../../utils/imagePicker';
import { colors, useThemeMode } from '../../theme/colors';

interface Props {
  initial?: OEM;
  onClose: () => void;
  onSave: (name: string, logo: string, website: string) => void;
}

export default function OEMFormModal({ initial, onClose, onSave }: Props) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  const [name, setName] = useState(initial?.name ?? '');
  const [website, setWebsite] = useState(initial?.website ?? '');
  const [logo, setLogo] = useState(initial?.logo ?? '');
  const [uploading, setUploading] = useState(false);

  const handleLogoPick = async () => {
    setUploading(true);
    const result = await pickImageAsBase64();
    setUploading(false);
    if (result) setLogo(result);
  };

  return (
    <Modal title={initial ? 'Edit OEM' : 'Add OEM'} onClose={onClose}>
      <View style={styles.container}>
        {/* Logo */}
        <View>
          <Text style={styles.label}>Logo</Text>
          <View style={styles.logoRow}>
            {logo ? (
              <Image source={{ uri: logo }} style={styles.logoPreview} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Ionicons name="business-outline" size={24} color={colors.gray500} />
              </View>
            )}
            <TouchableOpacity onPress={handleLogoPick} style={styles.uploadBtn} disabled={uploading}>
              <Ionicons name="cloud-upload-outline" size={14} color={colors.white} />
              <Text style={styles.uploadBtnText}>{uploading ? 'Loading...' : 'Upload Logo'}</Text>
            </TouchableOpacity>
            {logo ? (
              <TouchableOpacity onPress={() => setLogo('')}>
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <Input
          label="OEM / Manufacturer Name *"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Cisco, Juniper, HP"
        />
        <Input
          label="Website (optional)"
          value={website}
          onChangeText={setWebsite}
          placeholder="https://example.com"
          keyboardType="url"
          autoCapitalize="none"
        />

        <View style={styles.actions}>
          <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { if (name.trim()) onSave(name.trim(), logo, website.trim()); }}
            disabled={!name.trim()}
            style={[styles.saveBtn, !name.trim() && styles.saveBtnDisabled]}
          >
            <Text style={styles.saveText}>{initial ? 'Save Changes' : 'Add OEM'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: typeof import('../../theme/colors').colors) => StyleSheet.create({
  container: { gap: 14 },
  label: { fontSize: 13, color: colors.gray400, fontWeight: '500', marginBottom: 6 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoPreview: { width: 56, height: 56, borderRadius: 12, backgroundColor: colors.bg700, borderWidth: 1, borderColor: colors.border600 },
  logoPlaceholder: {
    width: 56, height: 56, borderRadius: 12,
    backgroundColor: colors.bg700, borderWidth: 1,
    borderColor: colors.border600, alignItems: 'center', justifyContent: 'center',
  },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    backgroundColor: colors.bg700, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border600,
  },
  uploadBtnText: { fontSize: 13, color: colors.white },
  removeText: { fontSize: 12, color: colors.red400 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  cancelBtn: {
    flex: 1, paddingVertical: 12, backgroundColor: colors.bg700,
    borderRadius: 12, alignItems: 'center',
  },
  cancelText: { fontSize: 13, fontWeight: '500', color: colors.white },
  saveBtn: {
    flex: 1, paddingVertical: 12, backgroundColor: colors.blue600,
    borderRadius: 12, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveText: { fontSize: 13, fontWeight: '500', color: colors.white },
});
