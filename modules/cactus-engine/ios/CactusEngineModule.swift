import ExpoModulesCore
import CactusFFI

private func pathFromUri(_ uri: String) -> String {
    URL(string: uri)?.path ?? uri
}

private class TokenCallbackContext {
    let emit: (String, [String: Any]) -> Void
    init(_ emit: @escaping (String, [String: Any]) -> Void) { self.emit = emit }
}

private func tokenCallbackBridge(token: UnsafePointer<CChar>?, tokenId: UInt32, userData: UnsafeMutableRawPointer?) {
    guard let token, let userData else { return }
    let ctx = Unmanaged<TokenCallbackContext>.fromOpaque(userData).takeUnretainedValue()
    ctx.emit("onToken", ["token": String(cString: token), "tokenId": Int(tokenId)])
}

private let inferenceQueue = DispatchQueue(label: "com.cactusgemma.inference", qos: .userInitiated)

private let _telemetryOnce: Void = {
    setenv("CACTUS_CLOUD_KEY", "cactus_live_158e83176124c7a50a1d3066e51e72bf", 1)
    cactus_set_telemetry_environment("cactus-gemma-demo-app", nil, nil)
    Bundle.main.bundleIdentifier?.withCString { cactus_set_app_id($0) }
}()

public class CactusEngineModule: Module {
    private var model: UnsafeMutableRawPointer?

    private static func stripWavHeader(_ data: Data) -> Data {
        guard data.count > 12,
              data[0] == 0x52, data[1] == 0x49, data[2] == 0x46, data[3] == 0x46 else { return data }
        var offset = 12
        while offset + 8 <= data.count {
            let id = data[offset..<offset+4]
            let size = data[offset+4..<offset+8].withUnsafeBytes { $0.loadUnaligned(as: UInt32.self).littleEndian }
            if id.elementsEqual([0x64, 0x61, 0x74, 0x61]) {
                let start = offset + 8
                return data.subdata(in: start..<min(start + Int(size), data.count))
            }
            let paddedSize = (Int(size) + 1) & ~1
            offset += 8 + paddedSize
        }
        return data
    }

    public func definition() -> ModuleDefinition {
        Name("CactusEngine")

        Events("onToken", "onComplete", "onError")

        OnDestroy {
            if let m = self.model {
                cactus_destroy(m)
                self.model = nil
            }
        }

        AsyncFunction("cactus_init") { (modelPath: String, promise: Promise) in
            _ = _telemetryOnce
            inferenceQueue.async {
                if let old = self.model { cactus_destroy(old); self.model = nil }
                let path = pathFromUri(modelPath)
                guard let handle = cactus_init(path, nil, false) else {
                    promise.resolve(false)
                    return
                }
                self.model = handle
                promise.resolve(true)
            }
        }

        Function("cactus_destroy") {
            guard let m = self.model else { return }
            cactus_destroy(m)
            self.model = nil
        }

        Function("cactus_reset") {
            guard let m = self.model else { return }
            cactus_reset(m)
        }

        Function("cactus_stop") {
            guard let m = self.model else { return }
            cactus_stop(m)
        }

        AsyncFunction("unzip") { (zipPath: String, destPath: String, promise: Promise) in
            DispatchQueue.global(qos: .userInitiated).async {
                do {
                    try ZipExtractor.extract(
                        zipURL: URL(fileURLWithPath: pathFromUri(zipPath)),
                        to: URL(fileURLWithPath: pathFromUri(destPath))
                    )
                    promise.resolve(true)
                } catch {
                    promise.reject("UNZIP_FAILED", error.localizedDescription)
                }
            }
        }

        AsyncFunction("cactus_complete") { (messagesJson: String, optionsJson: String?, pcmBase64: String?, promise: Promise) in
            guard let m = self.model else {
                promise.reject("MODEL_NOT_LOADED", "Call cactus_init() first")
                return
            }

            inferenceQueue.async {
                let bufSize = 65536
                let buf = UnsafeMutablePointer<CChar>.allocate(capacity: bufSize)
                buf.initialize(repeating: 0, count: bufSize)
                defer { buf.deallocate() }

                let ctx = TokenCallbackContext { [weak self] in self?.sendEvent($0, $1) }
                let ctxPtr = Unmanaged.passRetained(ctx).toOpaque()
                defer { Unmanaged<TokenCallbackContext>.fromOpaque(ctxPtr).release() }

                let pcm = pcmBase64.flatMap { Data(base64Encoded: $0) }.map { Self.stripWavHeader($0) }
                let rc: Int32

                if let pcm {
                    rc = pcm.withUnsafeBytes {
                        cactus_complete(m, messagesJson, buf, bufSize, optionsJson, nil,
                                        tokenCallbackBridge, ctxPtr,
                                        $0.baseAddress?.assumingMemoryBound(to: UInt8.self), pcm.count)
                    }
                } else {
                    rc = cactus_complete(m, messagesJson, buf, bufSize, optionsJson, nil,
                                         tokenCallbackBridge, ctxPtr, nil, 0)
                }

                let response = String(cString: buf)
                if rc >= 0 {
                    self.sendEvent("onComplete", ["response": response])
                    promise.resolve(response)
                } else {
                    let err = String(cString: cactus_get_last_error())
                    self.sendEvent("onError", ["message": err])
                    promise.reject("INFERENCE_FAILED", err)
                }
            }
        }
    }
}
