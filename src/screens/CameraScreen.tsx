import React, { useRef } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton } from '../components/ActionButton';
import { colors } from '../utils/colors';

interface CameraScreenProps {
  onPhotoTaken: (uri: string) => void;
  onLiveCamera: () => void;
}

export function CameraScreen({ onPhotoTaken, onLiveCamera }: CameraScreenProps) {
  const cameraRef = useRef<CameraView>(null);
  const takingRef = useRef(false);
  const [permission] = useCameraPermissions({ request: true });
  const insets = useSafeAreaInsets();

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.permissionText}>Camera access is required.{'\n'}Please enable it in Settings.</Text>
      </View>
    );
  }

  const takePhoto = async () => {
    if (takingRef.current) return;
    takingRef.current = true;
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) onPhotoTaken(photo.uri);
    } finally {
      takingRef.current = false;
    }
  };

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" selectedLens="builtInWideAngleCamera" />
      <View style={[styles.controls, { bottom: insets.bottom + 28 }]}>
        <View style={styles.row}>
          <View style={styles.side} />
          <ActionButton mode="camera" onTap={takePhoto} />
          <View style={styles.side}>
            <Pressable
              style={({ pressed }) => [styles.liveButton, pressed && { opacity: 0.5 }]}
              onPress={onLiveCamera}
            >
              <Text style={styles.liveLabel}>Live</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { alignItems: 'center', justifyContent: 'center' },
  permissionText: { color: colors.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  side: {
    flex: 1,
    alignItems: 'center',
  },
  liveButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  liveLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
