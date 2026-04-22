package com.cactusgemma

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import android.util.Base64
import java.io.BufferedOutputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.zip.ZipInputStream

interface TokenCallback {
    fun onToken(token: String, tokenId: Int)
}

private fun decodeAudioToPcm(data: ByteArray, context: android.content.Context): ByteArray {
    val tmp = File.createTempFile("audio", ".m4a", context.cacheDir)
    try {
        tmp.writeBytes(data)
        val extractor = MediaExtractor()
        var codec: MediaCodec? = null
        try {
            extractor.setDataSource(tmp.absolutePath)
            val trackIndex = (0 until extractor.trackCount).firstOrNull {
                extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
            } ?: return data
            extractor.selectTrack(trackIndex)
            val format = extractor.getTrackFormat(trackIndex)
            val mime = format.getString(MediaFormat.KEY_MIME) ?: return data
            val sampleRate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
            val channels = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)

            codec = MediaCodec.createDecoderByType(mime)
            codec.configure(format, null, null, 0)
            codec.start()

            val out = ByteArrayOutputStream()
            val info = MediaCodec.BufferInfo()
            var inputEos = false
            var outputEos = false

            while (!outputEos) {
                if (!inputEos) {
                    val inIdx = codec.dequeueInputBuffer(10000)
                    if (inIdx >= 0) {
                        val buf = codec.getInputBuffer(inIdx)!!
                        val read = extractor.readSampleData(buf, 0)
                        if (read < 0) {
                            codec.queueInputBuffer(inIdx, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                            inputEos = true
                        } else {
                            codec.queueInputBuffer(inIdx, 0, read, extractor.sampleTime, 0)
                            extractor.advance()
                        }
                    }
                }
                var outIdx = codec.dequeueOutputBuffer(info, 10000)
                while (outIdx >= 0) {
                    if (info.size > 0) {
                        val outBuf = codec.getOutputBuffer(outIdx)!!
                        val chunk = ByteArray(info.size)
                        outBuf.get(chunk)
                        out.write(chunk)
                    }
                    codec.releaseOutputBuffer(outIdx, false)
                    if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
                        outputEos = true
                        break
                    }
                    outIdx = codec.dequeueOutputBuffer(info, 0)
                }
            }

            var pcm = out.toByteArray()
            if (channels > 1) pcm = monoMix(pcm, channels)
            if (sampleRate != 16000) pcm = resample(pcm, sampleRate, 16000)
            return pcm
        } finally {
            codec?.stop()
            codec?.release()
            extractor.release()
        }
    } finally {
        tmp.delete()
    }
}

private fun monoMix(data: ByteArray, channels: Int): ByteArray {
    val samples = data.size / (2 * channels)
    val buf = ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN)
    val out = ByteBuffer.allocate(samples * 2).order(ByteOrder.LITTLE_ENDIAN)
    for (i in 0 until samples) {
        var sum = 0
        for (c in 0 until channels) sum += buf.getShort(( i * channels + c) * 2).toInt()
        out.putShort((sum / channels).toShort())
    }
    return out.array()
}

private fun resample(data: ByteArray, fromRate: Int, toRate: Int): ByteArray {
    val srcSamples = data.size / 2
    if (srcSamples < 2) return data
    val dstSamples = (srcSamples.toLong() * toRate / fromRate).toInt()
    if (dstSamples < 1) return data
    val src = ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN)
    val dst = ByteBuffer.allocate(dstSamples * 2).order(ByteOrder.LITTLE_ENDIAN)
    for (i in 0 until dstSamples) {
        val srcPos = i.toDouble() * (srcSamples - 1) / (dstSamples - 1).coerceAtLeast(1)
        val idx = srcPos.toInt().coerceIn(0, srcSamples - 2)
        val frac = srcPos - idx
        val s0 = src.getShort(idx * 2).toInt()
        val s1 = src.getShort((idx + 1) * 2).toInt()
        dst.putShort((s0 + (s1 - s0) * frac).toInt().coerceIn(-32768, 32767).toShort())
    }
    return dst.array()
}

private fun stripWavHeader(data: ByteArray): ByteArray {
    if (data.size <= 12 ||
        data[0] != 0x52.toByte() || data[1] != 0x49.toByte() ||
        data[2] != 0x46.toByte() || data[3] != 0x46.toByte()) return data
    var offset = 12
    while (offset + 8 <= data.size) {
        val isData = data[offset] == 0x64.toByte() && data[offset+1] == 0x61.toByte() &&
                     data[offset+2] == 0x74.toByte() && data[offset+3] == 0x61.toByte()
        val chunkSize = (data[offset+4].toInt() and 0xFF) or
                        ((data[offset+5].toInt() and 0xFF) shl 8) or
                        ((data[offset+6].toInt() and 0xFF) shl 16) or
                        ((data[offset+7].toInt() and 0xFF) shl 24)
        if (isData) {
            val start = offset + 8
            return data.copyOfRange(start, minOf(start + chunkSize, data.size))
        }
        val paddedSize = (chunkSize + 1) and 1.inv()
        offset += 8 + paddedSize
    }
    return data
}

class CactusEngineModule : Module() {
    companion object {
        init { System.loadLibrary("cactus_bridge") }
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private external fun nativeInit(modelPath: String): Boolean
    private external fun nativeDestroy()
    private external fun nativeReset()
    private external fun nativeStop()
    private external fun nativeComplete(
        messagesJson: String, optionsJson: String?,
        pcmData: ByteArray?, tokenCallback: TokenCallback?
    ): String

    private fun pathFromUri(uri: String): String =
        if (uri.startsWith("file://")) Uri.parse(uri).path ?: uri else uri

    override fun definition() = ModuleDefinition {
        Name("CactusEngine")

        Events("onToken", "onComplete", "onError")

        OnDestroy {
            scope.cancel()
            nativeDestroy()
        }

        Function("cactus_init") { modelPath: String ->
            nativeInit(pathFromUri(modelPath))
        }

        Function("cactus_destroy") { nativeDestroy() }

        Function("cactus_reset") { nativeReset() }

        Function("cactus_stop") { nativeStop() }

        AsyncFunction("unzip") { zipPath: String, destPath: String, promise: Promise ->
            scope.launch {
                try {
                    val src = File(pathFromUri(zipPath))
                    val dest = File(pathFromUri(destPath))
                    dest.mkdirs()

                    ZipInputStream(src.inputStream().buffered()).use { zis ->
                        val buf = ByteArray(8192)
                        generateSequence { zis.nextEntry }.forEach { entry ->
                            val out = File(dest, entry.name)
                            if (!out.canonicalPath.startsWith(dest.canonicalPath)) { zis.closeEntry(); return@forEach }
                            if ("__MACOSX" in entry.name) { zis.closeEntry(); return@forEach }

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
                    promise.resolve(true)
                } catch (e: Exception) {
                    promise.reject("UNZIP_FAILED", e.message, e)
                }
            }
        }

        AsyncFunction("cactus_complete") { messagesJson: String, optionsJson: String?, pcmBase64: String?, promise: Promise ->
            scope.launch {
                try {
                    val pcm = pcmBase64?.let {
                        val raw = Base64.decode(it, Base64.DEFAULT)
                        val stripped = stripWavHeader(raw)
                        if (stripped !== raw) stripped
                        else decodeAudioToPcm(raw, appContext.reactContext!!)
                    }
                    val cb = object : TokenCallback {
                        override fun onToken(token: String, tokenId: Int) {
                            sendEvent("onToken", mapOf("token" to token, "tokenId" to tokenId))
                        }
                    }
                    val response = nativeComplete(messagesJson, optionsJson, pcm, cb)
                    sendEvent("onComplete", mapOf("response" to response))
                    promise.resolve(response)
                } catch (e: Exception) {
                    sendEvent("onError", mapOf("message" to (e.message ?: "Unknown error")))
                    promise.reject("INFERENCE_FAILED", e.message, e)
                }
            }
        }
    }
}
