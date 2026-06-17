import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import Modal from '../../components/Modal';
import ProductEditorContent, { ProductEditorState } from './ProductEditorContent';
import { useAppStore } from '../../store';
import { colors } from '../../theme/colors';

interface Props {
  oemId: string;
  catId: string;
  onClose: () => void;
}

const empty: ProductEditorState = {
  name: '', model: '', description: '', notes: '', image: '',
  cliCommands: [], datasheets: [],
  referenceLinks: [],
};

export default function ProductFormModal({ oemId, catId, onClose }: Props) {
  const store = useAppStore();
  const [editorState, setEditorState] = useState<ProductEditorState>(empty);

  const handleSave = () => {
    if (!editorState.name.trim()) return;
    const prod = store.addProduct(oemId, catId, {
      name: editorState.name,
      model: editorState.model,
      image: editorState.image,
      description: editorState.description,
      notes: editorState.notes,
      referenceLinks: editorState.referenceLinks,
    });
    editorState.datasheets.forEach(ds => store.addDatasheet(oemId, catId, prod.id, ds));
    editorState.cliCommands.forEach(cmd => store.addCLICommand(oemId, catId, prod.id, cmd));
    onClose();
  };

  return (
    <Modal title="Add Product" onClose={onClose} size="xl">
      <ProductEditorContent
        initial={empty}
        onChange={setEditorState}
        accentColor={colors.green600}
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
          <Text style={styles.saveText}>Add Product</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row', gap: 10, marginTop: 20,
    paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border700,
  },
  cancelBtn: { flex: 1, paddingVertical: 12, backgroundColor: colors.bg700, borderRadius: 12, alignItems: 'center' },
  cancelText: { fontSize: 13, fontWeight: '500', color: colors.white },
  saveBtn: { flex: 1, paddingVertical: 12, backgroundColor: colors.green600, borderRadius: 12, alignItems: 'center' },
  saveText: { fontSize: 13, fontWeight: '500', color: colors.white },
  disabled: { opacity: 0.4 },
});
