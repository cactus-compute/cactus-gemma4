import { useState, useCallback, useEffect, useRef } from 'react';
import { CactusEngineModule as CactusEngine } from '../../modules/cactus-engine';
import type { ChatMessage, InferenceResult } from '../utils/types';

const OPTIONS = JSON.stringify({
  temperature: 0.7,
  top_p: 0.95,
  top_k: 40,
  max_tokens: 1024,
  stop_sequences: ['<|im_end|>', '<end_of_turn>'],
  confidence_threshold: 0.9,
  auto_handoff: true,
  handoff_with_images: true,
  cloud_timeout_ms: 10000,
});

function uriToPath(uri: string): string {
  return uri.startsWith('file://') ? decodeURIComponent(uri.replace('file://', '')) : uri;
}

// TODO: remove once cactus-compute/cactus stops HTML-encoding token strings.
// The C library encodes <, >, &, ', " as \uXXXX in token callbacks and in the
// JSON response value, causing double-encoding that JSON.parse does not fully undo.
function decodeUnicode(str: string): string {
  return str
    .replace(/\\u003c/gi, '<')
    .replace(/\\u003e/gi, '>')
    .replace(/\\u0026/gi, '&')
    .replace(/\\u0027/gi, "'")
    .replace(/\\u0022/gi, '"');
}

export function useConversation(imagePath: string) {
  const [response, setResponse] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastResult, setLastResult] = useState<InferenceResult | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const listenerRef = useRef<{ remove: () => void } | null>(null);
  const activeRef = useRef(false);
  const generationIdRef = useRef(0);
  const cloudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generationIdRef.current++;
      listenerRef.current?.remove();
      listenerRef.current = null;
      if (cloudTimerRef.current) clearTimeout(cloudTimerRef.current);
      CactusEngine.cactus_stop();
    };
  }, []);

  const sendMessage = useCallback(async (pcmBase64: string | null, text?: string) => {
    if (activeRef.current) return;
    activeRef.current = true;
    const genId = ++generationIdRef.current;
    if (cloudTimerRef.current) clearTimeout(cloudTimerRef.current);
    setIsGenerating(true);
    setResponse('');
    setLastResult(null);

    const userMsg: ChatMessage = {
      role: 'user',
      content: text ?? '',
      ...(messagesRef.current.length === 0 ? { images: [uriToPath(imagePath)] } : {}),
    };
    messagesRef.current = [...messagesRef.current, userMsg];

    listenerRef.current?.remove();

    const payload: ChatMessage[] = [...messagesRef.current];

    // Declare outside try so finally can clean up even if addListener throws.
    let listener: { remove: () => void } | undefined;
    try {
      listener = CactusEngine.addListener('onToken', (e: { token: string }) => {
        if (generationIdRef.current === genId) {
          setResponse(prev => prev + decodeUnicode(e.token));
        }
      });
      listenerRef.current = listener;

      const json = await CactusEngine.cactus_complete(
        JSON.stringify(payload),
        OPTIONS,
        pcmBase64
      );
      if (generationIdRef.current !== genId) return;
      const result: InferenceResult = JSON.parse(json);

      const decoded = result.response ? decodeUnicode(result.response) : '';
      if (result.cloud_handoff && decoded) {
        setLastResult({ ...result, cloud_handoff: false });
        cloudTimerRef.current = setTimeout(() => {
          if (generationIdRef.current !== genId) return;
          setResponse(decoded);
          setLastResult(result);
          messagesRef.current = [...messagesRef.current, { role: 'assistant', content: decoded }];
        }, 1500);
      } else if (decoded) {
        setResponse(decoded);
        setLastResult(result);
        messagesRef.current = [...messagesRef.current, { role: 'assistant', content: decoded }];
      }
    } catch (e: unknown) {
      if (generationIdRef.current !== genId) return;
      messagesRef.current = messagesRef.current.slice(0, -1);
      setResponse(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      listener?.remove();
      if (generationIdRef.current === genId) {
        listenerRef.current = null;
        activeRef.current = false;
        setIsGenerating(false);
      }
    }
  }, [imagePath]);

  const reset = useCallback(() => {
    generationIdRef.current++;
    listenerRef.current?.remove();
    listenerRef.current = null;
    if (cloudTimerRef.current) clearTimeout(cloudTimerRef.current);
    CactusEngine.cactus_stop();
    CactusEngine.cactus_reset();
    messagesRef.current = [];
    activeRef.current = false;
    setResponse('');
    setIsGenerating(false);
    setLastResult(null);
  }, []);

  return { response, isGenerating, lastResult, sendMessage, reset };
}
