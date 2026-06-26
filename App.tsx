import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator, TextInput, BackHandler
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from './src/store';
import HomeView from './src/views/HomeView';
import FavoritesView from './src/views/FavoritesView';
import ToolsView from './src/views/ToolsView';
import SettingsView from './src/views/settings/SettingsView';
import { colors, useThemeMode } from './src/theme/colors';

type Tab = 'home' | 'favorites' | 'tools' | 'settings';

function AppInner() {
  const [tab, setTab] = useState<Tab>('home');
  const [search, setSearch] = useState('');
  const [toolsBackTick, setToolsBackTick] = useState(0);
  const insets = useSafeAreaInsets();
  const store = useAppStore();
  const favCount = store.data.favorites.length;
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  const isLight = theme.mode === 'light';

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (tab === 'tools') {
        setToolsBackTick(tick => tick + 1);
        return true;
      }
      if (tab !== 'home') {
        setTab('home');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [tab]);

  if (!store.ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={theme.colors.blue400} />
      </View>
    );
  }

  const tabs: { id: Tab; label: string; icon: string; activeIcon: string }[] = [
    { id: 'home', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
    { id: 'favorites', label: 'Favorites', icon: 'star-outline', activeIcon: 'star' },
    { id: 'tools', label: 'Tools', icon: 'construct-outline', activeIcon: 'construct' },
    { id: 'settings', label: 'Settings', icon: 'settings-outline', activeIcon: 'settings' },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} backgroundColor={theme.colors.bg900} />

      {/* Search bar (replaces old branding header) */}
      <View style={styles.searchHeader}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={15} color={theme.colors.gray400} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search OEMs, products, models, commands…"
            placeholderTextColor={theme.colors.gray500}
            style={styles.searchInput}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={15} color={theme.colors.gray500} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          onPress={theme.toggleTheme}
          style={styles.themeToggle}
          accessibilityRole="button"
          accessibilityLabel={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          <Ionicons
            name={isLight ? 'moon-outline' : 'sunny-outline'}
            size={18}
            color={isLight ? '#2563eb' : '#facc15'}
          />
        </TouchableOpacity>
      </View>

      {/* Main content */}
      <View style={styles.content}>
        {tab === 'home' && <HomeView search={search} />}
        {tab === 'favorites' && <FavoritesView search={search} />}
        {tab === 'tools' && <ToolsView search={search} backTick={toolsBackTick} onRootBack={() => setTab('home')} />}
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
                  color={isActive ? '#60a5fa' : '#6b7280'}
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

const createStyles = (colors: typeof import('./src/theme/colors').colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg950 },
  loading: { flex: 1, backgroundColor: colors.bg950, alignItems: 'center', justifyContent: 'center' },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.bg900,
    borderBottomWidth: 1,
    borderBottomColor: colors.border800,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.bg800,
    borderWidth: 1,
    borderColor: colors.border700,
    borderRadius: 10,
    gap: 7,
  },
  searchInput: { flex: 1, fontSize: 12, color: colors.white, padding: 0 },
  themeToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg800,
    borderWidth: 1,
    borderColor: colors.border700,
  },
  content: { flex: 1 },
  bottomTabBar: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
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
    color: '#6b7280',
  },
  tabLabelActive: { color: '#60a5fa' },
  activeBar: {
    position: 'absolute',
    top: -8,
    width: 28,
    height: 2,
    borderRadius: 2,
    backgroundColor: '#60a5fa',
    alignSelf: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#eab308',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  badgeText: { fontSize: 9, fontWeight: '700', color: '#000' },
});
