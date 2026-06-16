import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { badgeColors } from '../theme/colors';

interface BadgeProps {
  label: string;
  color?: keyof typeof badgeColors;
}

export default function Badge({ label, color = 'blue' }: BadgeProps) {
  const c = badgeColors[color] ?? badgeColors.blue;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[styles.text, { color: c.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
    borderWidth: 1,
  },
  text: {
    fontSize: 11,
    fontWeight: '500',
  },
});
