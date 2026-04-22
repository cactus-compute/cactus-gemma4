import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const DEPTH = 60;
const DURATION = 1500;

export function ProcessingGlow({ visible }: { visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: DURATION, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: DURATION, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [visible]);

  if (!visible) return null;

  const white = 'rgba(255,255,255,0.35)';
  const clear = 'rgba(255,255,255,0)';

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      <LinearGradient colors={[white, clear]} style={styles.top} />
      <LinearGradient colors={[clear, white]} style={styles.bottom} />
      <LinearGradient colors={[white, clear]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.left} />
      <LinearGradient colors={[clear, white]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.right} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: DEPTH,
  },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: DEPTH,
  },
  left: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: DEPTH,
  },
  right: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: DEPTH,
  },
});
