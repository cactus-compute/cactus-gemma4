import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Pressable, Text, TextInput, StyleSheet, Keyboard } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import * as Haptics from 'expo-haptics';
import { FontAwesome6 } from '@expo/vector-icons';
import { ActionButton } from '../components/ActionButton';
import { ProcessingGlow } from '../components/ProcessingGlow';
import { ResponseOverlay } from '../components/ResponseOverlay';
import { useLiveCameraConversation } from '../hooks/useLiveCameraConversation';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { colors } from '../utils/colors';

interface LiveCameraScreenProps {
  onClose: () => void;
}

export function LiveCameraScreen({ onClose }: LiveCameraScreenProps) {
  const { response, isGenerating, lastResult, sendMessage, stop } = useLiveCameraConversation();
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const [permission] = useCameraPermissions({ request: true });
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [textInput, setTextInput] = useState('');
  const cameraRef = useRef<CameraView>(null);
  const textInputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();
  const prevDone = useRef(false);

  const inferenceSource: 'device' | 'cloud' = lastResult?.cloud_handoff ? 'cloud' : 'device';
  const hasResponse = !!lastResult && !isGenerating;
  const showHint = !isRecording && !isGenerating && !lastResult && !showKeyboard;

  const stickyOffset = useMemo(() => ({ closed: 0, opened: insets.bottom }), [insets.bottom]);

  useEffect(() => {
    if (hasResponse && !prevDone.current) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    prevDone.current = hasResponse;
  }, [hasResponse]);

  useEffect(() => {
    if (showKeyboard) {
      textInputRef.current?.focus();
    }
  }, [showKeyboard]);

  const captureFrame = async (): Promise<string | null> => {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.5, skipProcessing: true });
    return photo?.uri ?? null;
  };

  const handleHoldStart = () => {
    if (!isGenerating) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      startRecording();
    }
  };

  const handleHoldEnd = async () => {
    const [pcm, frameUri] = await Promise.all([stopRecording(), captureFrame()]);
    if (pcm && frameUri) await sendMessage(pcm, frameUri);
  };

  const handleSendText = async () => {
    const text = textInput.trim();
    if (!text || isGenerating) return;
    setTextInput('');
    setShowKeyboard(false);
    Keyboard.dismiss();
    const frameUri = await captureFrame();
    if (frameUri) await sendMessage(null, frameUri, text);
  };

  const handleCloseKeyboard = () => {
    setShowKeyboard(false);
    Keyboard.dismiss();
  };

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.permissionText}>Camera access is required.{'\n'}Please enable it in Settings.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
      <ProcessingGlow visible={isGenerating && !isRecording && !response} />
      <ResponseOverlay
        text={response}
        visible={!!response}
        source={inferenceSource}
        done={hasResponse}
        bottomOffset={120}
        stats={hasResponse && lastResult.decode_tps > 0
          ? `${lastResult.decode_tps.toFixed(1)} tok/s · ${Math.round(lastResult.time_to_first_token_ms)}ms TTFT`
          : undefined}
      />
      {!showKeyboard && (
        <View style={[styles.controls, { paddingBottom: insets.bottom + 28 }]}>
          <View style={styles.row}>
            <View style={styles.side}>
              <Pressable
                style={({ pressed }) => [styles.circleButton, pressed && { opacity: 0.5 }]}
                onPress={() => { stop(); onClose(); }}
              >
                <FontAwesome6 name="arrow-left" size={18} color="#fff" />
              </Pressable>
            </View>
            <ActionButton
              mode="voice"
              isRecording={isRecording}
              isProcessing={isGenerating}
              onHoldStart={handleHoldStart}
              onHoldEnd={handleHoldEnd}
            />
            <View style={styles.side}>
              <Pressable
                style={({ pressed }) => [styles.circleButton, pressed && { opacity: 0.5 }]}
                onPress={() => setShowKeyboard(true)}
              >
                <FontAwesome6 name="keyboard" size={18} color="#fff" />
              </Pressable>
            </View>
          </View>
        </View>
      )}
      {showKeyboard && (
        <KeyboardStickyView offset={stickyOffset} style={styles.stickyView}>
          <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
            <Pressable
              style={({ pressed }) => [styles.circleButton, pressed && { opacity: 0.5 }]}
              onPress={handleCloseKeyboard}
            >
              <FontAwesome6 name="xmark" size={18} color="#fff" />
            </Pressable>
            <TextInput
              ref={textInputRef}
              style={styles.textInput}
              value={textInput}
              onChangeText={setTextInput}
              placeholder="Ask about what you see..."
              placeholderTextColor={colors.textMuted}
              returnKeyType="send"
              onSubmitEditing={handleSendText}
            />
            <Pressable
              style={({ pressed }) => [styles.sendButton, pressed && { opacity: 0.5 }]}
              onPress={handleSendText}
            >
              <FontAwesome6 name="arrow-up" size={16} color="#000" />
            </Pressable>
          </View>
        </KeyboardStickyView>
      )}
      {showHint && (
        <Text style={[styles.hint, { bottom: insets.bottom }]}>Hold to ask about what you see</Text>
      )}
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
    bottom: 0,
    alignItems: 'center',
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
  circleButton: {
    width: 46,
    aspectRatio: 1,
    borderRadius: 23,
    backgroundColor: colors.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyView: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  textInput: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.glass,
    paddingHorizontal: 16,
    marginLeft: 10,
    color: '#fff',
    fontSize: 15,
  },
  sendButton: {
    width: 36,
    aspectRatio: 1,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  hint: {
    position: 'absolute',
    alignSelf: 'center',
    fontSize: 13,
    color: colors.textHint,
  },
});
