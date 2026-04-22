import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { DownloadScreen } from './src/screens/DownloadScreen';
import { CameraScreen } from './src/screens/CameraScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { useCactusModel } from './src/hooks/useCactusModel';

export default function App() {
  const model = useCactusModel();
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const screen = !model.isReady ? 'download' : photoUri ? 'chat' : 'camera';

  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <View style={styles.container}>
          <StatusBar style="light" />
          {screen === 'download' && (
            <DownloadScreen
              isDownloading={model.isDownloading}
              isInitializing={model.isInitializing}
              downloadProgress={model.downloadProgress}
              error={model.error}
              onDownload={model.download}
            />
          )}
          {screen === 'camera' && (
            <CameraScreen onPhotoTaken={setPhotoUri} />
          )}
          {screen === 'chat' && (
            <ChatScreen photoUri={photoUri!} onReset={() => setPhotoUri(null)} />
          )}
        </View>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
