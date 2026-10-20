import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebShell } from './src/WebShell';
import { OfflineScreen } from './src/OfflineScreen';
import { START_URL } from './src/site';
import type { ShellHandle } from './src/shell-types';

// Keep the splash up until the first page has loaded, so readers never see a blank screen.
SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 300, fade: true });

const PAPER = '#f4f1ea';
// Screenshots only: EXPO_PUBLIC_PREVIEW=offline opens straight on the offline screen.
const PREVIEW_OFFLINE = process.env.EXPO_PUBLIC_PREVIEW === 'offline';

// "rgb(244, 241, 234)" → is it a light colour? Decides dark or light status bar icons.
function isLight(colour: string) {
  const m = colour.match(/\d+(\.\d+)?/g);
  if (!m || m.length < 3) return true;
  const [r, g, b] = m.map(Number);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

function Shell() {
  const insets = useSafeAreaInsets();
  const shell = useRef<ShellHandle>(null);
  const canGoBack = useRef(false);
  const [uri, setUri] = useState(START_URL);
  const [offline, setOffline] = useState(PREVIEW_OFFLINE);
  const [progress, setProgress] = useState(0);
  const [colour, setColour] = useState(PAPER);

  const hideSplash = useCallback(() => { SplashScreen.hide(); }, []);

  // Android back button: go back a page, and only leave the app from the first page.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (offline || !canGoBack.current) return false;
      shell.current?.goBack();
      return true;
    });
    return () => sub.remove();
  }, [offline]);

  // Never leave the splash up for long, even on a very slow connection.
  useEffect(() => {
    const t = setTimeout(hideSplash, 8000);
    return () => clearTimeout(t);
  }, [hideSplash]);

  const goHome = useCallback(() => setUri(`${START_URL}${START_URL.includes('?') ? '&' : '?'}t=${Date.now()}`), []);

  if (offline) {
    return (
      <View style={[styles.fill, { paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: PAPER }]}>
        <StatusBar style="dark" />
        <OfflineScreen onRetry={() => { setOffline(false); setProgress(0); shell.current?.reload(); }} />
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: colour, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style={isLight(colour) ? 'dark' : 'light'} />
      <WebShell
        ref={shell}
        uri={uri}
        onGoHome={goHome}
        onCanGoBack={(v) => { canGoBack.current = v; }}
        onProgress={setProgress}
        onPageColour={setColour}
        onLoaded={hideSplash}
        onFailed={() => { setOffline(true); hideSplash(); }}
      />
      {progress < 1 && <View pointerEvents="none" style={[styles.bar, { top: insets.top, width: `${Math.max(progress, 0.08) * 100}%` }]} />}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Shell />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bar: { position: 'absolute', left: 0, height: 3, backgroundColor: '#0d6b4f', borderTopRightRadius: 3, borderBottomRightRadius: 3, ...(Platform.OS === 'web' ? {} : { elevation: 2 }) },
});
