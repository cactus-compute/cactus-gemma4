import React from 'react';
import { View, Text, Image, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface DownloadScreenProps {
  isDownloading: boolean;
  isInitializing: boolean;
  downloadProgress: number;
  error: string | null;
  onDownload: () => void;
}

export function DownloadScreen({
  isDownloading,
  isInitializing,
  downloadProgress,
  error,
  onDownload,
}: DownloadScreenProps) {
  const insets = useSafeAreaInsets();
  const percent = Math.round(downloadProgress * 100);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logos}>
          <Image source={require('../../assets/gemma-logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.times}>×</Text>
          <Image source={require('../../assets/cactus-logo.png')} style={styles.logo} resizeMode="contain" />
        </View>

        <Text style={styles.title}>Gemma 4 & Cactus</Text>
        <Text style={styles.subtitle}>On-device multimodal AI</Text>

        <View style={styles.action}>
          {isInitializing ? (
            <>
              <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
              <Text style={styles.status}>Loading model…</Text>
            </>
          ) : isDownloading ? (
            <>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${percent}%` }]} />
              </View>
              <Text style={styles.status}>{percent}%</Text>
            </>
          ) : (
            <>
              {error && <Text style={styles.error}>{error}</Text>}
              <Pressable
                style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}
                onPress={onDownload}
              >
                <Text style={styles.buttonLabel}>Download Model</Text>
              </Pressable>
              <Text style={styles.size}>4 GB</Text>
            </>
          )}
        </View>
      </View>

      <Text style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        Powered by Cactus
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    alignSelf: 'stretch',
    paddingHorizontal: '12%',
  },
  logos: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 80,
    height: 80,
  },
  times: {
    fontSize: 24,
    color: 'rgba(255,255,255,0.4)',
    marginHorizontal: 20,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 17,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 6,
    marginBottom: 48,
  },
  action: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  status: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 14,
  },
  track: {
    alignSelf: 'stretch',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  error: {
    fontSize: 14,
    color: '#ff453a',
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#fff',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 24,
  },
  buttonLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  size: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.25)',
    marginTop: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    fontSize: 12,
    color: 'rgba(255,255,255,0.15)',
  },
});
