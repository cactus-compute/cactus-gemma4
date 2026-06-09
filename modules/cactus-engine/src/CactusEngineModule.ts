import { requireNativeModule } from 'expo-modules-core';
import type { EventSubscription } from 'expo-modules-core';

export type TokenEvent = { token: string; tokenId: number };

interface CactusEngine {
  init(modelPath: string, corpusDir: string | null, cacheIndex: boolean): Promise<string>;
  destroy(handle: string): Promise<void>;
  reset(handle: string): Promise<void>;
  stop(handle: string): Promise<void>;
  complete(
    handle: string,
    messagesJson: string,
    optionsJson: string | null,
    toolsJson: string | null,
    pcmDataBase64: string | null,
    streamTokens: boolean,
  ): Promise<string>;
  unzip(zipPath: string, destPath: string): Promise<void>;
  setCloudApiKey(key: string): Promise<void>;
  addListener(eventName: 'onToken', listener: (event: TokenEvent) => void): EventSubscription;
}

export default requireNativeModule<CactusEngine>('CactusEngine');
