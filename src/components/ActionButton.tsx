import React, { useRef, useEffect } from 'react';
import { Pressable, View, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ActionButtonProps {
  mode: 'camera' | 'voice';
  isRecording?: boolean;
  isProcessing?: boolean;
  onTap?: () => void;
  onHoldStart?: () => void;
  onHoldEnd?: () => void;
}

export function ActionButton({
  mode,
  isRecording = false,
  isProcessing = false,
  onTap,
  onHoldStart,
  onHoldEnd,
}: ActionButtonProps) {
  const holdingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const handlePressIn = () => {
    holdingRef.current = false;
    if (onHoldStart) {
      timerRef.current = setTimeout(() => {
        holdingRef.current = true;
        onHoldStart();
      }, 200);
    }
  };

  const handlePressOut = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (holdingRef.current) {
      holdingRef.current = false;
      onHoldEnd?.();
    } else {
      onTap?.();
    }
  };

  const isCamera = mode === 'camera';

  return (
    <View style={styles.outer}>
      <Pressable
        style={({ pressed }) => [
          styles.ring,
          isRecording && styles.ringRecording,
          isProcessing && styles.ringProcessing,
          pressed && !isRecording && styles.ringPressed,
        ]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isProcessing}
      >
        <View
          style={[
            styles.fill,
            isCamera && styles.cameraFill,
            !isCamera && styles.voiceFill,
            !isCamera && isRecording && styles.voiceRecording,
          ]}
        >
          {isProcessing && <ActivityIndicator size="small" color="#fff" />}
          {!isProcessing && !isCamera && (
            <Ionicons
              name={isRecording ? 'mic' : 'mic-outline'}
              size={30}
              color="#fff"
            />
          )}
          {!isProcessing && isCamera && <Ionicons name="camera" size={30} color="#000" />}
        </View>
      </Pressable>
    </View>
  );
}

const SIZE = 80;
const RING = 3;

const styles = StyleSheet.create({
  outer: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: RING,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringRecording: {
    borderColor: '#ff453a',
  },
  ringProcessing: {
    borderColor: 'rgba(255,255,255,0.15)',
  },
  ringPressed: {
    opacity: 0.7,
  },
  fill: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraFill: {
    width: SIZE - RING * 2 - 4,
    height: SIZE - RING * 2 - 4,
    borderRadius: (SIZE - RING * 2 - 4) / 2,
    backgroundColor: '#fff',
  },
  voiceFill: {
    width: SIZE - RING * 2 - 4,
    height: SIZE - RING * 2 - 4,
    borderRadius: (SIZE - RING * 2 - 4) / 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  voiceRecording: {
    backgroundColor: '#ff453a',
  },
});
