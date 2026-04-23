import { useState, useCallback, useEffect, useRef } from 'react';
import {
  useAudioRecorder as useExpoRecorder,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  IOSOutputFormat,
} from 'expo-audio';
import type { RecordingOptions } from 'expo-audio';
import { AppState } from 'react-native';
import { File } from 'expo-file-system';

const RECORDING_OPTIONS: RecordingOptions = {
  extension: '.wav',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 256000,
  ios: {
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: 96,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  android: {
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
  web: {},
};

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef(false);
  const permissionRef = useRef(false);
  const recorder = useExpoRecorder(RECORDING_OPTIONS);

  useEffect(() => {
    requestRecordingPermissionsAsync()
      .then(({ granted }) => { permissionRef.current = granted; })
      .catch(() => { permissionRef.current = false; });
  }, []);

  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recorder.stop().catch(() => {});
      }
    };
  }, [recorder]);

  const startRecording = useCallback(async () => {
    if (!permissionRef.current || recordingRef.current || AppState.currentState !== 'active') return;
    recordingRef.current = true;
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
    } catch {
      recordingRef.current = false;
      try { recorder.stop(); } catch {}
    }
  }, [recorder]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (!recordingRef.current) return null;
    try {
      recordingRef.current = false;
      setIsRecording(false);
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const uri = recorder.uri;
      if (!uri) return null;
      const wavFile = new File(uri);
      const base64 = await wavFile.base64();
      try { wavFile.delete(); } catch {}
      return base64;
    } catch {
      recordingRef.current = false;
      setIsRecording(false);
      try { await setAudioModeAsync({ allowsRecording: false }); } catch {}
      return null;
    }
  }, [recorder]);

  return { isRecording, startRecording, stopRecording };
}
