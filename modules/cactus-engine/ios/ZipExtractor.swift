import Foundation
import zlib

enum ZipExtractor {

    private static let CHUNK_SIZE = 65536

    static func extract(zipURL: URL, to destURL: URL) throws {
        let fm = FileManager.default
        if !fm.fileExists(atPath: destURL.path) {
            try fm.createDirectory(at: destURL, withIntermediateDirectories: true)
        }

        guard let fh = FileHandle(forReadingAtPath: zipURL.path) else {
            throw ZipError.cannotOpen
        }
        defer { fh.closeFile() }

        while true {
            let header = fh.readData(ofLength: 30)
            if header.count < 30 { break }

            let sig: UInt32 = header.read(at: 0)
            if sig != 0x04034b50 { break }

            let method: UInt16 = header.read(at: 8)
            let compSize = Int(header.read(at: 18) as UInt32)
            let nameLen = Int(header.read(at: 26) as UInt16)
            let extraLen = Int(header.read(at: 28) as UInt16)

            let nameData = fh.readData(ofLength: nameLen)
            _ = fh.readData(ofLength: extraLen)

            guard let name = String(data: nameData, encoding: .utf8) else {
                fh.seek(toFileOffset: fh.offsetInFile + UInt64(compSize))
                continue
            }

            if name.contains("__MACOSX") || name.hasPrefix(".") {
                fh.seek(toFileOffset: fh.offsetInFile + UInt64(compSize))
                continue
            }

            let entryURL = destURL.appendingPathComponent(name)

            guard entryURL.standardizedFileURL.path.hasPrefix(destURL.standardizedFileURL.path) else {
                fh.seek(toFileOffset: fh.offsetInFile + UInt64(compSize))
                continue
            }

            if name.hasSuffix("/") {
                try fm.createDirectory(at: entryURL, withIntermediateDirectories: true)
                continue
            }

            let parent = entryURL.deletingLastPathComponent()
            if !fm.fileExists(atPath: parent.path) {
                try fm.createDirectory(at: parent, withIntermediateDirectories: true)
            }

            fm.createFile(atPath: entryURL.path, contents: nil)
            guard let outFh = FileHandle(forWritingAtPath: entryURL.path) else {
                throw ZipError.writeFailed(name)
            }

            do {
                switch method {
                case 0:
                    try streamCopy(from: fh, to: outFh, bytes: compSize)
                case 8:
                    try streamInflate(from: fh, to: outFh, compressedSize: compSize)
                default:
                    outFh.closeFile()
                    throw ZipError.unsupportedMethod(method)
                }
                outFh.closeFile()
            } catch {
                outFh.closeFile()
                throw error
            }
        }
    }

    private static func streamCopy(from src: FileHandle, to dst: FileHandle, bytes: Int) throws {
        var remaining = bytes
        while remaining > 0 {
            let toRead = min(remaining, CHUNK_SIZE)
            let chunk = src.readData(ofLength: toRead)
            if chunk.isEmpty { break }
            dst.write(chunk)
            remaining -= chunk.count
        }
    }

    private static func streamInflate(from src: FileHandle, to dst: FileHandle, compressedSize: Int) throws {
        var stream = z_stream()
        guard inflateInit2_(&stream, -MAX_WBITS, ZLIB_VERSION, Int32(MemoryLayout<z_stream>.size)) == Z_OK else {
            throw ZipError.decompFailed
        }
        defer { inflateEnd(&stream) }

        var remaining = compressedSize
        let outBuf = UnsafeMutablePointer<UInt8>.allocate(capacity: CHUNK_SIZE)
        defer { outBuf.deallocate() }
        var done = false

        while remaining > 0 && !done {
            let toRead = min(remaining, CHUNK_SIZE)
            let chunk = src.readData(ofLength: toRead)
            if chunk.isEmpty { break }
            remaining -= chunk.count

            try chunk.withUnsafeBytes { inPtr in
                stream.next_in = UnsafeMutablePointer(mutating: inPtr.baseAddress!.assumingMemoryBound(to: UInt8.self))
                stream.avail_in = uInt(chunk.count)

                while stream.avail_in > 0 {
                    stream.next_out = outBuf
                    stream.avail_out = uInt(CHUNK_SIZE)

                    let rc = zlib.inflate(&stream, Z_NO_FLUSH)
                    if rc != Z_OK && rc != Z_STREAM_END && rc != Z_BUF_ERROR {
                        throw ZipError.decompFailed
                    }

                    let written = CHUNK_SIZE - Int(stream.avail_out)
                    if written > 0 {
                        dst.write(Data(bytesNoCopy: outBuf, count: written, deallocator: .none))
                    }

                    if rc == Z_STREAM_END {
                        if remaining > 0 {
                            src.seek(toFileOffset: src.offsetInFile + UInt64(remaining))
                        }
                        done = true
                        return
                    }
                }
            }
        }
    }

    enum ZipError: LocalizedError {
        case cannotOpen
        case writeFailed(String)
        case unsupportedMethod(UInt16)
        case decompFailed

        var errorDescription: String? {
            switch self {
            case .cannotOpen: return "Cannot open zip file"
            case .writeFailed(let n): return "Cannot write: \(n)"
            case .unsupportedMethod(let m): return "Unsupported compression: \(m)"
            case .decompFailed: return "Decompression failed"
            }
        }
    }
}

private extension Data {
    func read<T: FixedWidthInteger>(at offset: Int) -> T {
        let size = MemoryLayout<T>.size
        return self[offset..<offset + size].withUnsafeBytes {
            $0.loadUnaligned(as: T.self).littleEndian
        }
    }
}
