import React, { useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton } from '../components/ActionButton';

interface CameraScreenProps {
  onPhotoTaken: (uri: string) => void;
}

export function CameraScreen({ onPhotoTaken }: CameraScreenProps) {
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
        <ActionButton mode="camera" onTap={takePhoto} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { alignItems: 'center', justifyContent: 'center' },
  permissionText: { color: 'rgba(255,255,255,0.6)', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
