import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import Modal from '../../components/Modal';
import ProductEditorContent, { ProductEditorState } from './ProductEditorContent';
import { useAppStore } from '../../store';
import { Product } from '../../types';
import { colors, useThemeMode } from '../../theme/colors';

interface Props {
  oemId: string;
  catId: string;
  product: Product;
  onClose: () => void;
}

export default function ProductEditModal({ oemId, catId, product, onClose }: Props) {
  const store = useAppStore();
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  const initial: ProductEditorState = {
    name: product.name,
    model: product.model,
    description: product.description,
    notes: product.notes,
    image: product.image,
    cliCommands: [...product.cliCommands],
    datasheets: [...product.datasheets],
    referenceLinks: [...(product.referenceLinks || [])],
  };
  const [editorState, setEditorState] = useState<ProductEditorState>(initial);

  const handleSave = () => {
    if (!editorState.name.trim()) return;
    store.updateProduct(oemId, catId, product.id, {
      name: editorState.name,
      model: editorState.model,
      image: editorState.image,
      description: editorState.description,
      notes: editorState.notes,
      cliCommands: editorState.cliCommands,
      datasheets: editorState.datasheets,
      referenceLinks: editorState.referenceLinks,
    });
    onClose();
  };

  return (
    <Modal title={`Edit: ${product.name}`} onClose={onClose} size="xl">
      <ProductEditorContent
        initial={initial}
        onChange={setEditorState}
        accentColor={colors.blue600}
      />
      <View style={styles.footer}>
        <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleSave}
          disabled={!editorState.name.trim()}
          style={[styles.saveBtn, !editorState.name.trim() && styles.disabled]}
        >
          <Text style={styles.saveText}>Save Changes</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const createStyles = (colors: typeof import('../../theme/colors').colors) => StyleSheet.create({
  footer: {
    flexDirection: 'row', gap: 10, marginTop: 20,
    paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border700,
  },
  cancelBtn: { flex: 1, paddingVertical: 12, backgroundColor: colors.bg700, borderRadius: 12, alignItems: 'center' },
  cancelText: { fontSize: 13, fontWeight: '500', color: colors.white },
  saveBtn: { flex: 1, paddingVertical: 12, backgroundColor: colors.blue600, borderRadius: 12, alignItems: 'center' },
  saveText: { fontSize: 13, fontWeight: '500', color: colors.white },
  disabled: { opacity: 0.4 },
});
