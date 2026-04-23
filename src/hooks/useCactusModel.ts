import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { File, Directory, Paths } from 'expo-file-system';
import { CactusEngineModule as CactusEngine } from '../../modules/cactus-engine';

const MODEL_URL = Platform.OS === 'ios'
  ? 'https://huggingface.co/Cactus-Compute/gemma-4-E2B-it/resolve/main/weights/gemma-4-e2b-it-int4-apple.zip'
  : 'https://huggingface.co/Cactus-Compute/gemma-4-E2B-it/resolve/main/weights/gemma-4-e2b-it-int4.zip';
const MODEL_ZIP_NAME = MODEL_URL.split('/').pop()!;
const MODEL_DIR_NAME = MODEL_ZIP_NAME.replace('.zip', '');
const MIN_ZIP_SIZE = 3.5 * 1024 * 1024 * 1024;

const getModelDir = () => new Directory(Paths.document, MODEL_DIR_NAME);
const getZipFile = () => new File(Paths.cache, MODEL_ZIP_NAME);
const isExtracted = () => new File(getModelDir(), 'config.txt').exists;

function hasValidZip() {
  const f = getZipFile();
  return f.exists && f.size > MIN_ZIP_SIZE;
}

function deleteZip() {
  const f = getZipFile();
  if (f.exists) f.delete();
}

async function initModel() {
  const ok = await CactusEngine.cactus_init(getModelDir().uri);
  if (!ok) throw new Error('Failed to initialize model');
}

async function extractZip() {
  const modelDir = getModelDir();
  if (modelDir.exists) modelDir.delete();
  await CactusEngine.unzip(getZipFile().uri, modelDir.uri);
  if (!isExtracted()) throw new Error('Extraction completed but config.txt not found');
  deleteZip();
}

export function useCactusModel() {
  const [isReady, setIsReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const downloadRef = useRef<LegacyFileSystem.DownloadResumable | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    busyRef.current = true;
    (async () => {
      setIsInitializing(true);
      setError(null);
      try {
        if (isExtracted()) {
          if (cancelled) return;
          await initModel();
          if (!cancelled) setIsReady(true);
        } else if (hasValidZip()) {
          try {
            await extractZip();
          } catch (e) {
            deleteZip();
            throw e;
          }
          if (cancelled) return;
          await initModel();
          if (!cancelled) setIsReady(true);
        } else {
          deleteZip();
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Setup failed');
      } finally {
        if (!cancelled) setIsInitializing(false);
        busyRef.current = false;
      }
    })();
    return () => {
      cancelled = true;
      downloadRef.current?.pauseAsync().catch(() => {});
      downloadRef.current = null;
      CactusEngine.cactus_destroy();
    };
  }, []);

  const download = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setIsDownloading(true);
    setDownloadProgress(0);
    setError(null);
    try {
      if (isExtracted()) {
        setDownloadProgress(0.95);
      } else {
        if (!hasValidZip()) {
          deleteZip();
          const dl = LegacyFileSystem.createDownloadResumable(
            MODEL_URL, getZipFile().uri, {},
            ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
              if (totalBytesExpectedToWrite > 0)
                setDownloadProgress((totalBytesWritten / totalBytesExpectedToWrite) * 0.95);
            }
          );
          downloadRef.current = dl;
          const result = await dl.downloadAsync();
          if (!result) throw new Error('Download failed');
        }
        setDownloadProgress(0.95);
        try {
          await extractZip();
        } catch (e) {
          deleteZip();
          throw e;
        }
      }
      await initModel();
      setIsReady(true);
      setDownloadProgress(1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setIsDownloading(false);
      downloadRef.current = null;
      busyRef.current = false;
    }
  }, []);

  return {
    isReady,
    isDownloading,
    isInitializing,
    downloadProgress,
    error,
    download,
  };
}
