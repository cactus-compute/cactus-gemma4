import { useState, useCallback, useEffect, useRef } from 'react';
import type { EventSubscription } from 'expo-modules-core';
import { CactusEngineModule as CactusEngine } from '../../modules/cactus-engine';
import type { ChatMessage, InferenceResult } from '../utils/types';

const OPTIONS = JSON.stringify({
  temperature: 0.7,
  top_p: 0.95,
  top_k: 64,
  max_tokens: 1024,
  confidence_threshold: 0.92,
  auto_handoff: true,
  handoff_with_images: true,
  cloud_timeout_ms: 10000,
});

const SYSTEM_PROMPT = `You are a helpful visual assistant in a live camera demo showcasing Gemma 4's multimodal capabilities. You are receiving a frame from the device's live camera feed. Answer questions about what you see in the image naturally and concisely. If given a voice or text question, address it directly in relation to the current scene.`;

const uriToPath = (uri: string) =>
  uri.startsWith('file://') ? decodeURIComponent(uri.replace('file://', '')) : uri;

export function useLiveCameraConversation(handle: string) {
  const [response, setResponse] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastResult, setLastResult] = useState<InferenceResult | null>(null);
  const activeRef = useRef(false);
  const subRef = useRef<EventSubscription | null>(null);

  useEffect(() => {
    return () => {
      subRef.current?.remove();
      subRef.current = null;
      CactusEngine.stop(handle).catch(() => {});
    };
  }, [handle]);

  const sendMessage = useCallback(async (pcmBase64: string | null, frameUri: string, text?: string) => {
    if (activeRef.current) return;
    activeRef.current = true;
    setIsGenerating(true);
    setResponse('');
    setLastResult(null);

    await CactusEngine.reset(handle).catch(() => {});

    subRef.current?.remove();
    subRef.current = CactusEngine.addListener('onToken', (e) => {
      setResponse((prev) => prev + e.token);
    });

    try {
      const payload: ChatMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text ?? (pcmBase64 ? '' : 'Describe what you see.'), images: [uriToPath(frameUri)] },
      ];
      const json = await CactusEngine.complete(
        handle, JSON.stringify(payload), OPTIONS, null, pcmBase64, true,
      );
      const result: InferenceResult = JSON.parse(json);
      if (result.response) {
        setResponse(result.response);
        setLastResult(result);
      }
    } catch (e) {
      setResponse(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      subRef.current?.remove();
      subRef.current = null;
      activeRef.current = false;
      setIsGenerating(false);
    }
  }, [handle]);

  const stop = useCallback(() => {
    subRef.current?.remove();
    subRef.current = null;
    CactusEngine.stop(handle).catch(() => {});
    activeRef.current = false;
    setResponse('');
    setIsGenerating(false);
    setLastResult(null);
  }, [handle]);

  return { response, isGenerating, lastResult, sendMessage, stop };
}
