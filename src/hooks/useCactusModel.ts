import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { File, Directory, Paths } from 'expo-file-system';
import { CactusEngineModule as CactusEngine } from '../../modules/cactus-engine';

const MODEL_URL = Platform.OS === 'ios'
  ? 'https://huggingface.co/Cactus-Compute/gemma-4-E2B-it/resolve/main/gemma-4-e2b-it-cq4-apple.zip'
  : 'https://huggingface.co/Cactus-Compute/gemma-4-E2B-it/resolve/main/gemma-4-e2b-it-cq4.zip';
const MODEL_ZIP_NAME = MODEL_URL.split('/').pop()!;
const MODEL_DIR_NAME = MODEL_ZIP_NAME.replace('.zip', '');
const CACTUS_CLOUD_KEY = '';

const modelDir = () => new Directory(Paths.document, MODEL_DIR_NAME);
const zipFile = () => new File(Paths.cache, MODEL_ZIP_NAME);
const isExtracted = () => modelDir().exists && new File(modelDir(), 'config.txt').exists;

const uriToPath = (uri: string) =>
  uri.startsWith('file://') ? decodeURIComponent(uri.slice(7)) : uri;

const wipe = () => {
  if (zipFile().exists) zipFile().delete();
  if (modelDir().exists) modelDir().delete();
};

export function useCactusModel() {
  const [handle, setHandle] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let liveHandle: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        await CactusEngine.setCloudApiKey(CACTUS_CLOUD_KEY).catch(() => {});
        if (modelDir().exists && !isExtracted()) modelDir().delete();
        if (!isExtracted()) return;
        const h = await CactusEngine.init(uriToPath(modelDir().uri), null, false);
        if (cancelled) { CactusEngine.destroy(h).catch(() => {}); return; }
        liveHandle = h;
        setHandle(h);
      } catch (e) {
        if (modelDir().exists) modelDir().delete();
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load model');
      } finally {
        if (!cancelled) setIsInitializing(false);
      }
    })();
    return () => {
      cancelled = true;
      if (liveHandle) CactusEngine.destroy(liveHandle).catch(() => {});
    };
  }, []);

  const download = useCallback(async () => {
    setIsDownloading(true);
    setDownloadProgress(0);
    setError(null);
    try {
      if (modelDir().exists) modelDir().delete();

      if (!zipFile().exists) {
        const dl = LegacyFileSystem.createDownloadResumable(
          MODEL_URL, zipFile().uri, {},
          ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
            if (totalBytesExpectedToWrite > 0) {
              setDownloadProgress(totalBytesWritten / totalBytesExpectedToWrite * 0.95);
            }
          },
        );
        const result = await dl.downloadAsync();
        if (!result) throw new Error('Download failed');
      } else {
        setDownloadProgress(0.95);
      }

      await CactusEngine.unzip(uriToPath(zipFile().uri), uriToPath(Paths.document.uri));
      if (!isExtracted()) throw new Error('Model files missing after extraction');
      zipFile().delete();

      const h = await CactusEngine.init(uriToPath(modelDir().uri), null, false);
      setHandle(h);
      setDownloadProgress(1);
    } catch (e) {
      wipe();
      setError(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setIsDownloading(false);
    }
  }, []);

  return {
    handle,
    isReady: handle !== null,
    isInitializing,
    isDownloading,
    downloadProgress,
    error,
    download,
  };
}
