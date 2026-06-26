import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeMode } from '../theme/colors';

interface BadgeProps {
  label: string;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray' | 'cyan';
}

export default function Badge({ label, color = 'blue' }: BadgeProps) {
  const theme = useThemeMode();
  const badgeColors: Record<NonNullable<BadgeProps['color']>, { bg: string; text: string; border: string }> = {
    blue: { bg: theme.colors.blue500_20, text: theme.colors.blue400, border: theme.colors.blue500_30 },
    green: { bg: theme.colors.green500_20, text: theme.colors.green400, border: theme.colors.green500_30 },
    yellow: { bg: theme.colors.yellow500_20, text: theme.colors.yellow400, border: theme.colors.yellow500_30 },
    red: { bg: theme.colors.red500_20, text: theme.colors.red400, border: theme.colors.red500_30 },
    purple: { bg: theme.colors.purple500_20, text: theme.colors.purple400, border: theme.colors.purple500_30 },
    gray: { bg: theme.colors.bg700_20, text: theme.colors.gray300, border: theme.colors.border700 },
    cyan: { bg: 'rgba(34,211,238,0.2)', text: theme.colors.cyan400, border: 'rgba(34,211,238,0.3)' },
  };
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
