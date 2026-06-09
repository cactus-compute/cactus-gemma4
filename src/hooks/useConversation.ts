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

const SYSTEM_PROMPT = `You are a helpful visual assistant. Describe what you see in the photo or answer questions about it concisely and concretely.`;

const uriToPath = (uri: string) =>
  uri.startsWith('file://') ? decodeURIComponent(uri.replace('file://', '')) : uri;

export function useConversation(handle: string, imagePath: string) {
  const [response, setResponse] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastResult, setLastResult] = useState<InferenceResult | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const activeRef = useRef(false);
  const subRef = useRef<EventSubscription | null>(null);

  useEffect(() => {
    return () => {
      subRef.current?.remove();
      subRef.current = null;
      CactusEngine.stop(handle).catch(() => {});
    };
  }, [handle]);

  const sendMessage = useCallback(async (pcmBase64: string | null, text?: string) => {
    if (activeRef.current) return;
    activeRef.current = true;
    setIsGenerating(true);
    setResponse('');
    setLastResult(null);

    const isFirstTurn = messagesRef.current.length === 0;
    const userMsg: ChatMessage = {
      role: 'user',
      content: text ?? (pcmBase64 ? '' : 'Describe what you see.'),
      ...(isFirstTurn ? { images: [uriToPath(imagePath)] } : {}),
    };
    messagesRef.current = [...messagesRef.current, userMsg];

    subRef.current?.remove();
    subRef.current = CactusEngine.addListener('onToken', (e) => {
      setResponse((prev) => prev + e.token);
    });

    try {
      const payload: ChatMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messagesRef.current,
      ];
      const json = await CactusEngine.complete(
        handle, JSON.stringify(payload), OPTIONS, null, pcmBase64, true,
      );
      const result: InferenceResult = JSON.parse(json);
      if (result.response) {
        setResponse(result.response);
        setLastResult(result);
        messagesRef.current = [...messagesRef.current, { role: 'assistant', content: result.response }];
      }
    } catch (e) {
      messagesRef.current = messagesRef.current.slice(0, -1);
      setResponse(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      subRef.current?.remove();
      subRef.current = null;
      activeRef.current = false;
      setIsGenerating(false);
    }
  }, [handle, imagePath]);

  const reset = useCallback(() => {
    subRef.current?.remove();
    subRef.current = null;
    CactusEngine.stop(handle).catch(() => {});
    CactusEngine.reset(handle).catch(() => {});
    messagesRef.current = [];
    activeRef.current = false;
    setResponse('');
    setIsGenerating(false);
    setLastResult(null);
  }, [handle]);

  return { response, isGenerating, lastResult, sendMessage, reset };
}
