import { requireNativeModule } from 'expo-modules-core';
import type { EventSubscription } from 'expo-modules-core';

interface CactusEngine {
  cactus_init(modelPath: string): boolean;
  cactus_destroy(): void;
  cactus_reset(): void;
  cactus_stop(): void;
  unzip(zipPath: string, destinationPath: string): Promise<boolean>;
  cactus_complete(messagesJson: string, optionsJson: string | null, pcmBase64: string | null): Promise<string>;
  addListener(eventName: string, listener: (...args: any[]) => void): EventSubscription;
}

export default requireNativeModule<CactusEngine>('CactusEngine');
