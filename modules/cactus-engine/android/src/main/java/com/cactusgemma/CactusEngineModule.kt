package com.cactusgemma

import android.system.Os
import android.util.Base64
import com.cactus.CactusJNI
import com.cactus.CactusTokenCallback
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileOutputStream
import java.util.zip.ZipInputStream

private const val RESPONSE_BUFFER_SIZE = 65_536

private fun parseHandle(handle: String, promise: Promise): Long? {
    val parsed = handle.toLongOrNull()
    if (parsed == null) promise.reject("CACTUS_ERROR", "Invalid native handle", null)
    return parsed
}

private fun fail(promise: Promise, fallback: String) {
    val message = CactusJNI.nativeGetLastError().ifEmpty { fallback }
    promise.reject("CACTUS_ERROR", message, null)
}

private fun decodeNullTerminatedUtf8(buffer: ByteArray): String {
    val end = buffer.indexOf(0).let { if (it >= 0) it else buffer.size }
    return buffer.copyOf(end).toString(Charsets.UTF_8)
}

private fun decodeBase64OrNull(value: String?): ByteArray? =
    if (value == null) null else Base64.decode(value, Base64.DEFAULT)

class CactusEngineModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("CactusEngine")

        Events("onToken")

        AsyncFunction("init") { modelPath: String, corpusDir: String?, cacheIndex: Boolean, promise: Promise ->
            val handle = CactusJNI.nativeInit(modelPath, corpusDir, cacheIndex)
            if (handle == 0L) {
                fail(promise, "Failed to initialize model")
                return@AsyncFunction
            }
            promise.resolve(handle.toString())
        }

        AsyncFunction("destroy") { handle: String, promise: Promise ->
            val nativeHandle = parseHandle(handle, promise) ?: return@AsyncFunction
            CactusJNI.nativeDestroy(nativeHandle)
            promise.resolve(null)
        }

        AsyncFunction("reset") { handle: String, promise: Promise ->
            val nativeHandle = parseHandle(handle, promise) ?: return@AsyncFunction
            CactusJNI.nativeReset(nativeHandle)
            promise.resolve(null)
        }

        AsyncFunction("stop") { handle: String, promise: Promise ->
            val nativeHandle = parseHandle(handle, promise) ?: return@AsyncFunction
            CactusJNI.nativeStop(nativeHandle)
            promise.resolve(null)
        }

        AsyncFunction("setCloudApiKey") { key: String, promise: Promise ->
            Os.setenv("CACTUS_CLOUD_KEY", key, true)
            promise.resolve(null)
        }

        AsyncFunction("unzip") { zipPath: String, destPath: String, promise: Promise ->
            try {
                val dest = File(destPath)
                dest.mkdirs()
                ZipInputStream(File(zipPath).inputStream().buffered()).use { zis ->
                    val buf = ByteArray(8192)
                    generateSequence { zis.nextEntry }.forEach { entry ->
                        val out = File(dest, entry.name)
                        if (!out.canonicalPath.startsWith(dest.canonicalPath) ||
                            "__MACOSX" in entry.name) {
                            zis.closeEntry(); return@forEach
                        }
                        if (entry.isDirectory) {
                            out.mkdirs()
                        } else {
                            out.parentFile?.mkdirs()
                            BufferedOutputStream(FileOutputStream(out)).use { bos ->
                                var len: Int
                                while (zis.read(buf).also { len = it } > 0) bos.write(buf, 0, len)
                            }
                        }
                        zis.closeEntry()
                    }
                }
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("UNZIP_FAILED", e.message, e)
            }
        }

        AsyncFunction("complete") {
            handle: String, messagesJson: String, optionsJson: String?, toolsJson: String?,
            pcmDataBase64: String?, streamTokens: Boolean, promise: Promise ->
            val nativeHandle = parseHandle(handle, promise) ?: return@AsyncFunction
            val callback = if (streamTokens) {
                CactusTokenCallback { token, tokenId ->
                    sendEvent("onToken", mapOf("token" to token, "tokenId" to tokenId))
                }
            } else null

            val buffer = ByteArray(RESPONSE_BUFFER_SIZE)
            val rc = CactusJNI.nativeComplete(
                nativeHandle, messagesJson, buffer, optionsJson, toolsJson,
                callback, decodeBase64OrNull(pcmDataBase64),
            )
            if (rc < 0) {
                fail(promise, "Completion failed")
                return@AsyncFunction
            }
            promise.resolve(decodeNullTerminatedUtf8(buffer))
        }
    }
}
