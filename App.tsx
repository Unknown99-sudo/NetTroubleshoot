import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator, TextInput
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from './src/store';
import HomeView from './src/views/HomeView';
import FavoritesView from './src/views/FavoritesView';
import SettingsView from './src/views/settings/SettingsView';
import { colors } from './src/theme/colors';

type Tab = 'home' | 'favorites' | 'settings';

function AppInner() {
  const [tab, setTab] = useState<Tab>('home');
  const [search, setSearch] = useState('');
  const insets = useSafeAreaInsets();
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

      {/* Search bar (replaces old branding header) */}
      <View style={styles.searchHeader}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color={colors.gray400} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search OEMs, products, models, commands…"
            placeholderTextColor={colors.gray500}
            style={styles.searchInput}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={colors.gray500} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Main content */}
      <View style={styles.content}>
        {tab === 'home' && <HomeView search={search} />}
        {tab === 'favorites' && <FavoritesView search={search} />}
        {tab === 'settings' && <SettingsView search={search} />}
      </View>

      {/* Bottom tab bar — reserves its own space so content never sits
          underneath it or behind the on-screen nav buttons */}
      <View style={[styles.bottomTabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {tabs.map(t => {
          const isActive = tab === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              onPress={() => setTab(t.id)}
              style={styles.tabBtn}
            >
              {isActive && <View style={styles.activeBar} />}
              <View style={{ position: 'relative' }}>
                <Ionicons
                  name={(isActive ? t.activeIcon : t.icon) as any}
                  size={21}
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
            </TouchableOpacity>
          );
        })}
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
  searchHeader: {
    backgroundColor: colors.bg900,
    borderBottomWidth: 1,
    borderBottomColor: colors.border800,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.bg800,
    borderWidth: 1,
    borderColor: colors.border700,
    borderRadius: 12,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.white, padding: 0 },
  content: { flex: 1 },
  bottomTabBar: {
    flexDirection: 'row',
    backgroundColor: colors.bg900,
    borderTopWidth: 1,
    borderTopColor: colors.border800,
    paddingTop: 8,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    gap: 3,
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
    top: -8,
    width: 28,
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.blue400,
    alignSelf: 'center',
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
});
