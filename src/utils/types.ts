export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: string[];
}

export interface InferenceResult {
  success: boolean;
  error: string | null;
  response: string;
  cloud_handoff: boolean;
  confidence: number;
  time_to_first_token_ms: number;
  total_time_ms: number;
  prefill_tps: number;
  decode_tps: number;
  prefill_tokens: number;
  decode_tokens: number;
  total_tokens: number;
  ram_usage_mb: number;
  function_calls: string[];
  thinking?: string;
}
