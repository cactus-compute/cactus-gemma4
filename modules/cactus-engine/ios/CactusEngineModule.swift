import ExpoModulesCore
import cactus

private let RESPONSE_BUFFER_SIZE = 65_536

private func encodeHandle(_ handle: UnsafeMutableRawPointer) -> String {
    String(UInt(bitPattern: handle))
}

private func decodeHandle(_ handle: String) -> UnsafeMutableRawPointer? {
    guard let bits = UInt(handle) else { return nil }
    return UnsafeMutableRawPointer(bitPattern: bits)
}

private func lastError(_ fallback: String) -> String {
    guard let ptr = cactus_get_last_error() else { return fallback }
    return String(cString: ptr)
}

public class CactusEngineModule: Module {
    public func definition() -> ModuleDefinition {
        Name("CactusEngine")

        Events("onToken")

        AsyncFunction("init") { (modelPath: String, corpusDir: String?, cacheIndex: Bool, promise: Promise) in
            guard let handle = cactus_init(modelPath, corpusDir, cacheIndex) else {
                promise.reject("CACTUS_ERROR", lastError("Failed to initialize model"))
                return
            }
            promise.resolve(encodeHandle(handle))
        }

        AsyncFunction("destroy") { (handle: String, promise: Promise) in
            guard let nativeHandle = decodeHandle(handle) else {
                promise.reject("CACTUS_ERROR", "Invalid native handle")
                return
            }
            cactus_destroy(nativeHandle)
            promise.resolve(nil)
        }

        AsyncFunction("reset") { (handle: String, promise: Promise) in
            guard let nativeHandle = decodeHandle(handle) else {
                promise.reject("CACTUS_ERROR", "Invalid native handle")
                return
            }
            cactus_reset(nativeHandle)
            promise.resolve(nil)
        }

        AsyncFunction("stop") { (handle: String, promise: Promise) in
            guard let nativeHandle = decodeHandle(handle) else {
                promise.reject("CACTUS_ERROR", "Invalid native handle")
                return
            }
            cactus_stop(nativeHandle)
            promise.resolve(nil)
        }

        AsyncFunction("setCloudApiKey") { (key: String, promise: Promise) in
            setenv("CACTUS_CLOUD_KEY", key, 1)
            promise.resolve(nil)
        }

        AsyncFunction("unzip") { (zipPath: String, destPath: String, promise: Promise) in
            DispatchQueue.global(qos: .userInitiated).async {
                do {
                    try ZipExtractor.extract(
                        zipURL: URL(fileURLWithPath: zipPath),
                        to: URL(fileURLWithPath: destPath)
                    )
                    promise.resolve(nil)
                } catch {
                    promise.reject("UNZIP_FAILED", error.localizedDescription)
                }
            }
        }

        AsyncFunction("complete") {
            (handle: String, messagesJson: String, optionsJson: String?, toolsJson: String?,
             pcmDataBase64: String?, streamTokens: Bool, promise: Promise) in
            guard let nativeHandle = decodeHandle(handle) else {
                promise.reject("CACTUS_ERROR", "Invalid native handle")
                return
            }

            var buffer = [CChar](repeating: 0, count: RESPONSE_BUFFER_SIZE)
            var callback: cactus_token_callback? = nil
            var userData: UnsafeMutableRawPointer? = nil
            if streamTokens {
                let emitter = Unmanaged.passRetained(self).toOpaque()
                userData = emitter
                callback = { tokenPtr, tokenId, ctx in
                    guard let ctx, let tokenPtr else { return }
                    let module = Unmanaged<CactusEngineModule>.fromOpaque(ctx).takeUnretainedValue()
                    module.sendEvent("onToken", [
                        "token": String(cString: tokenPtr),
                        "tokenId": Int(tokenId),
                    ])
                }
            }

            let pcm = pcmDataBase64.flatMap { Data(base64Encoded: $0) }
            let rc: Int32 = pcm?.withUnsafeBytes { raw in
                cactus_complete(nativeHandle, messagesJson, &buffer, buffer.count,
                                optionsJson, toolsJson, callback, userData,
                                raw.bindMemory(to: UInt8.self).baseAddress, raw.count)
            } ?? cactus_complete(nativeHandle, messagesJson, &buffer, buffer.count,
                                 optionsJson, toolsJson, callback, userData, nil, 0)

            if streamTokens, let userData {
                Unmanaged<CactusEngineModule>.fromOpaque(userData).release()
            }

            guard rc >= 0 else {
                promise.reject("CACTUS_ERROR", lastError("Completion failed"))
                return
            }
            promise.resolve(String(cString: buffer))
        }
    }
}
