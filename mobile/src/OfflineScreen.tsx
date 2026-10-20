import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = { onRetry: () => void };

// Shown when the library can't be reached (no connection, or the site is down).
export function OfflineScreen({ onRetry }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.badge}>
        <Image source={require('../assets/logo-mark.png')} style={styles.logo} resizeMode="contain" />
      </View>
      <Text style={styles.kicker}>OMT RESOURCES</Text>
      <Text style={styles.title}>You're offline</Text>
      <Text style={styles.body}>Connect to Wi-Fi or mobile data to open the library. Your saved books will be here when you're back.</Text>
      <Pressable onPress={onRetry} style={({ pressed }) => [styles.button, pressed && styles.pressed]} accessibilityRole="button">
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#f4f1ea' },
  badge: { width: 112, height: 112, borderRadius: 32, backgroundColor: '#0b1530', alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  logo: { width: 76, height: 60 },
  kicker: { fontSize: 12, letterSpacing: 2.4, color: '#0d6b4f', fontWeight: '600', marginBottom: 10 },
  title: { fontSize: 28, fontWeight: '700', color: '#1c1b18', marginBottom: 12 },
  body: { fontSize: 16, lineHeight: 24, color: '#5e594f', textAlign: 'center', maxWidth: 320, marginBottom: 28 },
  button: { backgroundColor: '#0d6b4f', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 999 },
  pressed: { backgroundColor: '#0a5440' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
