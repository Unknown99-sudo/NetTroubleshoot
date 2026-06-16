import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from './src/store';
import HomeView from './src/views/HomeView';
import FavoritesView from './src/views/FavoritesView';
import SettingsView from './src/views/settings/SettingsView';
import { colors } from './src/theme/colors';

type Tab = 'home' | 'favorites' | 'settings';

function AppInner() {
  const [tab, setTab] = useState<Tab>('home');
  const store = useAppStore();
  const favCount = store.data.favorites.length;

  if (!store.ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.blue400} />
      </View>
    );
  }

  const tabs: { id: Tab; label: string; icon: string; activeIcon: string }[] = [
    { id: 'home', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
    { id: 'favorites', label: 'Favorites', icon: 'star-outline', activeIcon: 'star' },
    { id: 'settings', label: 'Settings', icon: 'settings-outline', activeIcon: 'settings' },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg900} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.logoIcon}>
            <Ionicons name="git-network-outline" size={18} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.appName}>NetTrouble</Text>
            <Text style={styles.appSubtitle}>Network Troubleshooting</Text>
          </View>
          <View style={styles.activeIndicator}>
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>Active</Text>
          </View>
        </View>

        {/* Tab bar inside header */}
        <View style={styles.tabRow}>
          {tabs.map(t => {
            const isActive = tab === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => setTab(t.id)}
                style={styles.tabBtn}
              >
                <View style={{ position: 'relative' }}>
                  <Ionicons
                    name={(isActive ? t.activeIcon : t.icon) as any}
                    size={20}
                    color={isActive ? colors.blue400 : colors.gray500}
                  />
                  {t.id === 'favorites' && favCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{favCount > 9 ? '9+' : favCount}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {t.label}
                </Text>
                {isActive && <View style={styles.activeBar} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Main content */}
      <View style={styles.content}>
        {tab === 'home' && <HomeView />}
        {tab === 'favorites' && <FavoritesView />}
        {tab === 'settings' && <SettingsView />}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppInner />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg950 },
  loading: { flex: 1, backgroundColor: colors.bg950, alignItems: 'center', justifyContent: 'center' },
  header: {
    backgroundColor: colors.bg900,
    borderBottomWidth: 1,
    borderBottomColor: colors.border800,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.blue500,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.blue500,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  appName: { fontSize: 15, fontWeight: '700', color: colors.white, lineHeight: 18 },
  appSubtitle: { fontSize: 10, color: colors.gray400 },
  activeIndicator: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  activeDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green400,
  },
  activeText: { fontSize: 11, color: colors.gray400 },
  tabRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(55,65,81,0.5)',
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    gap: 2,
    position: 'relative',
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: colors.gray500,
  },
  tabLabelActive: { color: colors.blue400 },
  activeBar: {
    position: 'absolute',
    bottom: 0,
    width: 28,
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.blue400,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.yellow500,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  badgeText: { fontSize: 9, fontWeight: '700', color: '#000' },
  content: { flex: 1 },
});
