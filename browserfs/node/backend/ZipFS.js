"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var api_error_1 = require('../core/api_error');
var node_fs_stats_1 = require('../core/node_fs_stats');
var file_system = require('../core/file_system');
var file_flag_1 = require('../core/file_flag');
var preload_file = require('../generic/preload_file');
var util_1 = require('../core/util');
var extended_ascii_1 = require('bfs-buffer/js/extended_ascii');
var inflateRaw = require('pako/dist/pako_inflate.min').inflateRaw;
var file_index_1 = require('../generic/file_index');
(function (ExternalFileAttributeType) {
    ExternalFileAttributeType[ExternalFileAttributeType["MSDOS"] = 0] = "MSDOS";
    ExternalFileAttributeType[ExternalFileAttributeType["AMIGA"] = 1] = "AMIGA";
    ExternalFileAttributeType[ExternalFileAttributeType["OPENVMS"] = 2] = "OPENVMS";
    ExternalFileAttributeType[ExternalFileAttributeType["UNIX"] = 3] = "UNIX";
    ExternalFileAttributeType[ExternalFileAttributeType["VM_CMS"] = 4] = "VM_CMS";
    ExternalFileAttributeType[ExternalFileAttributeType["ATARI_ST"] = 5] = "ATARI_ST";
    ExternalFileAttributeType[ExternalFileAttributeType["OS2_HPFS"] = 6] = "OS2_HPFS";
    ExternalFileAttributeType[ExternalFileAttributeType["MAC"] = 7] = "MAC";
    ExternalFileAttributeType[ExternalFileAttributeType["Z_SYSTEM"] = 8] = "Z_SYSTEM";
    ExternalFileAttributeType[ExternalFileAttributeType["CP_M"] = 9] = "CP_M";
    ExternalFileAttributeType[ExternalFileAttributeType["NTFS"] = 10] = "NTFS";
    ExternalFileAttributeType[ExternalFileAttributeType["MVS"] = 11] = "MVS";
    ExternalFileAttributeType[ExternalFileAttributeType["VSE"] = 12] = "VSE";
    ExternalFileAttributeType[ExternalFileAttributeType["ACORN_RISC"] = 13] = "ACORN_RISC";
    ExternalFileAttributeType[ExternalFileAttributeType["VFAT"] = 14] = "VFAT";
    ExternalFileAttributeType[ExternalFileAttributeType["ALT_MVS"] = 15] = "ALT_MVS";
    ExternalFileAttributeType[ExternalFileAttributeType["BEOS"] = 16] = "BEOS";
    ExternalFileAttributeType[ExternalFileAttributeType["TANDEM"] = 17] = "TANDEM";
    ExternalFileAttributeType[ExternalFileAttributeType["OS_400"] = 18] = "OS_400";
    ExternalFileAttributeType[ExternalFileAttributeType["OSX"] = 19] = "OSX";
})(exports.ExternalFileAttributeType || (exports.ExternalFileAttributeType = {}));
var ExternalFileAttributeType = exports.ExternalFileAttributeType;
(function (CompressionMethod) {
    CompressionMethod[CompressionMethod["STORED"] = 0] = "STORED";
    CompressionMethod[CompressionMethod["SHRUNK"] = 1] = "SHRUNK";
    CompressionMethod[CompressionMethod["REDUCED_1"] = 2] = "REDUCED_1";
    CompressionMethod[CompressionMethod["REDUCED_2"] = 3] = "REDUCED_2";
    CompressionMethod[CompressionMethod["REDUCED_3"] = 4] = "REDUCED_3";
    CompressionMethod[CompressionMethod["REDUCED_4"] = 5] = "REDUCED_4";
    CompressionMethod[CompressionMethod["IMPLODE"] = 6] = "IMPLODE";
    CompressionMethod[CompressionMethod["DEFLATE"] = 8] = "DEFLATE";
    CompressionMethod[CompressionMethod["DEFLATE64"] = 9] = "DEFLATE64";
    CompressionMethod[CompressionMethod["TERSE_OLD"] = 10] = "TERSE_OLD";
    CompressionMethod[CompressionMethod["BZIP2"] = 12] = "BZIP2";
    CompressionMethod[CompressionMethod["LZMA"] = 14] = "LZMA";
    CompressionMethod[CompressionMethod["TERSE_NEW"] = 18] = "TERSE_NEW";
    CompressionMethod[CompressionMethod["LZ77"] = 19] = "LZ77";
    CompressionMethod[CompressionMethod["WAVPACK"] = 97] = "WAVPACK";
    CompressionMethod[CompressionMethod["PPMD"] = 98] = "PPMD";
})(exports.CompressionMethod || (exports.CompressionMethod = {}));
var CompressionMethod = exports.CompressionMethod;
function msdos2date(time, date) {
    var day = date & 0x1F;
    var month = ((date >> 5) & 0xF) - 1;
    var year = (date >> 9) + 1980;
    var second = time & 0x1F;
    var minute = (time >> 5) & 0x3F;
    var hour = time >> 11;
    return new Date(year, month, day, hour, minute, second);
}
function safeToString(buff, useUTF8, start, length) {
    if (length === 0) {
        return "";
    }
    else if (useUTF8) {
        return buff.toString('utf8', start, start + length);
    }
    else {
        return extended_ascii_1["default"].byte2str(buff.slice(start, start + length));
    }
}
var FileHeader = (function () {
    function FileHeader(data) {
        this.data = data;
        if (data.readUInt32LE(0) !== 0x04034b50) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, "Invalid Zip file: Local file header has invalid signature: " + this.data.readUInt32LE(0));
        }
    }
    FileHeader.prototype.versionNeeded = function () { return this.data.readUInt16LE(4); };
    FileHeader.prototype.flags = function () { return this.data.readUInt16LE(6); };
    FileHeader.prototype.compressionMethod = function () { return this.data.readUInt16LE(8); };
    FileHeader.prototype.lastModFileTime = function () {
        return msdos2date(this.data.readUInt16LE(10), this.data.readUInt16LE(12));
    };
    FileHeader.prototype.rawLastModFileTime = function () {
        return this.data.readUInt32LE(10);
    };
    FileHeader.prototype.crc32 = function () { return this.data.readUInt32LE(14); };
    FileHeader.prototype.fileNameLength = function () { return this.data.readUInt16LE(26); };
    FileHeader.prototype.extraFieldLength = function () { return this.data.readUInt16LE(28); };
    FileHeader.prototype.fileName = function () {
        return safeToString(this.data, this.useUTF8(), 30, this.fileNameLength());
    };
    FileHeader.prototype.extraField = function () {
        var start = 30 + this.fileNameLength();
        return this.data.slice(start, start + this.extraFieldLength());
    };
    FileHeader.prototype.totalSize = function () { return 30 + this.fileNameLength() + this.extraFieldLength(); };
    FileHeader.prototype.useUTF8 = function () { return (this.flags() & 0x800) === 0x800; };
    return FileHeader;
}());
exports.FileHeader = FileHeader;
var FileData = (function () {
    function FileData(header, record, data) {
        this.header = header;
        this.record = record;
        this.data = data;
    }
    FileData.prototype.decompress = function () {
        var compressionMethod = this.header.compressionMethod();
        switch (compressionMethod) {
            case CompressionMethod.DEFLATE:
                var data = inflateRaw(util_1.buffer2Arrayish(this.data.slice(0, this.record.compressedSize())), { chunkSize: this.record.uncompressedSize() });
                return util_1.arrayish2Buffer(data);
            case CompressionMethod.STORED:
                return util_1.copyingSlice(this.data, 0, this.record.uncompressedSize());
            default:
                var name = CompressionMethod[compressionMethod];
                name = name ? name : "Unknown: " + compressionMethod;
                throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, "Invalid compression method on file '" + this.header.fileName() + "': " + name);
        }
    };
    FileData.prototype.getHeader = function () {
        return this.header;
    };
    FileData.prototype.getRecord = function () {
        return this.record;
    };
    FileData.prototype.getRawData = function () {
        return this.data;
    };
    return FileData;
}());
exports.FileData = FileData;
var DataDescriptor = (function () {
    function DataDescriptor(data) {
        this.data = data;
    }
    DataDescriptor.prototype.crc32 = function () { return this.data.readUInt32LE(0); };
    DataDescriptor.prototype.compressedSize = function () { return this.data.readUInt32LE(4); };
    DataDescriptor.prototype.uncompressedSize = function () { return this.data.readUInt32LE(8); };
    return DataDescriptor;
}());
exports.DataDescriptor = DataDescriptor;
var ArchiveExtraDataRecord = (function () {
    function ArchiveExtraDataRecord(data) {
        this.data = data;
        if (this.data.readUInt32LE(0) !== 0x08064b50) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, "Invalid archive extra data record signature: " + this.data.readUInt32LE(0));
        }
    }
    ArchiveExtraDataRecord.prototype.length = function () { return this.data.readUInt32LE(4); };
    ArchiveExtraDataRecord.prototype.extraFieldData = function () { return this.data.slice(8, 8 + this.length()); };
    return ArchiveExtraDataRecord;
}());
exports.ArchiveExtraDataRecord = ArchiveExtraDataRecord;
var DigitalSignature = (function () {
    function DigitalSignature(data) {
        this.data = data;
        if (this.data.readUInt32LE(0) !== 0x05054b50) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, "Invalid digital signature signature: " + this.data.readUInt32LE(0));
        }
    }
    DigitalSignature.prototype.size = function () { return this.data.readUInt16LE(4); };
    DigitalSignature.prototype.signatureData = function () { return this.data.slice(6, 6 + this.size()); };
    return DigitalSignature;
}());
exports.DigitalSignature = DigitalSignature;
var CentralDirectory = (function () {
    function CentralDirectory(zipData, data) {
        this.zipData = zipData;
        this.data = data;
        if (this.data.readUInt32LE(0) !== 0x02014b50)
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, "Invalid Zip file: Central directory record has invalid signature: " + this.data.readUInt32LE(0));
        this._filename = this.produceFilename();
    }
    CentralDirectory.prototype.versionMadeBy = function () { return this.data.readUInt16LE(4); };
    CentralDirectory.prototype.versionNeeded = function () { return this.data.readUInt16LE(6); };
    CentralDirectory.prototype.flag = function () { return this.data.readUInt16LE(8); };
    CentralDirectory.prototype.compressionMethod = function () { return this.data.readUInt16LE(10); };
    CentralDirectory.prototype.lastModFileTime = function () {
        return msdos2date(this.data.readUInt16LE(12), this.data.readUInt16LE(14));
    };
    CentralDirectory.prototype.rawLastModFileTime = function () {
        return this.data.readUInt32LE(12);
    };
    CentralDirectory.prototype.crc32 = function () { return this.data.readUInt32LE(16); };
    CentralDirectory.prototype.compressedSize = function () { return this.data.readUInt32LE(20); };
    CentralDirectory.prototype.uncompressedSize = function () { return this.data.readUInt32LE(24); };
    CentralDirectory.prototype.fileNameLength = function () { return this.data.readUInt16LE(28); };
    CentralDirectory.prototype.extraFieldLength = function () { return this.data.readUInt16LE(30); };
    CentralDirectory.prototype.fileCommentLength = function () { return this.data.readUInt16LE(32); };
    CentralDirectory.prototype.diskNumberStart = function () { return this.data.readUInt16LE(34); };
    CentralDirectory.prototype.internalAttributes = function () { return this.data.readUInt16LE(36); };
    CentralDirectory.prototype.externalAttributes = function () { return this.data.readUInt32LE(38); };
    CentralDirectory.prototype.headerRelativeOffset = function () { return this.data.readUInt32LE(42); };
    CentralDirectory.prototype.produceFilename = function () {
        var fileName = safeToString(this.data, this.useUTF8(), 46, this.fileNameLength());
        return fileName.replace(/\\/g, "/");
    };
    CentralDirectory.prototype.fileName = function () {
        return this._filename;
    };
    CentralDirectory.prototype.rawFileName = function () {
        return this.data.slice(46, 46 + this.fileNameLength());
    };
    CentralDirectory.prototype.extraField = function () {
        var start = 44 + this.fileNameLength();
        return this.data.slice(start, start + this.extraFieldLength());
    };
    CentralDirectory.prototype.fileComment = function () {
        var start = 46 + this.fileNameLength() + this.extraFieldLength();
        return safeToString(this.data, this.useUTF8(), start, this.fileCommentLength());
    };
    CentralDirectory.prototype.rawFileComment = function () {
        var start = 46 + this.fileNameLength() + this.extraFieldLength();
        return this.data.slice(start, start + this.fileCommentLength());
    };
    CentralDirectory.prototype.totalSize = function () {
        return 46 + this.fileNameLength() + this.extraFieldLength() + this.fileCommentLength();
    };
    CentralDirectory.prototype.isDirectory = function () {
        var fileName = this.fileName();
        return (this.externalAttributes() & 0x10 ? true : false) || (fileName.charAt(fileName.length - 1) === '/');
    };
    CentralDirectory.prototype.isFile = function () { return !this.isDirectory(); };
    CentralDirectory.prototype.useUTF8 = function () { return (this.flag() & 0x800) === 0x800; };
    CentralDirectory.prototype.isEncrypted = function () { return (this.flag() & 0x1) === 0x1; };
    CentralDirectory.prototype.getFileData = function () {
        var start = this.headerRelativeOffset();
        var header = new FileHeader(this.zipData.slice(start));
        return new FileData(header, this, this.zipData.slice(start + header.totalSize()));
    };
    CentralDirectory.prototype.getData = function () {
        return this.getFileData().decompress();
    };
    CentralDirectory.prototype.getRawData = function () {
        return this.getFileData().getRawData();
    };
    CentralDirectory.prototype.getStats = function () {
        return new node_fs_stats_1["default"](node_fs_stats_1.FileType.FILE, this.uncompressedSize(), 0x16D, new Date(), this.lastModFileTime());
    };
    return CentralDirectory;
}());
exports.CentralDirectory = CentralDirectory;
var EndOfCentralDirectory = (function () {
    function EndOfCentralDirectory(data) {
        this.data = data;
        if (this.data.readUInt32LE(0) !== 0x06054b50)
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, "Invalid Zip file: End of central directory record has invalid signature: " + this.data.readUInt32LE(0));
    }
    EndOfCentralDirectory.prototype.diskNumber = function () { return this.data.readUInt16LE(4); };
    EndOfCentralDirectory.prototype.cdDiskNumber = function () { return this.data.readUInt16LE(6); };
    EndOfCentralDirectory.prototype.cdDiskEntryCount = function () { return this.data.readUInt16LE(8); };
    EndOfCentralDirectory.prototype.cdTotalEntryCount = function () { return this.data.readUInt16LE(10); };
    EndOfCentralDirectory.prototype.cdSize = function () { return this.data.readUInt32LE(12); };
    EndOfCentralDirectory.prototype.cdOffset = function () { return this.data.readUInt32LE(16); };
    EndOfCentralDirectory.prototype.cdZipCommentLength = function () { return this.data.readUInt16LE(20); };
    EndOfCentralDirectory.prototype.cdZipComment = function () {
        return safeToString(this.data, true, 22, this.cdZipCommentLength());
    };
    EndOfCentralDirectory.prototype.rawCdZipComment = function () {
        return this.data.slice(22, 22 + this.cdZipCommentLength());
    };
    return EndOfCentralDirectory;
}());
exports.EndOfCentralDirectory = EndOfCentralDirectory;
var ZipTOC = (function () {
    function ZipTOC(index, directoryEntries, eocd, data) {
        this.index = index;
        this.directoryEntries = directoryEntries;
        this.eocd = eocd;
        this.data = data;
    }
    return ZipTOC;
}());
exports.ZipTOC = ZipTOC;
var ZipFS = (function (_super) {
    __extends(ZipFS, _super);
    function ZipFS(input, name) {
        if (name === void 0) { name = ''; }
        _super.call(this);
        this.input = input;
        this.name = name;
        this._index = new file_index_1.FileIndex();
        this._directoryEntries = [];
        this._eocd = null;
        if (input instanceof ZipTOC) {
            this._index = input.index;
            this._directoryEntries = input.directoryEntries;
            this._eocd = input.eocd;
            this.data = input.data;
        }
        else {
            this.data = input;
            this.populateIndex();
        }
    }
    ZipFS.prototype.getName = function () {
        return 'ZipFS' + (this.name !== '' ? ' ' + this.name : '');
    };
    ZipFS.prototype.getCentralDirectoryEntry = function (path) {
        var inode = this._index.getInode(path);
        if (inode === null) {
            throw api_error_1.ApiError.ENOENT(path);
        }
        if (file_index_1.isFileInode(inode)) {
            return inode.getData();
        }
        else if (file_index_1.isDirInode(inode)) {
            return inode.getData();
        }
    };
    ZipFS.prototype.getCentralDirectoryEntryAt = function (index) {
        var dirEntry = this._directoryEntries[index];
        if (!dirEntry) {
            throw new RangeError("Invalid directory index: " + index + ".");
        }
        return dirEntry;
    };
    ZipFS.prototype.getNumberOfCentralDirectoryEntries = function () {
        return this._directoryEntries.length;
    };
    ZipFS.prototype.getEndOfCentralDirectory = function () {
        return this._eocd;
    };
    ZipFS.isAvailable = function () { return true; };
    ZipFS.prototype.diskSpace = function (path, cb) {
        cb(this.data.length, 0);
    };
    ZipFS.prototype.isReadOnly = function () {
        return true;
    };
    ZipFS.prototype.supportsLinks = function () {
        return false;
    };
    ZipFS.prototype.supportsProps = function () {
        return false;
    };
    ZipFS.prototype.supportsSynch = function () {
        return true;
    };
    ZipFS.prototype.statSync = function (path, isLstat) {
        var inode = this._index.getInode(path);
        if (inode === null) {
            throw api_error_1.ApiError.ENOENT(path);
        }
        var stats;
        if (file_index_1.isFileInode(inode)) {
            stats = inode.getData().getStats();
        }
        else if (file_index_1.isDirInode(inode)) {
            stats = inode.getStats();
        }
        else {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, "Invalid inode.");
        }
        return stats;
    };
    ZipFS.prototype.openSync = function (path, flags, mode) {
        if (flags.isWriteable()) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EPERM, path);
        }
        var inode = this._index.getInode(path);
        if (!inode) {
            throw api_error_1.ApiError.ENOENT(path);
        }
        else if (file_index_1.isFileInode(inode)) {
            var cdRecord = inode.getData();
            var stats = cdRecord.getStats();
            switch (flags.pathExistsAction()) {
                case file_flag_1.ActionType.THROW_EXCEPTION:
                case file_flag_1.ActionType.TRUNCATE_FILE:
                    throw api_error_1.ApiError.EEXIST(path);
                case file_flag_1.ActionType.NOP:
                    return new preload_file.NoSyncFile(this, path, flags, stats, cdRecord.getData());
                default:
                    throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, 'Invalid FileMode object.');
            }
        }
        else {
            throw api_error_1.ApiError.EISDIR(path);
        }
    };
    ZipFS.prototype.readdirSync = function (path) {
        var inode = this._index.getInode(path);
        if (!inode) {
            throw api_error_1.ApiError.ENOENT(path);
        }
        else if (file_index_1.isDirInode(inode)) {
            return inode.getListing();
        }
        else {
            throw api_error_1.ApiError.ENOTDIR(path);
        }
    };
    ZipFS.prototype.readFileSync = function (fname, encoding, flag) {
        var fd = this.openSync(fname, flag, 0x1a4);
        try {
            var fdCast = fd;
            var fdBuff = fdCast.getBuffer();
            if (encoding === null) {
                return util_1.copyingSlice(fdBuff);
            }
            return fdBuff.toString(encoding);
        }
        finally {
            fd.closeSync();
        }
    };
    ZipFS.getEOCD = function (data) {
        var startOffset = 22;
        var endOffset = Math.min(startOffset + 0xFFFF, data.length - 1);
        for (var i = startOffset; i < endOffset; i++) {
            if (data.readUInt32LE(data.length - i) === 0x06054b50) {
                return new EndOfCentralDirectory(data.slice(data.length - i));
            }
        }
        throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, "Invalid ZIP file: Could not locate End of Central Directory signature.");
    };
    ZipFS.addToIndex = function (cd, index) {
        var filename = cd.fileName();
        if (filename.charAt(0) === '/')
            throw new Error("WHY IS THIS ABSOLUTE");
        if (filename.charAt(filename.length - 1) === '/') {
            filename = filename.substr(0, filename.length - 1);
        }
        if (cd.isDirectory()) {
            index.addPathFast('/' + filename, new file_index_1.DirInode(cd));
        }
        else {
            index.addPathFast('/' + filename, new file_index_1.FileInode(cd));
        }
    };
    ZipFS.computeIndexResponsive = function (data, index, cdPtr, cdEnd, cb, cdEntries, eocd) {
        if (cdPtr < cdEnd) {
            var count = 0;
            while (count++ < 200 && cdPtr < cdEnd) {
                var cd = new CentralDirectory(data, data.slice(cdPtr));
                ZipFS.addToIndex(cd, index);
                cdPtr += cd.totalSize();
                cdEntries.push(cd);
            }
            setImmediate(function () {
                ZipFS.computeIndexResponsive(data, index, cdPtr, cdEnd, cb, cdEntries, eocd);
            });
        }
        else {
            cb(new ZipTOC(index, cdEntries, eocd, data));
        }
    };
    ZipFS.computeIndex = function (data, cb) {
        var index = new file_index_1.FileIndex();
        var eocd = ZipFS.getEOCD(data);
        if (eocd.diskNumber() !== eocd.cdDiskNumber())
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, "ZipFS does not support spanned zip files.");
        var cdPtr = eocd.cdOffset();
        if (cdPtr === 0xFFFFFFFF)
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, "ZipFS does not support Zip64.");
        var cdEnd = cdPtr + eocd.cdSize();
        ZipFS.computeIndexResponsive(data, index, cdPtr, cdEnd, cb, [], eocd);
    };
    ZipFS.prototype.populateIndex = function () {
        var eocd = this._eocd = ZipFS.getEOCD(this.data);
        if (eocd.diskNumber() !== eocd.cdDiskNumber())
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, "ZipFS does not support spanned zip files.");
        var cdPtr = eocd.cdOffset();
        if (cdPtr === 0xFFFFFFFF)
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, "ZipFS does not support Zip64.");
        var cdEnd = cdPtr + eocd.cdSize();
        while (cdPtr < cdEnd) {
            var cd = new CentralDirectory(this.data, this.data.slice(cdPtr));
            cdPtr += cd.totalSize();
            ZipFS.addToIndex(cd, this._index);
            this._directoryEntries.push(cd);
        }
    };
    return ZipFS;
}(file_system.SynchronousFileSystem));
exports.__esModule = true;
exports["default"] = ZipFS;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiWmlwRlMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvYmFja2VuZC9aaXBGUy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUErQ0EsMEJBQWtDLG1CQUFtQixDQUFDLENBQUE7QUFDdEQsOEJBQXlDLHVCQUF1QixDQUFDLENBQUE7QUFDakUsSUFBTyxXQUFXLFdBQVcscUJBQXFCLENBQUMsQ0FBQztBQUVwRCwwQkFBbUMsbUJBQW1CLENBQUMsQ0FBQTtBQUN2RCxJQUFPLFlBQVksV0FBVyx5QkFBeUIsQ0FBQyxDQUFDO0FBQ3pELHFCQUF1RSxjQUFjLENBQUMsQ0FBQTtBQUN0RiwrQkFBMEIsOEJBQThCLENBQUMsQ0FBQTtBQUN6RCxJQUFJLFVBQVUsR0FJVixPQUFPLENBQUMsNEJBQTRCLENBQUMsQ0FBQyxVQUFVLENBQUM7QUFDckQsMkJBQXNFLHVCQUF1QixDQUFDLENBQUE7QUFNOUYsV0FBWSx5QkFBeUI7SUFDbkMsMkVBQVMsQ0FBQTtJQUFFLDJFQUFTLENBQUE7SUFBRSwrRUFBVyxDQUFBO0lBQUUseUVBQVEsQ0FBQTtJQUFFLDZFQUFVLENBQUE7SUFBRSxpRkFBWSxDQUFBO0lBQ3JFLGlGQUFZLENBQUE7SUFBRSx1RUFBTyxDQUFBO0lBQUUsaUZBQVksQ0FBQTtJQUFFLHlFQUFRLENBQUE7SUFBRSwwRUFBUyxDQUFBO0lBQUUsd0VBQVEsQ0FBQTtJQUFFLHdFQUFRLENBQUE7SUFDNUUsc0ZBQWUsQ0FBQTtJQUFFLDBFQUFTLENBQUE7SUFBRSxnRkFBWSxDQUFBO0lBQUUsMEVBQVMsQ0FBQTtJQUFFLDhFQUFXLENBQUE7SUFBRSw4RUFBVyxDQUFBO0lBQzdFLHdFQUFRLENBQUE7QUFDVixDQUFDLEVBTFcsaUNBQXlCLEtBQXpCLGlDQUF5QixRQUtwQztBQUxELElBQVkseUJBQXlCLEdBQXpCLGlDQUtYLENBQUE7QUFLRCxXQUFZLGlCQUFpQjtJQUMzQiw2REFBVSxDQUFBO0lBQ1YsNkRBQVUsQ0FBQTtJQUNWLG1FQUFhLENBQUE7SUFDYixtRUFBYSxDQUFBO0lBQ2IsbUVBQWEsQ0FBQTtJQUNiLG1FQUFhLENBQUE7SUFDYiwrREFBVyxDQUFBO0lBQ1gsK0RBQVcsQ0FBQTtJQUNYLG1FQUFhLENBQUE7SUFDYixvRUFBYyxDQUFBO0lBQ2QsNERBQVUsQ0FBQTtJQUNWLDBEQUFTLENBQUE7SUFDVCxvRUFBYyxDQUFBO0lBQ2QsMERBQVMsQ0FBQTtJQUNULGdFQUFZLENBQUE7SUFDWiwwREFBUyxDQUFBO0FBQ1gsQ0FBQyxFQWpCVyx5QkFBaUIsS0FBakIseUJBQWlCLFFBaUI1QjtBQWpCRCxJQUFZLGlCQUFpQixHQUFqQix5QkFpQlgsQ0FBQTtBQU1ELG9CQUFvQixJQUFZLEVBQUUsSUFBWTtJQUk1QyxJQUFJLEdBQUcsR0FBRyxJQUFJLEdBQUcsSUFBSSxDQUFDO0lBRXRCLElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3BDLElBQUksSUFBSSxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQztJQUk5QixJQUFJLE1BQU0sR0FBRyxJQUFJLEdBQUcsSUFBSSxDQUFDO0lBQ3pCLElBQUksTUFBTSxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQztJQUNoQyxJQUFJLElBQUksR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDO0lBQ3RCLE1BQU0sQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQzFELENBQUM7QUFPRCxzQkFBc0IsSUFBZ0IsRUFBRSxPQUFnQixFQUFFLEtBQWEsRUFBRSxNQUFjO0lBQ3JGLEVBQUUsQ0FBQyxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2pCLE1BQU0sQ0FBQyxFQUFFLENBQUM7SUFDWixDQUFDO0lBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7UUFDbkIsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLEtBQUssRUFBRSxLQUFLLEdBQUcsTUFBTSxDQUFDLENBQUM7SUFDdEQsQ0FBQztJQUFDLElBQUksQ0FBQyxDQUFDO1FBQ04sTUFBTSxDQUFDLDJCQUFhLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFLEtBQUssR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDO0lBQ25FLENBQUM7QUFDSCxDQUFDO0FBOENEO0lBQ0Usb0JBQW9CLElBQWdCO1FBQWhCLFNBQUksR0FBSixJQUFJLENBQVk7UUFDbEMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsS0FBSyxVQUFVLENBQUMsQ0FBQyxDQUFDO1lBQ3hDLE1BQU0sSUFBSSxvQkFBUSxDQUFDLHFCQUFTLENBQUMsTUFBTSxFQUFFLDZEQUE2RCxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDbEksQ0FBQztJQUNILENBQUM7SUFDTSxrQ0FBYSxHQUFwQixjQUFpQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzdELDBCQUFLLEdBQVosY0FBeUIsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNyRCxzQ0FBaUIsR0FBeEIsY0FBZ0QsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM1RSxvQ0FBZSxHQUF0QjtRQUVFLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUM1RSxDQUFDO0lBQ00sdUNBQWtCLEdBQXpCO1FBQ0UsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFDTSwwQkFBSyxHQUFaLGNBQXlCLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFjdEQsbUNBQWMsR0FBckIsY0FBa0MsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUMvRCxxQ0FBZ0IsR0FBdkIsY0FBb0MsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNqRSw2QkFBUSxHQUFmO1FBQ0UsTUFBTSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxPQUFPLEVBQUUsRUFBRSxFQUFFLEVBQUUsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDLENBQUM7SUFDNUUsQ0FBQztJQUNNLCtCQUFVLEdBQWpCO1FBQ0UsSUFBSSxLQUFLLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUN2QyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFLEtBQUssR0FBRyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQyxDQUFDO0lBQ2pFLENBQUM7SUFDTSw4QkFBUyxHQUFoQixjQUE2QixNQUFNLENBQUMsRUFBRSxHQUFHLElBQUksQ0FBQyxjQUFjLEVBQUUsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDcEYsNEJBQU8sR0FBZCxjQUE0QixNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLEdBQUcsS0FBSyxDQUFDLEtBQUssS0FBSyxDQUFDLENBQUMsQ0FBQztJQUN4RSxpQkFBQztBQUFELENBQUMsQUF6Q0QsSUF5Q0M7QUF6Q1ksa0JBQVUsYUF5Q3RCLENBQUE7QUFnQkQ7SUFDRSxrQkFBb0IsTUFBa0IsRUFBVSxNQUF3QixFQUFVLElBQWdCO1FBQTlFLFdBQU0sR0FBTixNQUFNLENBQVk7UUFBVSxXQUFNLEdBQU4sTUFBTSxDQUFrQjtRQUFVLFNBQUksR0FBSixJQUFJLENBQVk7SUFBRyxDQUFDO0lBQy9GLDZCQUFVLEdBQWpCO1FBRUUsSUFBSSxpQkFBaUIsR0FBc0IsSUFBSSxDQUFDLE1BQU0sQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1FBQzNFLE1BQU0sQ0FBQyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQztZQUMxQixLQUFLLGlCQUFpQixDQUFDLE9BQU87Z0JBQzVCLElBQUksSUFBSSxHQUFHLFVBQVUsQ0FDbkIsc0JBQWUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxjQUFjLEVBQUUsQ0FBQyxDQUFDLEVBQ2pFLEVBQUUsU0FBUyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLEVBQUUsRUFBRSxDQUM5QyxDQUFDO2dCQUNGLE1BQU0sQ0FBQyxzQkFBZSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQy9CLEtBQUssaUJBQWlCLENBQUMsTUFBTTtnQkFFM0IsTUFBTSxDQUFDLG1CQUFZLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLENBQUM7WUFDcEU7Z0JBQ0UsSUFBSSxJQUFJLEdBQVcsaUJBQWlCLENBQUMsaUJBQWlCLENBQUMsQ0FBQztnQkFDeEQsSUFBSSxHQUFHLElBQUksR0FBRyxJQUFJLEdBQUcsV0FBVyxHQUFHLGlCQUFpQixDQUFDO2dCQUNyRCxNQUFNLElBQUksb0JBQVEsQ0FBQyxxQkFBUyxDQUFDLE1BQU0sRUFBRSxzQ0FBc0MsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxHQUFHLEtBQUssR0FBRyxJQUFJLENBQUMsQ0FBQztRQUN6SCxDQUFDO0lBQ0gsQ0FBQztJQUNNLDRCQUFTLEdBQWhCO1FBQ0UsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7SUFDckIsQ0FBQztJQUNNLDRCQUFTLEdBQWhCO1FBQ0UsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7SUFDckIsQ0FBQztJQUNNLDZCQUFVLEdBQWpCO1FBQ0UsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7SUFDbkIsQ0FBQztJQUNILGVBQUM7QUFBRCxDQUFDLEFBOUJELElBOEJDO0FBOUJZLGdCQUFRLFdBOEJwQixDQUFBO0FBU0Q7SUFDRSx3QkFBb0IsSUFBZ0I7UUFBaEIsU0FBSSxHQUFKLElBQUksQ0FBWTtJQUFHLENBQUM7SUFDakMsOEJBQUssR0FBWixjQUF5QixNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3JELHVDQUFjLEdBQXJCLGNBQWtDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDOUQseUNBQWdCLEdBQXZCLGNBQW9DLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDekUscUJBQUM7QUFBRCxDQUFDLEFBTEQsSUFLQztBQUxZLHNCQUFjLGlCQUsxQixDQUFBO0FBMEJEO0lBQ0UsZ0NBQW9CLElBQWdCO1FBQWhCLFNBQUksR0FBSixJQUFJLENBQVk7UUFDbEMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLEtBQUssVUFBVSxDQUFDLENBQUMsQ0FBQztZQUM3QyxNQUFNLElBQUksb0JBQVEsQ0FBQyxxQkFBUyxDQUFDLE1BQU0sRUFBRSwrQ0FBK0MsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3BILENBQUM7SUFDSCxDQUFDO0lBQ00sdUNBQU0sR0FBYixjQUEwQixNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3RELCtDQUFjLEdBQXJCLGNBQXNDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN2Riw2QkFBQztBQUFELENBQUMsQUFSRCxJQVFDO0FBUlksOEJBQXNCLHlCQVFsQyxDQUFBO0FBbUJEO0lBQ0UsMEJBQW9CLElBQWdCO1FBQWhCLFNBQUksR0FBSixJQUFJLENBQVk7UUFDbEMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLEtBQUssVUFBVSxDQUFDLENBQUMsQ0FBQztZQUM3QyxNQUFNLElBQUksb0JBQVEsQ0FBQyxxQkFBUyxDQUFDLE1BQU0sRUFBRSx1Q0FBdUMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzVHLENBQUM7SUFDSCxDQUFDO0lBQ00sK0JBQUksR0FBWCxjQUF3QixNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3BELHdDQUFhLEdBQXBCLGNBQXFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNwRix1QkFBQztBQUFELENBQUMsQUFSRCxJQVFDO0FBUlksd0JBQWdCLG1CQVE1QixDQUFBO0FBMkJEO0lBR0UsMEJBQW9CLE9BQW1CLEVBQVUsSUFBZ0I7UUFBN0MsWUFBTyxHQUFQLE9BQU8sQ0FBWTtRQUFVLFNBQUksR0FBSixJQUFJLENBQVk7UUFFL0QsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLEtBQUssVUFBVSxDQUFDO1lBQzNDLE1BQU0sSUFBSSxvQkFBUSxDQUFDLHFCQUFTLENBQUMsTUFBTSxFQUFFLG9FQUFvRSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDekksSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7SUFDMUMsQ0FBQztJQUNNLHdDQUFhLEdBQXBCLGNBQWlDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDN0Qsd0NBQWEsR0FBcEIsY0FBaUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM3RCwrQkFBSSxHQUFYLGNBQXdCLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDcEQsNENBQWlCLEdBQXhCLGNBQWdELE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDN0UsMENBQWUsR0FBdEI7UUFFRSxNQUFNLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDNUUsQ0FBQztJQUNNLDZDQUFrQixHQUF6QjtRQUNFLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBQ00sZ0NBQUssR0FBWixjQUF5QixNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3RELHlDQUFjLEdBQXJCLGNBQWtDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDL0QsMkNBQWdCLEdBQXZCLGNBQW9DLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDakUseUNBQWMsR0FBckIsY0FBa0MsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUMvRCwyQ0FBZ0IsR0FBdkIsY0FBb0MsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNqRSw0Q0FBaUIsR0FBeEIsY0FBcUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNsRSwwQ0FBZSxHQUF0QixjQUFtQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2hFLDZDQUFrQixHQUF6QixjQUFzQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ25FLDZDQUFrQixHQUF6QixjQUFzQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ25FLCtDQUFvQixHQUEzQixjQUF3QyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3JFLDBDQUFlLEdBQXRCO1FBY0UsSUFBSSxRQUFRLEdBQVcsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLE9BQU8sRUFBRSxFQUFFLEVBQUUsRUFBRSxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQztRQUMxRixNQUFNLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDdEMsQ0FBQztJQUNNLG1DQUFRLEdBQWY7UUFDRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQztJQUN4QixDQUFDO0lBQ00sc0NBQVcsR0FBbEI7UUFDRSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxFQUFFLEVBQUUsR0FBRyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQztJQUN6RCxDQUFDO0lBQ00scUNBQVUsR0FBakI7UUFDRSxJQUFJLEtBQUssR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQ3ZDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsS0FBSyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLENBQUM7SUFDakUsQ0FBQztJQUNNLHNDQUFXLEdBQWxCO1FBQ0UsSUFBSSxLQUFLLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQyxjQUFjLEVBQUUsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUNqRSxNQUFNLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLE9BQU8sRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDO0lBQ2xGLENBQUM7SUFDTSx5Q0FBYyxHQUFyQjtRQUNFLElBQUksS0FBSyxHQUFHLEVBQUUsR0FBRyxJQUFJLENBQUMsY0FBYyxFQUFFLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7UUFDakUsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxLQUFLLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUMsQ0FBQztJQUNsRSxDQUFDO0lBQ00sb0NBQVMsR0FBaEI7UUFDRSxNQUFNLENBQUMsRUFBRSxHQUFHLElBQUksQ0FBQyxjQUFjLEVBQUUsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsR0FBRyxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztJQUN6RixDQUFDO0lBQ00sc0NBQVcsR0FBbEI7UUFTRSxJQUFJLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDL0IsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLGtCQUFrQixFQUFFLEdBQUcsSUFBSSxHQUFHLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLE1BQU0sR0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQztJQUMzRyxDQUFDO0lBQ00saUNBQU0sR0FBYixjQUEyQixNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2pELGtDQUFPLEdBQWQsY0FBNEIsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxHQUFHLEtBQUssQ0FBQyxLQUFLLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFDOUQsc0NBQVcsR0FBbEIsY0FBZ0MsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxHQUFHLEdBQUcsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDOUQsc0NBQVcsR0FBbEI7UUFHRSxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsb0JBQW9CLEVBQUUsQ0FBQztRQUN4QyxJQUFJLE1BQU0sR0FBRyxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQ3ZELE1BQU0sQ0FBQyxJQUFJLFFBQVEsQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxNQUFNLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ3BGLENBQUM7SUFDTSxrQ0FBTyxHQUFkO1FBQ0UsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQyxVQUFVLEVBQUUsQ0FBQztJQUN6QyxDQUFDO0lBQ00scUNBQVUsR0FBakI7UUFDRSxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDLFVBQVUsRUFBRSxDQUFDO0lBQ3pDLENBQUM7SUFDTSxtQ0FBUSxHQUFmO1FBQ0UsTUFBTSxDQUFDLElBQUksMEJBQUssQ0FBQyx3QkFBUSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSSxJQUFJLEVBQUUsRUFBRSxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUMsQ0FBQztJQUN0RyxDQUFDO0lBQ0gsdUJBQUM7QUFBRCxDQUFDLEFBbkdELElBbUdDO0FBbkdZLHdCQUFnQixtQkFtRzVCLENBQUE7QUFtQkQ7SUFDRSwrQkFBb0IsSUFBZ0I7UUFBaEIsU0FBSSxHQUFKLElBQUksQ0FBWTtRQUNsQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsS0FBSyxVQUFVLENBQUM7WUFDM0MsTUFBTSxJQUFJLG9CQUFRLENBQUMscUJBQVMsQ0FBQyxNQUFNLEVBQUUsMkVBQTJFLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNsSixDQUFDO0lBQ00sMENBQVUsR0FBakIsY0FBOEIsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUMxRCw0Q0FBWSxHQUFuQixjQUFnQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzVELGdEQUFnQixHQUF2QixjQUFvQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2hFLGlEQUFpQixHQUF4QixjQUFxQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2xFLHNDQUFNLEdBQWIsY0FBMEIsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN2RCx3Q0FBUSxHQUFmLGNBQTRCLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDekQsa0RBQWtCLEdBQXpCLGNBQXNDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbkUsNENBQVksR0FBbkI7UUFFRSxNQUFNLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQyxDQUFDO0lBQ3RFLENBQUM7SUFDTSwrQ0FBZSxHQUF0QjtRQUNFLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLEVBQUUsRUFBRSxHQUFHLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDLENBQUE7SUFDNUQsQ0FBQztJQUNILDRCQUFDO0FBQUQsQ0FBQyxBQW5CRCxJQW1CQztBQW5CWSw2QkFBcUIsd0JBbUJqQyxDQUFBO0FBRUQ7SUFDRSxnQkFBbUIsS0FBa0MsRUFBUyxnQkFBb0MsRUFBUyxJQUEyQixFQUFTLElBQWdCO1FBQTVJLFVBQUssR0FBTCxLQUFLLENBQTZCO1FBQVMscUJBQWdCLEdBQWhCLGdCQUFnQixDQUFvQjtRQUFTLFNBQUksR0FBSixJQUFJLENBQXVCO1FBQVMsU0FBSSxHQUFKLElBQUksQ0FBWTtJQUMvSixDQUFDO0lBQ0gsYUFBQztBQUFELENBQUMsQUFIRCxJQUdDO0FBSFksY0FBTSxTQUdsQixDQUFBO0FBRUQ7SUFBbUMseUJBQWlDO0lBV2xFLGVBQW9CLEtBQTBCLEVBQVUsSUFBaUI7UUFBekIsb0JBQXlCLEdBQXpCLFNBQXlCO1FBQ3ZFLGlCQUFPLENBQUM7UUFEVSxVQUFLLEdBQUwsS0FBSyxDQUFxQjtRQUFVLFNBQUksR0FBSixJQUFJLENBQWE7UUFWakUsV0FBTSxHQUFnQyxJQUFJLHNCQUFTLEVBQW9CLENBQUM7UUFDeEUsc0JBQWlCLEdBQXVCLEVBQUUsQ0FBQztRQUMzQyxVQUFLLEdBQTBCLElBQUksQ0FBQztRQVUxQyxFQUFFLENBQUMsQ0FBQyxLQUFLLFlBQVksTUFBTSxDQUFDLENBQUMsQ0FBQztZQUM1QixJQUFJLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUM7WUFDMUIsSUFBSSxDQUFDLGlCQUFpQixHQUFHLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQztZQUNoRCxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUM7WUFDeEIsSUFBSSxDQUFDLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDO1FBQ3pCLENBQUM7UUFBQyxJQUFJLENBQUMsQ0FBQztZQUNOLElBQUksQ0FBQyxJQUFJLEdBQUcsS0FBbUIsQ0FBQztZQUNoQyxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7UUFDdkIsQ0FBQztJQUNILENBQUM7SUFFTSx1QkFBTyxHQUFkO1FBQ0UsTUFBTSxDQUFDLE9BQU8sR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssRUFBRSxHQUFHLEdBQUcsR0FBRyxJQUFJLENBQUMsSUFBSSxHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBQzdELENBQUM7SUFLTSx3Q0FBd0IsR0FBL0IsVUFBZ0MsSUFBWTtRQUMxQyxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN2QyxFQUFFLENBQUMsQ0FBQyxLQUFLLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQztZQUNuQixNQUFNLG9CQUFRLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzlCLENBQUM7UUFDRCxFQUFFLENBQUMsQ0FBQyx3QkFBVyxDQUFtQixLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDekMsTUFBTSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUN6QixDQUFDO1FBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLHVCQUFVLENBQW1CLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMvQyxNQUFNLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ3pCLENBQUM7SUFDSCxDQUFDO0lBRU0sMENBQTBCLEdBQWpDLFVBQWtDLEtBQWE7UUFDN0MsSUFBSSxRQUFRLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzdDLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztZQUNkLE1BQU0sSUFBSSxVQUFVLENBQUMsOEJBQTRCLEtBQUssTUFBRyxDQUFDLENBQUM7UUFDN0QsQ0FBQztRQUNELE1BQU0sQ0FBQyxRQUFRLENBQUM7SUFDbEIsQ0FBQztJQUVNLGtEQUFrQyxHQUF6QztRQUNFLE1BQU0sQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsTUFBTSxDQUFDO0lBQ3ZDLENBQUM7SUFFTSx3Q0FBd0IsR0FBL0I7UUFDRSxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztJQUNwQixDQUFDO0lBRWEsaUJBQVcsR0FBekIsY0FBdUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFFOUMseUJBQVMsR0FBaEIsVUFBaUIsSUFBWSxFQUFFLEVBQXlDO1FBRXRFLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUMxQixDQUFDO0lBRU0sMEJBQVUsR0FBakI7UUFDRSxNQUFNLENBQUMsSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVNLDZCQUFhLEdBQXBCO1FBQ0UsTUFBTSxDQUFDLEtBQUssQ0FBQztJQUNmLENBQUM7SUFFTSw2QkFBYSxHQUFwQjtRQUNFLE1BQU0sQ0FBQyxLQUFLLENBQUM7SUFDZixDQUFDO0lBRU0sNkJBQWEsR0FBcEI7UUFDRSxNQUFNLENBQUMsSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVNLHdCQUFRLEdBQWYsVUFBZ0IsSUFBWSxFQUFFLE9BQWdCO1FBQzVDLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3ZDLEVBQUUsQ0FBQyxDQUFDLEtBQUssS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQ25CLE1BQU0sb0JBQVEsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDOUIsQ0FBQztRQUNELElBQUksS0FBWSxDQUFDO1FBQ2pCLEVBQUUsQ0FBQyxDQUFDLHdCQUFXLENBQW1CLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN6QyxLQUFLLEdBQUcsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ3JDLENBQUM7UUFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsdUJBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDN0IsS0FBSyxHQUFHLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUMzQixDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDTixNQUFNLElBQUksb0JBQVEsQ0FBQyxxQkFBUyxDQUFDLE1BQU0sRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1FBQ3pELENBQUM7UUFDRCxNQUFNLENBQUMsS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUVNLHdCQUFRLEdBQWYsVUFBZ0IsSUFBWSxFQUFFLEtBQWUsRUFBRSxJQUFZO1FBRXpELEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDeEIsTUFBTSxJQUFJLG9CQUFRLENBQUMscUJBQVMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDNUMsQ0FBQztRQUVELElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3ZDLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztZQUNYLE1BQU0sb0JBQVEsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDOUIsQ0FBQztRQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyx3QkFBVyxDQUFtQixLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDaEQsSUFBSSxRQUFRLEdBQUcsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQy9CLElBQUksS0FBSyxHQUFHLFFBQVEsQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNoQyxNQUFNLENBQUMsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ2pDLEtBQUssc0JBQVUsQ0FBQyxlQUFlLENBQUM7Z0JBQ2hDLEtBQUssc0JBQVUsQ0FBQyxhQUFhO29CQUMzQixNQUFNLG9CQUFRLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUM5QixLQUFLLHNCQUFVLENBQUMsR0FBRztvQkFDakIsTUFBTSxDQUFDLElBQUksWUFBWSxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsUUFBUSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7Z0JBQ25GO29CQUNFLE1BQU0sSUFBSSxvQkFBUSxDQUFDLHFCQUFTLENBQUMsTUFBTSxFQUFFLDBCQUEwQixDQUFDLENBQUM7WUFDckUsQ0FBQztRQUNILENBQUM7UUFBQyxJQUFJLENBQUMsQ0FBQztZQUNOLE1BQU0sb0JBQVEsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDOUIsQ0FBQztJQUNILENBQUM7SUFFTSwyQkFBVyxHQUFsQixVQUFtQixJQUFZO1FBRTdCLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3ZDLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztZQUNYLE1BQU0sb0JBQVEsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDOUIsQ0FBQztRQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyx1QkFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM3QixNQUFNLENBQUMsS0FBSyxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQzVCLENBQUM7UUFBQyxJQUFJLENBQUMsQ0FBQztZQUNOLE1BQU0sb0JBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDL0IsQ0FBQztJQUNILENBQUM7SUFLTSw0QkFBWSxHQUFuQixVQUFvQixLQUFhLEVBQUUsUUFBZ0IsRUFBRSxJQUFjO1FBRWpFLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztRQUMzQyxJQUFJLENBQUM7WUFDSCxJQUFJLE1BQU0sR0FBb0MsRUFBRSxDQUFDO1lBQ2pELElBQUksTUFBTSxHQUFZLE1BQU0sQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUN6QyxFQUFFLENBQUMsQ0FBQyxRQUFRLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDdEIsTUFBTSxDQUFDLG1CQUFZLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDOUIsQ0FBQztZQUNELE1BQU0sQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ25DLENBQUM7Z0JBQVMsQ0FBQztZQUNULEVBQUUsQ0FBQyxTQUFTLEVBQUUsQ0FBQztRQUNqQixDQUFDO0lBQ0gsQ0FBQztJQU1jLGFBQU8sR0FBdEIsVUFBdUIsSUFBZ0I7UUFPckMsSUFBSSxXQUFXLEdBQUcsRUFBRSxDQUFDO1FBQ3JCLElBQUksU0FBUyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsV0FBVyxHQUFHLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBR2hFLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLFdBQVcsRUFBRSxDQUFDLEdBQUcsU0FBUyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7WUFFN0MsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxLQUFLLFVBQVUsQ0FBQyxDQUFDLENBQUM7Z0JBQ3RELE1BQU0sQ0FBQyxJQUFJLHFCQUFxQixDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2hFLENBQUM7UUFDSCxDQUFDO1FBQ0QsTUFBTSxJQUFJLG9CQUFRLENBQUMscUJBQVMsQ0FBQyxNQUFNLEVBQUUsd0VBQXdFLENBQUMsQ0FBQztJQUNqSCxDQUFDO0lBRWMsZ0JBQVUsR0FBekIsVUFBMEIsRUFBb0IsRUFBRSxLQUFrQztRQUdoRixJQUFJLFFBQVEsR0FBRyxFQUFFLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDN0IsRUFBRSxDQUFDLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUM7WUFBQyxNQUFNLElBQUksS0FBSyxDQUFDLHNCQUFzQixDQUFDLENBQUM7UUFFeEUsRUFBRSxDQUFDLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDakQsUUFBUSxHQUFHLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxNQUFNLEdBQUMsQ0FBQyxDQUFDLENBQUM7UUFDbkQsQ0FBQztRQUVELEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDckIsS0FBSyxDQUFDLFdBQVcsQ0FBQyxHQUFHLEdBQUcsUUFBUSxFQUFFLElBQUkscUJBQVEsQ0FBbUIsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUN4RSxDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDTixLQUFLLENBQUMsV0FBVyxDQUFDLEdBQUcsR0FBRyxRQUFRLEVBQUUsSUFBSSxzQkFBUyxDQUFtQixFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3pFLENBQUM7SUFDSCxDQUFDO0lBRWMsNEJBQXNCLEdBQXJDLFVBQXNDLElBQWdCLEVBQUUsS0FBa0MsRUFBRSxLQUFhLEVBQUUsS0FBYSxFQUFFLEVBQTRCLEVBQUUsU0FBNkIsRUFBRSxJQUEyQjtRQUNoTixFQUFFLENBQUMsQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQztZQUNsQixJQUFJLEtBQUssR0FBRyxDQUFDLENBQUM7WUFDZCxPQUFPLEtBQUssRUFBRSxHQUFHLEdBQUcsSUFBSSxLQUFLLEdBQUcsS0FBSyxFQUFFLENBQUM7Z0JBQ3RDLElBQU0sRUFBRSxHQUFxQixJQUFJLGdCQUFnQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7Z0JBQzNFLEtBQUssQ0FBQyxVQUFVLENBQUMsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO2dCQUM1QixLQUFLLElBQUksRUFBRSxDQUFDLFNBQVMsRUFBRSxDQUFDO2dCQUN4QixTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQ3JCLENBQUM7WUFDRCxZQUFZLENBQUM7Z0JBQ1gsS0FBSyxDQUFDLHNCQUFzQixDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQy9FLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUFDLElBQUksQ0FBQyxDQUFDO1lBQ04sRUFBRSxDQUFDLElBQUksTUFBTSxDQUFDLEtBQUssRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDL0MsQ0FBQztJQUNILENBQUM7SUFFTSxrQkFBWSxHQUFuQixVQUFvQixJQUFnQixFQUFFLEVBQTRCO1FBQ2hFLElBQU0sS0FBSyxHQUFnQyxJQUFJLHNCQUFTLEVBQW9CLENBQUM7UUFDN0UsSUFBTSxJQUFJLEdBQTBCLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDeEQsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxLQUFLLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUM1QyxNQUFNLElBQUksb0JBQVEsQ0FBQyxxQkFBUyxDQUFDLE1BQU0sRUFBRSwyQ0FBMkMsQ0FBQyxDQUFDO1FBRXBGLElBQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUM5QixFQUFFLENBQUMsQ0FBQyxLQUFLLEtBQUssVUFBVSxDQUFDO1lBQ3ZCLE1BQU0sSUFBSSxvQkFBUSxDQUFDLHFCQUFTLENBQUMsTUFBTSxFQUFFLCtCQUErQixDQUFDLENBQUM7UUFDeEUsSUFBTSxLQUFLLEdBQUcsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUNwQyxLQUFLLENBQUMsc0JBQXNCLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDeEUsQ0FBQztJQUVPLDZCQUFhLEdBQXJCO1FBQ0UsSUFBSSxJQUFJLEdBQTBCLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDeEUsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxLQUFLLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUM1QyxNQUFNLElBQUksb0JBQVEsQ0FBQyxxQkFBUyxDQUFDLE1BQU0sRUFBRSwyQ0FBMkMsQ0FBQyxDQUFDO1FBRXBGLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUM1QixFQUFFLENBQUMsQ0FBQyxLQUFLLEtBQUssVUFBVSxDQUFDO1lBQ3ZCLE1BQU0sSUFBSSxvQkFBUSxDQUFDLHFCQUFTLENBQUMsTUFBTSxFQUFFLCtCQUErQixDQUFDLENBQUM7UUFDeEUsSUFBSSxLQUFLLEdBQUcsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUNsQyxPQUFPLEtBQUssR0FBRyxLQUFLLEVBQUUsQ0FBQztZQUNyQixJQUFNLEVBQUUsR0FBcUIsSUFBSSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7WUFDckYsS0FBSyxJQUFJLEVBQUUsQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUN4QixLQUFLLENBQUMsVUFBVSxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDbEMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNsQyxDQUFDO0lBQ0gsQ0FBQztJQUNILFlBQUM7QUFBRCxDQUFDLEFBalBELENBQW1DLFdBQVcsQ0FBQyxxQkFBcUIsR0FpUG5FO0FBalBEOzBCQWlQQyxDQUFBIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBaaXAgZmlsZS1iYWNrZWQgZmlsZXN5c3RlbVxuICogSW1wbGVtZW50ZWQgYWNjb3JkaW5nIHRvIHRoZSBzdGFuZGFyZDpcbiAqIGh0dHA6Ly93d3cucGt3YXJlLmNvbS9kb2N1bWVudHMvY2FzZXN0dWRpZXMvQVBQTk9URS5UWFRcbiAqXG4gKiBXaGlsZSB0aGVyZSBhcmUgYSBmZXcgemlwIGxpYnJhcmllcyBmb3IgSmF2YVNjcmlwdCAoZS5nLiBKU1ppcCBhbmQgemlwLmpzKSxcbiAqIHRoZXkgYXJlIG5vdCBhIGdvb2QgbWF0Y2ggZm9yIEJyb3dzZXJGUy4gSW4gcGFydGljdWxhciwgdGhlc2UgbGlicmFyaWVzXG4gKiBwZXJmb3JtIGEgbG90IG9mIHVubmVlZGVkIGRhdGEgY29weWluZywgYW5kIGVhZ2VybHkgZGVjb21wcmVzcyBldmVyeSBmaWxlXG4gKiBpbiB0aGUgemlwIGZpbGUgdXBvbiBsb2FkaW5nIHRvIGNoZWNrIHRoZSBDUkMzMi4gVGhleSBhbHNvIGVhZ2VybHkgZGVjb2RlXG4gKiBzdHJpbmdzLiBGdXJ0aGVybW9yZSwgdGhlc2UgbGlicmFyaWVzIGR1cGxpY2F0ZSBmdW5jdGlvbmFsaXR5IGFscmVhZHkgcHJlc2VudFxuICogaW4gQnJvd3NlckZTIChlLmcuIFVURi04IGRlY29kaW5nIGFuZCBiaW5hcnkgZGF0YSBtYW5pcHVsYXRpb24pLlxuICpcbiAqIFRoaXMgZmlsZXN5c3RlbSB0YWtlcyBhZHZhbnRhZ2Ugb2YgQnJvd3NlckZTJ3MgQnVmZmVyIGltcGxlbWVudGF0aW9uLCB3aGljaFxuICogZWZmaWNpZW50bHkgcmVwcmVzZW50cyB0aGUgemlwIGZpbGUgaW4gbWVtb3J5IChpbiBib3RoIEFycmF5QnVmZmVyLWVuYWJsZWRcbiAqIGJyb3dzZXJzICphbmQqIG5vbi1BcnJheUJ1ZmZlciBicm93c2VycyksIGFuZCB3aGljaCBjYW4gbmVhdGx5IGJlICdzbGljZWQnXG4gKiB3aXRob3V0IGNvcHlpbmcgZGF0YS4gRWFjaCBzdHJ1Y3QgZGVmaW5lZCBpbiB0aGUgc3RhbmRhcmQgaXMgcmVwcmVzZW50ZWQgd2l0aFxuICogYSBidWZmZXIgc2xpY2UgcG9pbnRpbmcgdG8gYW4gb2Zmc2V0IGluIHRoZSB6aXAgZmlsZSwgYW5kIGhhcyBnZXR0ZXJzIGZvclxuICogZWFjaCBmaWVsZC4gQXMgd2UgYW50aWNpcGF0ZSB0aGF0IHRoaXMgZGF0YSB3aWxsIG5vdCBiZSByZWFkIG9mdGVuLCB3ZSBjaG9vc2VcbiAqIG5vdCB0byBzdG9yZSBlYWNoIHN0cnVjdCBmaWVsZCBpbiB0aGUgSmF2YVNjcmlwdCBvYmplY3Q7IGluc3RlYWQsIHRvIHJlZHVjZVxuICogbWVtb3J5IGNvbnN1bXB0aW9uLCB3ZSByZXRyaWV2ZSBpdCBkaXJlY3RseSBmcm9tIHRoZSBiaW5hcnkgZGF0YSBlYWNoIHRpbWUgaXRcbiAqIGlzIHJlcXVlc3RlZC5cbiAqXG4gKiBXaGVuIHRoZSBmaWxlc3lzdGVtIGlzIGluc3RhbnRpYXRlZCwgd2UgZGV0ZXJtaW5lIHRoZSBkaXJlY3Rvcnkgc3RydWN0dXJlXG4gKiBvZiB0aGUgemlwIGZpbGUgYXMgcXVpY2tseSBhcyBwb3NzaWJsZS4gV2UgbGF6aWx5IGRlY29tcHJlc3MgYW5kIGNoZWNrIHRoZVxuICogQ1JDMzIgb2YgZmlsZXMuIFdlIGRvIG5vdCBjYWNoZSBkZWNvbXByZXNzZWQgZmlsZXM7IGlmIHRoaXMgaXMgYSBkZXNpcmVkXG4gKiBmZWF0dXJlLCBpdCBpcyBiZXN0IGltcGxlbWVudGVkIGFzIGEgZ2VuZXJpYyBmaWxlIHN5c3RlbSB3cmFwcGVyIHRoYXQgY2FuXG4gKiBjYWNoZSBkYXRhIGZyb20gYXJiaXRyYXJ5IGZpbGUgc3lzdGVtcy5cbiAqXG4gKiBGb3IgaW5mbGF0aW9uLCB3ZSB1c2UgYHBham9gJ3MgaW1wbGVtZW50YXRpb246XG4gKiBodHRwczovL2dpdGh1Yi5jb20vbm9kZWNhL3Bha29cbiAqXG4gKiBVbmZvcnR1bmF0ZWx5LCB0aGVpciBpbXBsZW1lbnRhdGlvbiBmYWxscyBiYWNrIHRvIGFuIGFycmF5IG9mIGJ5dGVzIGZvciBub24tXG4gKiBUeXBlZEFycmF5IGJyb3dzZXJzLCB3aGljaCBpcyByZXN1bHRzIGluIGEgbXVjaCBsYXJnZXIgbWVtb3J5IGZvb3RwcmludCBpblxuICogdGhvc2UgYnJvd3NlcnMuIFBlcmhhcHMgb25lIGRheSB3ZSdsbCBoYXZlIGFuIGltcGxlbWVudGF0aW9uIG9mIGluZmxhdGUgdGhhdFxuICogd29ya3Mgb24gQnVmZmVycz8gOilcbiAqXG4gKiBDdXJyZW50IGxpbWl0YXRpb25zOlxuICogKiBObyBlbmNyeXB0aW9uLlxuICogKiBObyBaSVA2NCBzdXBwb3J0LlxuICogKiBSZWFkLW9ubHkuXG4gKiAgIFdyaXRlIHN1cHBvcnQgd291bGQgcmVxdWlyZSB0aGF0IHdlOlxuICogICAtIEtlZXAgdHJhY2sgb2YgY2hhbmdlZC9uZXcgZmlsZXMuXG4gKiAgIC0gQ29tcHJlc3MgY2hhbmdlZCBmaWxlcywgYW5kIGdlbmVyYXRlIGFwcHJvcHJpYXRlIG1ldGFkYXRhIGZvciBlYWNoLlxuICogICAtIFVwZGF0ZSBmaWxlIG9mZnNldHMgZm9yIG90aGVyIGZpbGVzIGluIHRoZSB6aXAgZmlsZS5cbiAqICAgLSBTdHJlYW0gaXQgb3V0IHRvIGEgbG9jYXRpb24uXG4gKiAgIFRoaXMgaXNuJ3QgdGhhdCBiYWQsIHNvIHdlIG1pZ2h0IGRvIHRoaXMgYXQgYSBsYXRlciBkYXRlLlxuICovXG5pbXBvcnQge0FwaUVycm9yLCBFcnJvckNvZGV9IGZyb20gJy4uL2NvcmUvYXBpX2Vycm9yJztcbmltcG9ydCB7ZGVmYXVsdCBhcyBTdGF0cywgRmlsZVR5cGV9IGZyb20gJy4uL2NvcmUvbm9kZV9mc19zdGF0cyc7XG5pbXBvcnQgZmlsZV9zeXN0ZW0gPSByZXF1aXJlKCcuLi9jb3JlL2ZpbGVfc3lzdGVtJyk7XG5pbXBvcnQgZmlsZSA9IHJlcXVpcmUoJy4uL2NvcmUvZmlsZScpO1xuaW1wb3J0IHtGaWxlRmxhZywgQWN0aW9uVHlwZX0gZnJvbSAnLi4vY29yZS9maWxlX2ZsYWcnO1xuaW1wb3J0IHByZWxvYWRfZmlsZSA9IHJlcXVpcmUoJy4uL2dlbmVyaWMvcHJlbG9hZF9maWxlJyk7XG5pbXBvcnQge0FycmF5aXNoLCBidWZmZXIyQXJyYXlpc2gsIGFycmF5aXNoMkJ1ZmZlciwgY29weWluZ1NsaWNlfSBmcm9tICcuLi9jb3JlL3V0aWwnO1xuaW1wb3J0IEV4dGVuZGVkQVNDSUkgZnJvbSAnYmZzLWJ1ZmZlci9qcy9leHRlbmRlZF9hc2NpaSc7XG52YXIgaW5mbGF0ZVJhdzoge1xuICAoZGF0YTogQXJyYXlpc2g8bnVtYmVyPiwgb3B0aW9ucz86IHtcbiAgICBjaHVua1NpemU6IG51bWJlcjtcbiAgfSk6IEFycmF5aXNoPG51bWJlcj47XG59ID0gcmVxdWlyZSgncGFrby9kaXN0L3Bha29faW5mbGF0ZS5taW4nKS5pbmZsYXRlUmF3O1xuaW1wb3J0IHtGaWxlSW5kZXgsIERpcklub2RlLCBGaWxlSW5vZGUsIGlzRGlySW5vZGUsIGlzRmlsZUlub2RlfSBmcm9tICcuLi9nZW5lcmljL2ZpbGVfaW5kZXgnO1xuXG5cbi8qKlxuICogNC40LjIuMjogSW5kaWNhdGVzIHRoZSBjb21wYXRpYmlsdGl5IG9mIGEgZmlsZSdzIGV4dGVybmFsIGF0dHJpYnV0ZXMuXG4gKi9cbmV4cG9ydCBlbnVtIEV4dGVybmFsRmlsZUF0dHJpYnV0ZVR5cGUge1xuICBNU0RPUyA9IDAsIEFNSUdBID0gMSwgT1BFTlZNUyA9IDIsIFVOSVggPSAzLCBWTV9DTVMgPSA0LCBBVEFSSV9TVCA9IDUsXG4gIE9TMl9IUEZTID0gNiwgTUFDID0gNywgWl9TWVNURU0gPSA4LCBDUF9NID0gOSwgTlRGUyA9IDEwLCBNVlMgPSAxMSwgVlNFID0gMTIsXG4gIEFDT1JOX1JJU0MgPSAxMywgVkZBVCA9IDE0LCBBTFRfTVZTID0gMTUsIEJFT1MgPSAxNiwgVEFOREVNID0gMTcsIE9TXzQwMCA9IDE4LFxuICBPU1ggPSAxOVxufVxuXG4vKipcbiAqIDQuNC41XG4gKi9cbmV4cG9ydCBlbnVtIENvbXByZXNzaW9uTWV0aG9kIHtcbiAgU1RPUkVEID0gMCwgICAgIC8vIFRoZSBmaWxlIGlzIHN0b3JlZCAobm8gY29tcHJlc3Npb24pXG4gIFNIUlVOSyA9IDEsICAgICAvLyBUaGUgZmlsZSBpcyBTaHJ1bmtcbiAgUkVEVUNFRF8xID0gMiwgIC8vIFRoZSBmaWxlIGlzIFJlZHVjZWQgd2l0aCBjb21wcmVzc2lvbiBmYWN0b3IgMVxuICBSRURVQ0VEXzIgPSAzLCAgLy8gVGhlIGZpbGUgaXMgUmVkdWNlZCB3aXRoIGNvbXByZXNzaW9uIGZhY3RvciAyXG4gIFJFRFVDRURfMyA9IDQsICAvLyBUaGUgZmlsZSBpcyBSZWR1Y2VkIHdpdGggY29tcHJlc3Npb24gZmFjdG9yIDNcbiAgUkVEVUNFRF80ID0gNSwgIC8vIFRoZSBmaWxlIGlzIFJlZHVjZWQgd2l0aCBjb21wcmVzc2lvbiBmYWN0b3IgNFxuICBJTVBMT0RFID0gNiwgICAgLy8gVGhlIGZpbGUgaXMgSW1wbG9kZWRcbiAgREVGTEFURSA9IDgsICAgIC8vIFRoZSBmaWxlIGlzIERlZmxhdGVkXG4gIERFRkxBVEU2NCA9IDksICAvLyBFbmhhbmNlZCBEZWZsYXRpbmcgdXNpbmcgRGVmbGF0ZTY0KHRtKVxuICBURVJTRV9PTEQgPSAxMCwgLy8gUEtXQVJFIERhdGEgQ29tcHJlc3Npb24gTGlicmFyeSBJbXBsb2RpbmcgKG9sZCBJQk0gVEVSU0UpXG4gIEJaSVAyID0gMTIsICAgICAvLyBGaWxlIGlzIGNvbXByZXNzZWQgdXNpbmcgQlpJUDIgYWxnb3JpdGhtXG4gIExaTUEgPSAxNCwgICAgICAvLyBMWk1BIChFRlMpXG4gIFRFUlNFX05FVyA9IDE4LCAvLyBGaWxlIGlzIGNvbXByZXNzZWQgdXNpbmcgSUJNIFRFUlNFIChuZXcpXG4gIExaNzcgPSAxOSwgICAgICAvLyBJQk0gTFo3NyB6IEFyY2hpdGVjdHVyZSAoUEZTKVxuICBXQVZQQUNLID0gOTcsICAgLy8gV2F2UGFjayBjb21wcmVzc2VkIGRhdGFcbiAgUFBNRCA9IDk4ICAgICAgIC8vIFBQTWQgdmVyc2lvbiBJLCBSZXYgMVxufVxuXG4vKipcbiAqIENvbnZlcnRzIHRoZSBpbnB1dCB0aW1lIGFuZCBkYXRlIGluIE1TLURPUyBmb3JtYXQgaW50byBhIEphdmFTY3JpcHQgRGF0ZVxuICogb2JqZWN0LlxuICovXG5mdW5jdGlvbiBtc2RvczJkYXRlKHRpbWU6IG51bWJlciwgZGF0ZTogbnVtYmVyKTogRGF0ZSB7XG4gIC8vIE1TLURPUyBEYXRlXG4gIC8vfDAgMCAwIDAgIDB8MCAwIDAgIDB8MCAwIDAgIDAgMCAwIDBcbiAgLy8gIEQgKDEtMzEpICBNICgxLTIzKSAgWSAoZnJvbSAxOTgwKVxuICB2YXIgZGF5ID0gZGF0ZSAmIDB4MUY7XG4gIC8vIEpTIGRhdGUgaXMgMC1pbmRleGVkLCBET1MgaXMgMS1pbmRleGVkLlxuICB2YXIgbW9udGggPSAoKGRhdGUgPj4gNSkgJiAweEYpIC0gMTtcbiAgdmFyIHllYXIgPSAoZGF0ZSA+PiA5KSArIDE5ODA7XG4gIC8vIE1TIERPUyBUaW1lXG4gIC8vfDAgMCAwIDAgIDB8MCAwIDAgIDAgMCAwfDAgIDAgMCAwIDBcbiAgLy8gICBTZWNvbmQgICAgICBNaW51dGUgICAgICAgSG91clxuICB2YXIgc2Vjb25kID0gdGltZSAmIDB4MUY7XG4gIHZhciBtaW51dGUgPSAodGltZSA+PiA1KSAmIDB4M0Y7XG4gIHZhciBob3VyID0gdGltZSA+PiAxMTtcbiAgcmV0dXJuIG5ldyBEYXRlKHllYXIsIG1vbnRoLCBkYXksIGhvdXIsIG1pbnV0ZSwgc2Vjb25kKTtcbn1cblxuLyoqXG4gKiBTYWZlbHkgcmV0dXJucyB0aGUgc3RyaW5nIGZyb20gdGhlIGJ1ZmZlciwgZXZlbiBpZiBpdCBpcyAwIGJ5dGVzIGxvbmcuXG4gKiAoTm9ybWFsbHksIGNhbGxpbmcgdG9TdHJpbmcoKSBvbiBhIGJ1ZmZlciB3aXRoIHN0YXJ0ID09PSBlbmQgY2F1c2VzIGFuXG4gKiBleGNlcHRpb24pLlxuICovXG5mdW5jdGlvbiBzYWZlVG9TdHJpbmcoYnVmZjogTm9kZUJ1ZmZlciwgdXNlVVRGODogYm9vbGVhbiwgc3RhcnQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIpOiBzdHJpbmcge1xuICBpZiAobGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIFwiXCI7XG4gIH0gZWxzZSBpZiAodXNlVVRGOCkge1xuICAgIHJldHVybiBidWZmLnRvU3RyaW5nKCd1dGY4Jywgc3RhcnQsIHN0YXJ0ICsgbGVuZ3RoKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gRXh0ZW5kZWRBU0NJSS5ieXRlMnN0cihidWZmLnNsaWNlKHN0YXJ0LCBzdGFydCArIGxlbmd0aCkpO1xuICB9XG59XG5cbi8qXG4gICA0LjMuNiBPdmVyYWxsIC5aSVAgZmlsZSBmb3JtYXQ6XG5cbiAgICAgIFtsb2NhbCBmaWxlIGhlYWRlciAxXVxuICAgICAgW2VuY3J5cHRpb24gaGVhZGVyIDFdXG4gICAgICBbZmlsZSBkYXRhIDFdXG4gICAgICBbZGF0YSBkZXNjcmlwdG9yIDFdXG4gICAgICAuXG4gICAgICAuXG4gICAgICAuXG4gICAgICBbbG9jYWwgZmlsZSBoZWFkZXIgbl1cbiAgICAgIFtlbmNyeXB0aW9uIGhlYWRlciBuXVxuICAgICAgW2ZpbGUgZGF0YSBuXVxuICAgICAgW2RhdGEgZGVzY3JpcHRvciBuXVxuICAgICAgW2FyY2hpdmUgZGVjcnlwdGlvbiBoZWFkZXJdXG4gICAgICBbYXJjaGl2ZSBleHRyYSBkYXRhIHJlY29yZF1cbiAgICAgIFtjZW50cmFsIGRpcmVjdG9yeSBoZWFkZXIgMV1cbiAgICAgIC5cbiAgICAgIC5cbiAgICAgIC5cbiAgICAgIFtjZW50cmFsIGRpcmVjdG9yeSBoZWFkZXIgbl1cbiAgICAgIFt6aXA2NCBlbmQgb2YgY2VudHJhbCBkaXJlY3RvcnkgcmVjb3JkXVxuICAgICAgW3ppcDY0IGVuZCBvZiBjZW50cmFsIGRpcmVjdG9yeSBsb2NhdG9yXVxuICAgICAgW2VuZCBvZiBjZW50cmFsIGRpcmVjdG9yeSByZWNvcmRdXG4qL1xuXG4vKlxuIDQuMy43ICBMb2NhbCBmaWxlIGhlYWRlcjpcblxuICAgICAgbG9jYWwgZmlsZSBoZWFkZXIgc2lnbmF0dXJlICAgICA0IGJ5dGVzICAoMHgwNDAzNGI1MClcbiAgICAgIHZlcnNpb24gbmVlZGVkIHRvIGV4dHJhY3QgICAgICAgMiBieXRlc1xuICAgICAgZ2VuZXJhbCBwdXJwb3NlIGJpdCBmbGFnICAgICAgICAyIGJ5dGVzXG4gICAgICBjb21wcmVzc2lvbiBtZXRob2QgICAgICAgICAgICAgIDIgYnl0ZXNcbiAgICAgIGxhc3QgbW9kIGZpbGUgdGltZSAgICAgICAgICAgICAgMiBieXRlc1xuICAgICAgbGFzdCBtb2QgZmlsZSBkYXRlICAgICAgICAgICAgICAyIGJ5dGVzXG4gICAgICBjcmMtMzIgICAgICAgICAgICAgICAgICAgICAgICAgIDQgYnl0ZXNcbiAgICAgIGNvbXByZXNzZWQgc2l6ZSAgICAgICAgICAgICAgICAgNCBieXRlc1xuICAgICAgdW5jb21wcmVzc2VkIHNpemUgICAgICAgICAgICAgICA0IGJ5dGVzXG4gICAgICBmaWxlIG5hbWUgbGVuZ3RoICAgICAgICAgICAgICAgIDIgYnl0ZXNcbiAgICAgIGV4dHJhIGZpZWxkIGxlbmd0aCAgICAgICAgICAgICAgMiBieXRlc1xuXG4gICAgICBmaWxlIG5hbWUgKHZhcmlhYmxlIHNpemUpXG4gICAgICBleHRyYSBmaWVsZCAodmFyaWFibGUgc2l6ZSlcbiAqL1xuZXhwb3J0IGNsYXNzIEZpbGVIZWFkZXIge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGRhdGE6IE5vZGVCdWZmZXIpIHtcbiAgICBpZiAoZGF0YS5yZWFkVUludDMyTEUoMCkgIT09IDB4MDQwMzRiNTApIHtcbiAgICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMLCBcIkludmFsaWQgWmlwIGZpbGU6IExvY2FsIGZpbGUgaGVhZGVyIGhhcyBpbnZhbGlkIHNpZ25hdHVyZTogXCIgKyB0aGlzLmRhdGEucmVhZFVJbnQzMkxFKDApKTtcbiAgICB9XG4gIH1cbiAgcHVibGljIHZlcnNpb25OZWVkZWQoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMuZGF0YS5yZWFkVUludDE2TEUoNCk7IH1cbiAgcHVibGljIGZsYWdzKCk6IG51bWJlciB7IHJldHVybiB0aGlzLmRhdGEucmVhZFVJbnQxNkxFKDYpOyB9XG4gIHB1YmxpYyBjb21wcmVzc2lvbk1ldGhvZCgpOiBDb21wcmVzc2lvbk1ldGhvZCB7IHJldHVybiB0aGlzLmRhdGEucmVhZFVJbnQxNkxFKDgpOyB9XG4gIHB1YmxpYyBsYXN0TW9kRmlsZVRpbWUoKTogRGF0ZSB7XG4gICAgLy8gVGltZSBhbmQgZGF0ZSBpcyBpbiBNUy1ET1MgZm9ybWF0LlxuICAgIHJldHVybiBtc2RvczJkYXRlKHRoaXMuZGF0YS5yZWFkVUludDE2TEUoMTApLCB0aGlzLmRhdGEucmVhZFVJbnQxNkxFKDEyKSk7XG4gIH1cbiAgcHVibGljIHJhd0xhc3RNb2RGaWxlVGltZSgpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLmRhdGEucmVhZFVJbnQzMkxFKDEwKTtcbiAgfVxuICBwdWJsaWMgY3JjMzIoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMuZGF0YS5yZWFkVUludDMyTEUoMTQpOyB9XG4gIC8qKlxuICAgKiBUaGVzZSB0d28gdmFsdWVzIGFyZSBDT01QTEVURUxZIFVTRUxFU1MuXG4gICAqXG4gICAqIFNlY3Rpb24gNC40Ljk6XG4gICAqICAgSWYgYml0IDMgb2YgdGhlIGdlbmVyYWwgcHVycG9zZSBiaXQgZmxhZyBpcyBzZXQsXG4gICAqICAgdGhlc2UgZmllbGRzIGFyZSBzZXQgdG8gemVybyBpbiB0aGUgbG9jYWwgaGVhZGVyIGFuZCB0aGVcbiAgICogICBjb3JyZWN0IHZhbHVlcyBhcmUgcHV0IGluIHRoZSBkYXRhIGRlc2NyaXB0b3IgYW5kXG4gICAqICAgaW4gdGhlIGNlbnRyYWwgZGlyZWN0b3J5LlxuICAgKlxuICAgKiBTbyB3ZSdsbCBqdXN0IHVzZSB0aGUgY2VudHJhbCBkaXJlY3RvcnkncyB2YWx1ZXMuXG4gICAqL1xuICAvLyBwdWJsaWMgY29tcHJlc3NlZFNpemUoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMuZGF0YS5yZWFkVUludDMyTEUoMTgpOyB9XG4gIC8vIHB1YmxpYyB1bmNvbXByZXNzZWRTaXplKCk6IG51bWJlciB7IHJldHVybiB0aGlzLmRhdGEucmVhZFVJbnQzMkxFKDIyKTsgfVxuICBwdWJsaWMgZmlsZU5hbWVMZW5ndGgoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMuZGF0YS5yZWFkVUludDE2TEUoMjYpOyB9XG4gIHB1YmxpYyBleHRyYUZpZWxkTGVuZ3RoKCk6IG51bWJlciB7IHJldHVybiB0aGlzLmRhdGEucmVhZFVJbnQxNkxFKDI4KTsgfVxuICBwdWJsaWMgZmlsZU5hbWUoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gc2FmZVRvU3RyaW5nKHRoaXMuZGF0YSwgdGhpcy51c2VVVEY4KCksIDMwLCB0aGlzLmZpbGVOYW1lTGVuZ3RoKCkpO1xuICB9XG4gIHB1YmxpYyBleHRyYUZpZWxkKCk6IE5vZGVCdWZmZXIge1xuICAgIHZhciBzdGFydCA9IDMwICsgdGhpcy5maWxlTmFtZUxlbmd0aCgpO1xuICAgIHJldHVybiB0aGlzLmRhdGEuc2xpY2Uoc3RhcnQsIHN0YXJ0ICsgdGhpcy5leHRyYUZpZWxkTGVuZ3RoKCkpO1xuICB9XG4gIHB1YmxpYyB0b3RhbFNpemUoKTogbnVtYmVyIHsgcmV0dXJuIDMwICsgdGhpcy5maWxlTmFtZUxlbmd0aCgpICsgdGhpcy5leHRyYUZpZWxkTGVuZ3RoKCk7IH1cbiAgcHVibGljIHVzZVVURjgoKTogYm9vbGVhbiB7IHJldHVybiAodGhpcy5mbGFncygpICYgMHg4MDApID09PSAweDgwMDsgfVxufVxuXG4vKipcbiAgNC4zLjggIEZpbGUgZGF0YVxuXG4gICAgSW1tZWRpYXRlbHkgZm9sbG93aW5nIHRoZSBsb2NhbCBoZWFkZXIgZm9yIGEgZmlsZVxuICAgIFNIT1VMRCBiZSBwbGFjZWQgdGhlIGNvbXByZXNzZWQgb3Igc3RvcmVkIGRhdGEgZm9yIHRoZSBmaWxlLlxuICAgIElmIHRoZSBmaWxlIGlzIGVuY3J5cHRlZCwgdGhlIGVuY3J5cHRpb24gaGVhZGVyIGZvciB0aGUgZmlsZVxuICAgIFNIT1VMRCBiZSBwbGFjZWQgYWZ0ZXIgdGhlIGxvY2FsIGhlYWRlciBhbmQgYmVmb3JlIHRoZSBmaWxlXG4gICAgZGF0YS4gVGhlIHNlcmllcyBvZiBbbG9jYWwgZmlsZSBoZWFkZXJdW2VuY3J5cHRpb24gaGVhZGVyXVxuICAgIFtmaWxlIGRhdGFdW2RhdGEgZGVzY3JpcHRvcl0gcmVwZWF0cyBmb3IgZWFjaCBmaWxlIGluIHRoZVxuICAgIC5aSVAgYXJjaGl2ZS5cblxuICAgIFplcm8tYnl0ZSBmaWxlcywgZGlyZWN0b3JpZXMsIGFuZCBvdGhlciBmaWxlIHR5cGVzIHRoYXRcbiAgICBjb250YWluIG5vIGNvbnRlbnQgTVVTVCBub3QgaW5jbHVkZSBmaWxlIGRhdGEuXG4qL1xuZXhwb3J0IGNsYXNzIEZpbGVEYXRhIHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBoZWFkZXI6IEZpbGVIZWFkZXIsIHByaXZhdGUgcmVjb3JkOiBDZW50cmFsRGlyZWN0b3J5LCBwcml2YXRlIGRhdGE6IE5vZGVCdWZmZXIpIHt9XG4gIHB1YmxpYyBkZWNvbXByZXNzKCk6IE5vZGVCdWZmZXIge1xuICAgIC8vIENoZWNrIHRoZSBjb21wcmVzc2lvblxuICAgIHZhciBjb21wcmVzc2lvbk1ldGhvZDogQ29tcHJlc3Npb25NZXRob2QgPSB0aGlzLmhlYWRlci5jb21wcmVzc2lvbk1ldGhvZCgpO1xuICAgIHN3aXRjaCAoY29tcHJlc3Npb25NZXRob2QpIHtcbiAgICAgIGNhc2UgQ29tcHJlc3Npb25NZXRob2QuREVGTEFURTpcbiAgICAgICAgdmFyIGRhdGEgPSBpbmZsYXRlUmF3KFxuICAgICAgICAgIGJ1ZmZlcjJBcnJheWlzaCh0aGlzLmRhdGEuc2xpY2UoMCwgdGhpcy5yZWNvcmQuY29tcHJlc3NlZFNpemUoKSkpLFxuICAgICAgICAgIHsgY2h1bmtTaXplOiB0aGlzLnJlY29yZC51bmNvbXByZXNzZWRTaXplKCkgfVxuICAgICAgICApO1xuICAgICAgICByZXR1cm4gYXJyYXlpc2gyQnVmZmVyKGRhdGEpO1xuICAgICAgY2FzZSBDb21wcmVzc2lvbk1ldGhvZC5TVE9SRUQ6XG4gICAgICAgIC8vIEdyYWIgYW5kIGNvcHkuXG4gICAgICAgIHJldHVybiBjb3B5aW5nU2xpY2UodGhpcy5kYXRhLCAwLCB0aGlzLnJlY29yZC51bmNvbXByZXNzZWRTaXplKCkpO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdmFyIG5hbWU6IHN0cmluZyA9IENvbXByZXNzaW9uTWV0aG9kW2NvbXByZXNzaW9uTWV0aG9kXTtcbiAgICAgICAgbmFtZSA9IG5hbWUgPyBuYW1lIDogXCJVbmtub3duOiBcIiArIGNvbXByZXNzaW9uTWV0aG9kO1xuICAgICAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTlZBTCwgXCJJbnZhbGlkIGNvbXByZXNzaW9uIG1ldGhvZCBvbiBmaWxlICdcIiArIHRoaXMuaGVhZGVyLmZpbGVOYW1lKCkgKyBcIic6IFwiICsgbmFtZSk7XG4gICAgfVxuICB9XG4gIHB1YmxpYyBnZXRIZWFkZXIoKTogRmlsZUhlYWRlciB7XG4gICAgcmV0dXJuIHRoaXMuaGVhZGVyO1xuICB9XG4gIHB1YmxpYyBnZXRSZWNvcmQoKTogQ2VudHJhbERpcmVjdG9yeSB7XG4gICAgcmV0dXJuIHRoaXMucmVjb3JkO1xuICB9XG4gIHB1YmxpYyBnZXRSYXdEYXRhKCk6IE5vZGVCdWZmZXIge1xuICAgIHJldHVybiB0aGlzLmRhdGE7XG4gIH1cbn1cblxuLypcbiA0LjMuOSAgRGF0YSBkZXNjcmlwdG9yOlxuXG4gICAgICBjcmMtMzIgICAgICAgICAgICAgICAgICAgICAgICAgIDQgYnl0ZXNcbiAgICAgIGNvbXByZXNzZWQgc2l6ZSAgICAgICAgICAgICAgICAgNCBieXRlc1xuICAgICAgdW5jb21wcmVzc2VkIHNpemUgICAgICAgICAgICAgICA0IGJ5dGVzXG4gKi9cbmV4cG9ydCBjbGFzcyBEYXRhRGVzY3JpcHRvciB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgZGF0YTogTm9kZUJ1ZmZlcikge31cbiAgcHVibGljIGNyYzMyKCk6IG51bWJlciB7IHJldHVybiB0aGlzLmRhdGEucmVhZFVJbnQzMkxFKDApOyB9XG4gIHB1YmxpYyBjb21wcmVzc2VkU2l6ZSgpOiBudW1iZXIgeyByZXR1cm4gdGhpcy5kYXRhLnJlYWRVSW50MzJMRSg0KTsgfVxuICBwdWJsaWMgdW5jb21wcmVzc2VkU2l6ZSgpOiBudW1iZXIgeyByZXR1cm4gdGhpcy5kYXRhLnJlYWRVSW50MzJMRSg4KTsgfVxufVxuXG4vKlxuYCA0LjMuMTAgIEFyY2hpdmUgZGVjcnlwdGlvbiBoZWFkZXI6XG5cbiAgICAgIDQuMy4xMC4xIFRoZSBBcmNoaXZlIERlY3J5cHRpb24gSGVhZGVyIGlzIGludHJvZHVjZWQgaW4gdmVyc2lvbiA2LjJcbiAgICAgIG9mIHRoZSBaSVAgZm9ybWF0IHNwZWNpZmljYXRpb24uICBUaGlzIHJlY29yZCBleGlzdHMgaW4gc3VwcG9ydFxuICAgICAgb2YgdGhlIENlbnRyYWwgRGlyZWN0b3J5IEVuY3J5cHRpb24gRmVhdHVyZSBpbXBsZW1lbnRlZCBhcyBwYXJ0IG9mXG4gICAgICB0aGUgU3Ryb25nIEVuY3J5cHRpb24gU3BlY2lmaWNhdGlvbiBhcyBkZXNjcmliZWQgaW4gdGhpcyBkb2N1bWVudC5cbiAgICAgIFdoZW4gdGhlIENlbnRyYWwgRGlyZWN0b3J5IFN0cnVjdHVyZSBpcyBlbmNyeXB0ZWQsIHRoaXMgZGVjcnlwdGlvblxuICAgICAgaGVhZGVyIE1VU1QgcHJlY2VkZSB0aGUgZW5jcnlwdGVkIGRhdGEgc2VnbWVudC5cbiAqL1xuLypcbiAgNC4zLjExICBBcmNoaXZlIGV4dHJhIGRhdGEgcmVjb3JkOlxuXG4gICAgICAgIGFyY2hpdmUgZXh0cmEgZGF0YSBzaWduYXR1cmUgICAgNCBieXRlcyAgKDB4MDgwNjRiNTApXG4gICAgICAgIGV4dHJhIGZpZWxkIGxlbmd0aCAgICAgICAgICAgICAgNCBieXRlc1xuICAgICAgICBleHRyYSBmaWVsZCBkYXRhICAgICAgICAgICAgICAgICh2YXJpYWJsZSBzaXplKVxuXG4gICAgICA0LjMuMTEuMSBUaGUgQXJjaGl2ZSBFeHRyYSBEYXRhIFJlY29yZCBpcyBpbnRyb2R1Y2VkIGluIHZlcnNpb24gNi4yXG4gICAgICBvZiB0aGUgWklQIGZvcm1hdCBzcGVjaWZpY2F0aW9uLiAgVGhpcyByZWNvcmQgTUFZIGJlIHVzZWQgaW4gc3VwcG9ydFxuICAgICAgb2YgdGhlIENlbnRyYWwgRGlyZWN0b3J5IEVuY3J5cHRpb24gRmVhdHVyZSBpbXBsZW1lbnRlZCBhcyBwYXJ0IG9mXG4gICAgICB0aGUgU3Ryb25nIEVuY3J5cHRpb24gU3BlY2lmaWNhdGlvbiBhcyBkZXNjcmliZWQgaW4gdGhpcyBkb2N1bWVudC5cbiAgICAgIFdoZW4gcHJlc2VudCwgdGhpcyByZWNvcmQgTVVTVCBpbW1lZGlhdGVseSBwcmVjZWRlIHRoZSBjZW50cmFsXG4gICAgICBkaXJlY3RvcnkgZGF0YSBzdHJ1Y3R1cmUuXG4qL1xuZXhwb3J0IGNsYXNzIEFyY2hpdmVFeHRyYURhdGFSZWNvcmQge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGRhdGE6IE5vZGVCdWZmZXIpIHtcbiAgICBpZiAodGhpcy5kYXRhLnJlYWRVSW50MzJMRSgwKSAhPT0gMHgwODA2NGI1MCkge1xuICAgICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU5WQUwsIFwiSW52YWxpZCBhcmNoaXZlIGV4dHJhIGRhdGEgcmVjb3JkIHNpZ25hdHVyZTogXCIgKyB0aGlzLmRhdGEucmVhZFVJbnQzMkxFKDApKTtcbiAgICB9XG4gIH1cbiAgcHVibGljIGxlbmd0aCgpOiBudW1iZXIgeyByZXR1cm4gdGhpcy5kYXRhLnJlYWRVSW50MzJMRSg0KTsgfVxuICBwdWJsaWMgZXh0cmFGaWVsZERhdGEoKTogTm9kZUJ1ZmZlciB7IHJldHVybiB0aGlzLmRhdGEuc2xpY2UoOCwgOCArIHRoaXMubGVuZ3RoKCkpOyB9XG59XG5cbi8qXG4gIDQuMy4xMyBEaWdpdGFsIHNpZ25hdHVyZTpcblxuICAgICAgICBoZWFkZXIgc2lnbmF0dXJlICAgICAgICAgICAgICAgIDQgYnl0ZXMgICgweDA1MDU0YjUwKVxuICAgICAgICBzaXplIG9mIGRhdGEgICAgICAgICAgICAgICAgICAgIDIgYnl0ZXNcbiAgICAgICAgc2lnbmF0dXJlIGRhdGEgKHZhcmlhYmxlIHNpemUpXG5cbiAgICAgIFdpdGggdGhlIGludHJvZHVjdGlvbiBvZiB0aGUgQ2VudHJhbCBEaXJlY3RvcnkgRW5jcnlwdGlvblxuICAgICAgZmVhdHVyZSBpbiB2ZXJzaW9uIDYuMiBvZiB0aGlzIHNwZWNpZmljYXRpb24sIHRoZSBDZW50cmFsXG4gICAgICBEaXJlY3RvcnkgU3RydWN0dXJlIE1BWSBiZSBzdG9yZWQgYm90aCBjb21wcmVzc2VkIGFuZCBlbmNyeXB0ZWQuXG4gICAgICBBbHRob3VnaCBub3QgcmVxdWlyZWQsIGl0IGlzIGFzc3VtZWQgd2hlbiBlbmNyeXB0aW5nIHRoZVxuICAgICAgQ2VudHJhbCBEaXJlY3RvcnkgU3RydWN0dXJlLCB0aGF0IGl0IHdpbGwgYmUgY29tcHJlc3NlZFxuICAgICAgZm9yIGdyZWF0ZXIgc3RvcmFnZSBlZmZpY2llbmN5LiAgSW5mb3JtYXRpb24gb24gdGhlXG4gICAgICBDZW50cmFsIERpcmVjdG9yeSBFbmNyeXB0aW9uIGZlYXR1cmUgY2FuIGJlIGZvdW5kIGluIHRoZSBzZWN0aW9uXG4gICAgICBkZXNjcmliaW5nIHRoZSBTdHJvbmcgRW5jcnlwdGlvbiBTcGVjaWZpY2F0aW9uLiBUaGUgRGlnaXRhbFxuICAgICAgU2lnbmF0dXJlIHJlY29yZCB3aWxsIGJlIG5laXRoZXIgY29tcHJlc3NlZCBub3IgZW5jcnlwdGVkLlxuKi9cbmV4cG9ydCBjbGFzcyBEaWdpdGFsU2lnbmF0dXJlIHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBkYXRhOiBOb2RlQnVmZmVyKSB7XG4gICAgaWYgKHRoaXMuZGF0YS5yZWFkVUludDMyTEUoMCkgIT09IDB4MDUwNTRiNTApIHtcbiAgICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMLCBcIkludmFsaWQgZGlnaXRhbCBzaWduYXR1cmUgc2lnbmF0dXJlOiBcIiArIHRoaXMuZGF0YS5yZWFkVUludDMyTEUoMCkpO1xuICAgIH1cbiAgfVxuICBwdWJsaWMgc2l6ZSgpOiBudW1iZXIgeyByZXR1cm4gdGhpcy5kYXRhLnJlYWRVSW50MTZMRSg0KTsgfVxuICBwdWJsaWMgc2lnbmF0dXJlRGF0YSgpOiBOb2RlQnVmZmVyIHsgcmV0dXJuIHRoaXMuZGF0YS5zbGljZSg2LCA2ICsgdGhpcy5zaXplKCkpOyB9XG59XG5cbi8qXG4gIDQuMy4xMiAgQ2VudHJhbCBkaXJlY3Rvcnkgc3RydWN0dXJlOlxuXG4gICAgY2VudHJhbCBmaWxlIGhlYWRlciBzaWduYXR1cmUgICA0IGJ5dGVzICAoMHgwMjAxNGI1MClcbiAgICB2ZXJzaW9uIG1hZGUgYnkgICAgICAgICAgICAgICAgIDIgYnl0ZXNcbiAgICB2ZXJzaW9uIG5lZWRlZCB0byBleHRyYWN0ICAgICAgIDIgYnl0ZXNcbiAgICBnZW5lcmFsIHB1cnBvc2UgYml0IGZsYWcgICAgICAgIDIgYnl0ZXNcbiAgICBjb21wcmVzc2lvbiBtZXRob2QgICAgICAgICAgICAgIDIgYnl0ZXNcbiAgICBsYXN0IG1vZCBmaWxlIHRpbWUgICAgICAgICAgICAgIDIgYnl0ZXNcbiAgICBsYXN0IG1vZCBmaWxlIGRhdGUgICAgICAgICAgICAgIDIgYnl0ZXNcbiAgICBjcmMtMzIgICAgICAgICAgICAgICAgICAgICAgICAgIDQgYnl0ZXNcbiAgICBjb21wcmVzc2VkIHNpemUgICAgICAgICAgICAgICAgIDQgYnl0ZXNcbiAgICB1bmNvbXByZXNzZWQgc2l6ZSAgICAgICAgICAgICAgIDQgYnl0ZXNcbiAgICBmaWxlIG5hbWUgbGVuZ3RoICAgICAgICAgICAgICAgIDIgYnl0ZXNcbiAgICBleHRyYSBmaWVsZCBsZW5ndGggICAgICAgICAgICAgIDIgYnl0ZXNcbiAgICBmaWxlIGNvbW1lbnQgbGVuZ3RoICAgICAgICAgICAgIDIgYnl0ZXNcbiAgICBkaXNrIG51bWJlciBzdGFydCAgICAgICAgICAgICAgIDIgYnl0ZXNcbiAgICBpbnRlcm5hbCBmaWxlIGF0dHJpYnV0ZXMgICAgICAgIDIgYnl0ZXNcbiAgICBleHRlcm5hbCBmaWxlIGF0dHJpYnV0ZXMgICAgICAgIDQgYnl0ZXNcbiAgICByZWxhdGl2ZSBvZmZzZXQgb2YgbG9jYWwgaGVhZGVyIDQgYnl0ZXNcblxuICAgIGZpbGUgbmFtZSAodmFyaWFibGUgc2l6ZSlcbiAgICBleHRyYSBmaWVsZCAodmFyaWFibGUgc2l6ZSlcbiAgICBmaWxlIGNvbW1lbnQgKHZhcmlhYmxlIHNpemUpXG4gKi9cbmV4cG9ydCBjbGFzcyBDZW50cmFsRGlyZWN0b3J5IHtcbiAgLy8gT3B0aW1pemF0aW9uOiBUaGUgZmlsZW5hbWUgaXMgZnJlcXVlbnRseSByZWFkLCBzbyBzdGFzaCBpdCBoZXJlLlxuICBwcml2YXRlIF9maWxlbmFtZTogc3RyaW5nO1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHppcERhdGE6IE5vZGVCdWZmZXIsIHByaXZhdGUgZGF0YTogTm9kZUJ1ZmZlcikge1xuICAgIC8vIFNhbml0eSBjaGVjay5cbiAgICBpZiAodGhpcy5kYXRhLnJlYWRVSW50MzJMRSgwKSAhPT0gMHgwMjAxNGI1MClcbiAgICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMLCBcIkludmFsaWQgWmlwIGZpbGU6IENlbnRyYWwgZGlyZWN0b3J5IHJlY29yZCBoYXMgaW52YWxpZCBzaWduYXR1cmU6IFwiICsgdGhpcy5kYXRhLnJlYWRVSW50MzJMRSgwKSk7XG4gICAgdGhpcy5fZmlsZW5hbWUgPSB0aGlzLnByb2R1Y2VGaWxlbmFtZSgpO1xuICB9XG4gIHB1YmxpYyB2ZXJzaW9uTWFkZUJ5KCk6IG51bWJlciB7IHJldHVybiB0aGlzLmRhdGEucmVhZFVJbnQxNkxFKDQpOyB9XG4gIHB1YmxpYyB2ZXJzaW9uTmVlZGVkKCk6IG51bWJlciB7IHJldHVybiB0aGlzLmRhdGEucmVhZFVJbnQxNkxFKDYpOyB9XG4gIHB1YmxpYyBmbGFnKCk6IG51bWJlciB7IHJldHVybiB0aGlzLmRhdGEucmVhZFVJbnQxNkxFKDgpOyB9XG4gIHB1YmxpYyBjb21wcmVzc2lvbk1ldGhvZCgpOiBDb21wcmVzc2lvbk1ldGhvZCB7IHJldHVybiB0aGlzLmRhdGEucmVhZFVJbnQxNkxFKDEwKTsgfVxuICBwdWJsaWMgbGFzdE1vZEZpbGVUaW1lKCk6IERhdGUge1xuICAgIC8vIFRpbWUgYW5kIGRhdGUgaXMgaW4gTVMtRE9TIGZvcm1hdC5cbiAgICByZXR1cm4gbXNkb3MyZGF0ZSh0aGlzLmRhdGEucmVhZFVJbnQxNkxFKDEyKSwgdGhpcy5kYXRhLnJlYWRVSW50MTZMRSgxNCkpO1xuICB9XG4gIHB1YmxpYyByYXdMYXN0TW9kRmlsZVRpbWUoKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy5kYXRhLnJlYWRVSW50MzJMRSgxMik7XG4gIH1cbiAgcHVibGljIGNyYzMyKCk6IG51bWJlciB7IHJldHVybiB0aGlzLmRhdGEucmVhZFVJbnQzMkxFKDE2KTsgfVxuICBwdWJsaWMgY29tcHJlc3NlZFNpemUoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMuZGF0YS5yZWFkVUludDMyTEUoMjApOyB9XG4gIHB1YmxpYyB1bmNvbXByZXNzZWRTaXplKCk6IG51bWJlciB7IHJldHVybiB0aGlzLmRhdGEucmVhZFVJbnQzMkxFKDI0KTsgfVxuICBwdWJsaWMgZmlsZU5hbWVMZW5ndGgoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMuZGF0YS5yZWFkVUludDE2TEUoMjgpOyB9XG4gIHB1YmxpYyBleHRyYUZpZWxkTGVuZ3RoKCk6IG51bWJlciB7IHJldHVybiB0aGlzLmRhdGEucmVhZFVJbnQxNkxFKDMwKTsgfVxuICBwdWJsaWMgZmlsZUNvbW1lbnRMZW5ndGgoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMuZGF0YS5yZWFkVUludDE2TEUoMzIpOyB9XG4gIHB1YmxpYyBkaXNrTnVtYmVyU3RhcnQoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMuZGF0YS5yZWFkVUludDE2TEUoMzQpOyB9XG4gIHB1YmxpYyBpbnRlcm5hbEF0dHJpYnV0ZXMoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMuZGF0YS5yZWFkVUludDE2TEUoMzYpOyB9XG4gIHB1YmxpYyBleHRlcm5hbEF0dHJpYnV0ZXMoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMuZGF0YS5yZWFkVUludDMyTEUoMzgpOyB9XG4gIHB1YmxpYyBoZWFkZXJSZWxhdGl2ZU9mZnNldCgpOiBudW1iZXIgeyByZXR1cm4gdGhpcy5kYXRhLnJlYWRVSW50MzJMRSg0Mik7IH1cbiAgcHVibGljIHByb2R1Y2VGaWxlbmFtZSgpOiBzdHJpbmcge1xuICAgIC8qXG4gICAgICA0LjQuMTcuMSBjbGFpbXM6XG4gICAgICAqIEFsbCBzbGFzaGVzIGFyZSBmb3J3YXJkICgnLycpIHNsYXNoZXMuXG4gICAgICAqIEZpbGVuYW1lIGRvZXNuJ3QgYmVnaW4gd2l0aCBhIHNsYXNoLlxuICAgICAgKiBObyBkcml2ZSBsZXR0ZXJzIG9yIGFueSBub25zZW5zZSBsaWtlIHRoYXQuXG4gICAgICAqIElmIGZpbGVuYW1lIGlzIG1pc3NpbmcsIHRoZSBpbnB1dCBjYW1lIGZyb20gc3RhbmRhcmQgaW5wdXQuXG5cbiAgICAgIFVuZm9ydHVuYXRlbHksIHRoaXMgaXNuJ3QgdHJ1ZSBpbiBwcmFjdGljZS4gU29tZSBXaW5kb3dzIHppcCB1dGlsaXRpZXMgdXNlXG4gICAgICBhIGJhY2tzbGFzaCBoZXJlLCBidXQgdGhlIGNvcnJlY3QgVW5peC1zdHlsZSBwYXRoIGluIGZpbGUgaGVhZGVycy5cblxuICAgICAgVG8gYXZvaWQgc2Vla2luZyBhbGwgb3ZlciB0aGUgZmlsZSB0byByZWNvdmVyIHRoZSBrbm93bi1nb29kIGZpbGVuYW1lc1xuICAgICAgZnJvbSBmaWxlIGhlYWRlcnMsIHdlIHNpbXBseSBjb252ZXJ0ICcvJyB0byAnXFwnIGhlcmUuXG4gICAgKi9cbiAgICB2YXIgZmlsZU5hbWU6IHN0cmluZyA9IHNhZmVUb1N0cmluZyh0aGlzLmRhdGEsIHRoaXMudXNlVVRGOCgpLCA0NiwgdGhpcy5maWxlTmFtZUxlbmd0aCgpKTtcbiAgICByZXR1cm4gZmlsZU5hbWUucmVwbGFjZSgvXFxcXC9nLCBcIi9cIik7XG4gIH1cbiAgcHVibGljIGZpbGVOYW1lKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuX2ZpbGVuYW1lO1xuICB9XG4gIHB1YmxpYyByYXdGaWxlTmFtZSgpOiBOb2RlQnVmZmVyIHtcbiAgICByZXR1cm4gdGhpcy5kYXRhLnNsaWNlKDQ2LCA0NiArIHRoaXMuZmlsZU5hbWVMZW5ndGgoKSk7XG4gIH1cbiAgcHVibGljIGV4dHJhRmllbGQoKTogTm9kZUJ1ZmZlciB7XG4gICAgdmFyIHN0YXJ0ID0gNDQgKyB0aGlzLmZpbGVOYW1lTGVuZ3RoKCk7XG4gICAgcmV0dXJuIHRoaXMuZGF0YS5zbGljZShzdGFydCwgc3RhcnQgKyB0aGlzLmV4dHJhRmllbGRMZW5ndGgoKSk7XG4gIH1cbiAgcHVibGljIGZpbGVDb21tZW50KCk6IHN0cmluZyB7XG4gICAgdmFyIHN0YXJ0ID0gNDYgKyB0aGlzLmZpbGVOYW1lTGVuZ3RoKCkgKyB0aGlzLmV4dHJhRmllbGRMZW5ndGgoKTtcbiAgICByZXR1cm4gc2FmZVRvU3RyaW5nKHRoaXMuZGF0YSwgdGhpcy51c2VVVEY4KCksIHN0YXJ0LCB0aGlzLmZpbGVDb21tZW50TGVuZ3RoKCkpO1xuICB9XG4gIHB1YmxpYyByYXdGaWxlQ29tbWVudCgpOiBOb2RlQnVmZmVyIHtcbiAgICBsZXQgc3RhcnQgPSA0NiArIHRoaXMuZmlsZU5hbWVMZW5ndGgoKSArIHRoaXMuZXh0cmFGaWVsZExlbmd0aCgpO1xuICAgIHJldHVybiB0aGlzLmRhdGEuc2xpY2Uoc3RhcnQsIHN0YXJ0ICsgdGhpcy5maWxlQ29tbWVudExlbmd0aCgpKTtcbiAgfVxuICBwdWJsaWMgdG90YWxTaXplKCk6IG51bWJlciB7XG4gICAgcmV0dXJuIDQ2ICsgdGhpcy5maWxlTmFtZUxlbmd0aCgpICsgdGhpcy5leHRyYUZpZWxkTGVuZ3RoKCkgKyB0aGlzLmZpbGVDb21tZW50TGVuZ3RoKCk7XG4gIH1cbiAgcHVibGljIGlzRGlyZWN0b3J5KCk6IGJvb2xlYW4ge1xuICAgIC8vIE5PVEU6IFRoaXMgYXNzdW1lcyB0aGF0IHRoZSB6aXAgZmlsZSBpbXBsZW1lbnRhdGlvbiB1c2VzIHRoZSBsb3dlciBieXRlXG4gICAgLy8gICAgICAgb2YgZXh0ZXJuYWwgYXR0cmlidXRlcyBmb3IgRE9TIGF0dHJpYnV0ZXMgZm9yXG4gICAgLy8gICAgICAgYmFja3dhcmRzLWNvbXBhdGliaWxpdHkuIFRoaXMgaXMgbm90IG1hbmRhdGVkLCBidXQgYXBwZWFycyB0byBiZVxuICAgIC8vICAgICAgIGNvbW1vbnBsYWNlLlxuICAgIC8vICAgICAgIEFjY29yZGluZyB0byB0aGUgc3BlYywgdGhlIGxheW91dCBvZiBleHRlcm5hbCBhdHRyaWJ1dGVzIGlzXG4gICAgLy8gICAgICAgcGxhdGZvcm0tZGVwZW5kZW50LlxuICAgIC8vICAgICAgIElmIHRoYXQgZmFpbHMsIHdlIGFsc28gY2hlY2sgaWYgdGhlIG5hbWUgb2YgdGhlIGZpbGUgZW5kcyBpbiAnLycsXG4gICAgLy8gICAgICAgd2hpY2ggaXMgd2hhdCBKYXZhJ3MgWmlwRmlsZSBpbXBsZW1lbnRhdGlvbiBkb2VzLlxuICAgIHZhciBmaWxlTmFtZSA9IHRoaXMuZmlsZU5hbWUoKTtcbiAgICByZXR1cm4gKHRoaXMuZXh0ZXJuYWxBdHRyaWJ1dGVzKCkgJiAweDEwID8gdHJ1ZSA6IGZhbHNlKSB8fCAoZmlsZU5hbWUuY2hhckF0KGZpbGVOYW1lLmxlbmd0aC0xKSA9PT0gJy8nKTtcbiAgfVxuICBwdWJsaWMgaXNGaWxlKCk6IGJvb2xlYW4geyByZXR1cm4gIXRoaXMuaXNEaXJlY3RvcnkoKTsgfVxuICBwdWJsaWMgdXNlVVRGOCgpOiBib29sZWFuIHsgcmV0dXJuICh0aGlzLmZsYWcoKSAmIDB4ODAwKSA9PT0gMHg4MDA7IH1cbiAgcHVibGljIGlzRW5jcnlwdGVkKCk6IGJvb2xlYW4geyByZXR1cm4gKHRoaXMuZmxhZygpICYgMHgxKSA9PT0gMHgxOyB9XG4gIHB1YmxpYyBnZXRGaWxlRGF0YSgpOiBGaWxlRGF0YSB7XG4gICAgLy8gTmVlZCB0byBncmFiIHRoZSBoZWFkZXIgYmVmb3JlIHdlIGNhbiBmaWd1cmUgb3V0IHdoZXJlIHRoZSBhY3R1YWxcbiAgICAvLyBjb21wcmVzc2VkIGRhdGEgc3RhcnRzLlxuICAgIHZhciBzdGFydCA9IHRoaXMuaGVhZGVyUmVsYXRpdmVPZmZzZXQoKTtcbiAgICB2YXIgaGVhZGVyID0gbmV3IEZpbGVIZWFkZXIodGhpcy56aXBEYXRhLnNsaWNlKHN0YXJ0KSk7XG4gICAgcmV0dXJuIG5ldyBGaWxlRGF0YShoZWFkZXIsIHRoaXMsIHRoaXMuemlwRGF0YS5zbGljZShzdGFydCArIGhlYWRlci50b3RhbFNpemUoKSkpO1xuICB9XG4gIHB1YmxpYyBnZXREYXRhKCk6IE5vZGVCdWZmZXIge1xuICAgIHJldHVybiB0aGlzLmdldEZpbGVEYXRhKCkuZGVjb21wcmVzcygpO1xuICB9XG4gIHB1YmxpYyBnZXRSYXdEYXRhKCk6IE5vZGVCdWZmZXIge1xuICAgIHJldHVybiB0aGlzLmdldEZpbGVEYXRhKCkuZ2V0UmF3RGF0YSgpO1xuICB9XG4gIHB1YmxpYyBnZXRTdGF0cygpOiBTdGF0cyB7XG4gICAgcmV0dXJuIG5ldyBTdGF0cyhGaWxlVHlwZS5GSUxFLCB0aGlzLnVuY29tcHJlc3NlZFNpemUoKSwgMHgxNkQsIG5ldyBEYXRlKCksIHRoaXMubGFzdE1vZEZpbGVUaW1lKCkpO1xuICB9XG59XG5cbi8qXG4gIDQuMy4xNjogZW5kIG9mIGNlbnRyYWwgZGlyZWN0b3J5IHJlY29yZFxuICAgIGVuZCBvZiBjZW50cmFsIGRpciBzaWduYXR1cmUgICAgNCBieXRlcyAgKDB4MDYwNTRiNTApXG4gICAgbnVtYmVyIG9mIHRoaXMgZGlzayAgICAgICAgICAgICAyIGJ5dGVzXG4gICAgbnVtYmVyIG9mIHRoZSBkaXNrIHdpdGggdGhlXG4gICAgc3RhcnQgb2YgdGhlIGNlbnRyYWwgZGlyZWN0b3J5ICAyIGJ5dGVzXG4gICAgdG90YWwgbnVtYmVyIG9mIGVudHJpZXMgaW4gdGhlXG4gICAgY2VudHJhbCBkaXJlY3Rvcnkgb24gdGhpcyBkaXNrICAyIGJ5dGVzXG4gICAgdG90YWwgbnVtYmVyIG9mIGVudHJpZXMgaW5cbiAgICB0aGUgY2VudHJhbCBkaXJlY3RvcnkgICAgICAgICAgIDIgYnl0ZXNcbiAgICBzaXplIG9mIHRoZSBjZW50cmFsIGRpcmVjdG9yeSAgIDQgYnl0ZXNcbiAgICBvZmZzZXQgb2Ygc3RhcnQgb2YgY2VudHJhbFxuICAgIGRpcmVjdG9yeSB3aXRoIHJlc3BlY3QgdG9cbiAgICB0aGUgc3RhcnRpbmcgZGlzayBudW1iZXIgICAgICAgIDQgYnl0ZXNcbiAgICAuWklQIGZpbGUgY29tbWVudCBsZW5ndGggICAgICAgIDIgYnl0ZXNcbiAgICAuWklQIGZpbGUgY29tbWVudCAgICAgICAodmFyaWFibGUgc2l6ZSlcbiovXG5leHBvcnQgY2xhc3MgRW5kT2ZDZW50cmFsRGlyZWN0b3J5IHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBkYXRhOiBOb2RlQnVmZmVyKSB7XG4gICAgaWYgKHRoaXMuZGF0YS5yZWFkVUludDMyTEUoMCkgIT09IDB4MDYwNTRiNTApXG4gICAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTlZBTCwgXCJJbnZhbGlkIFppcCBmaWxlOiBFbmQgb2YgY2VudHJhbCBkaXJlY3RvcnkgcmVjb3JkIGhhcyBpbnZhbGlkIHNpZ25hdHVyZTogXCIgKyB0aGlzLmRhdGEucmVhZFVJbnQzMkxFKDApKTtcbiAgfVxuICBwdWJsaWMgZGlza051bWJlcigpOiBudW1iZXIgeyByZXR1cm4gdGhpcy5kYXRhLnJlYWRVSW50MTZMRSg0KTsgfVxuICBwdWJsaWMgY2REaXNrTnVtYmVyKCk6IG51bWJlciB7IHJldHVybiB0aGlzLmRhdGEucmVhZFVJbnQxNkxFKDYpOyB9XG4gIHB1YmxpYyBjZERpc2tFbnRyeUNvdW50KCk6IG51bWJlciB7IHJldHVybiB0aGlzLmRhdGEucmVhZFVJbnQxNkxFKDgpOyB9XG4gIHB1YmxpYyBjZFRvdGFsRW50cnlDb3VudCgpOiBudW1iZXIgeyByZXR1cm4gdGhpcy5kYXRhLnJlYWRVSW50MTZMRSgxMCk7IH1cbiAgcHVibGljIGNkU2l6ZSgpOiBudW1iZXIgeyByZXR1cm4gdGhpcy5kYXRhLnJlYWRVSW50MzJMRSgxMik7IH1cbiAgcHVibGljIGNkT2Zmc2V0KCk6IG51bWJlciB7IHJldHVybiB0aGlzLmRhdGEucmVhZFVJbnQzMkxFKDE2KTsgfVxuICBwdWJsaWMgY2RaaXBDb21tZW50TGVuZ3RoKCk6IG51bWJlciB7IHJldHVybiB0aGlzLmRhdGEucmVhZFVJbnQxNkxFKDIwKTsgfVxuICBwdWJsaWMgY2RaaXBDb21tZW50KCk6IHN0cmluZyB7XG4gICAgLy8gQXNzdW1pbmcgVVRGLTguIFRoZSBzcGVjaWZpY2F0aW9uIGRvZXNuJ3Qgc3BlY2lmeS5cbiAgICByZXR1cm4gc2FmZVRvU3RyaW5nKHRoaXMuZGF0YSwgdHJ1ZSwgMjIsIHRoaXMuY2RaaXBDb21tZW50TGVuZ3RoKCkpO1xuICB9XG4gIHB1YmxpYyByYXdDZFppcENvbW1lbnQoKTogTm9kZUJ1ZmZlciB7XG4gICAgcmV0dXJuIHRoaXMuZGF0YS5zbGljZSgyMiwgMjIgKyB0aGlzLmNkWmlwQ29tbWVudExlbmd0aCgpKVxuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBaaXBUT0Mge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgaW5kZXg6IEZpbGVJbmRleDxDZW50cmFsRGlyZWN0b3J5PiwgcHVibGljIGRpcmVjdG9yeUVudHJpZXM6IENlbnRyYWxEaXJlY3RvcnlbXSwgcHVibGljIGVvY2Q6IEVuZE9mQ2VudHJhbERpcmVjdG9yeSwgcHVibGljIGRhdGE6IE5vZGVCdWZmZXIpIHtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBaaXBGUyBleHRlbmRzIGZpbGVfc3lzdGVtLlN5bmNocm9ub3VzRmlsZVN5c3RlbSBpbXBsZW1lbnRzIGZpbGVfc3lzdGVtLkZpbGVTeXN0ZW0ge1xuICBwcml2YXRlIF9pbmRleDogRmlsZUluZGV4PENlbnRyYWxEaXJlY3Rvcnk+ID0gbmV3IEZpbGVJbmRleDxDZW50cmFsRGlyZWN0b3J5PigpO1xuICBwcml2YXRlIF9kaXJlY3RvcnlFbnRyaWVzOiBDZW50cmFsRGlyZWN0b3J5W10gPSBbXTtcbiAgcHJpdmF0ZSBfZW9jZDogRW5kT2ZDZW50cmFsRGlyZWN0b3J5ID0gbnVsbDtcbiAgcHJpdmF0ZSBkYXRhOiBOb2RlQnVmZmVyO1xuXG4gIC8qKlxuICAgKiBDb25zdHJ1Y3RzIGEgWmlwRlMgZnJvbSB0aGUgZ2l2ZW4gemlwIGZpbGUgZGF0YS4gTmFtZSBpcyBvcHRpb25hbCwgYW5kIGlzXG4gICAqIHVzZWQgcHJpbWFyaWx5IGZvciBvdXIgdW5pdCB0ZXN0cycgcHVycG9zZXMgdG8gZGlmZmVyZW50aWF0ZSBkaWZmZXJlbnRcbiAgICogdGVzdCB6aXAgZmlsZXMgaW4gdGVzdCBvdXRwdXQuXG4gICAqL1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGlucHV0OiBOb2RlQnVmZmVyIHwgWmlwVE9DLCBwcml2YXRlIG5hbWU6IHN0cmluZyA9ICcnKSB7XG4gICAgc3VwZXIoKTtcbiAgICBpZiAoaW5wdXQgaW5zdGFuY2VvZiBaaXBUT0MpIHtcbiAgICAgIHRoaXMuX2luZGV4ID0gaW5wdXQuaW5kZXg7XG4gICAgICB0aGlzLl9kaXJlY3RvcnlFbnRyaWVzID0gaW5wdXQuZGlyZWN0b3J5RW50cmllcztcbiAgICAgIHRoaXMuX2VvY2QgPSBpbnB1dC5lb2NkO1xuICAgICAgdGhpcy5kYXRhID0gaW5wdXQuZGF0YTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5kYXRhID0gaW5wdXQgYXMgTm9kZUJ1ZmZlcjtcbiAgICAgIHRoaXMucG9wdWxhdGVJbmRleCgpO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBnZXROYW1lKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuICdaaXBGUycgKyAodGhpcy5uYW1lICE9PSAnJyA/ICcgJyArIHRoaXMubmFtZSA6ICcnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIENlbnRyYWxEaXJlY3Rvcnkgb2JqZWN0IGZvciB0aGUgZ2l2ZW4gcGF0aC5cbiAgICovXG4gIHB1YmxpYyBnZXRDZW50cmFsRGlyZWN0b3J5RW50cnkocGF0aDogc3RyaW5nKTogQ2VudHJhbERpcmVjdG9yeSB7XG4gICAgbGV0IGlub2RlID0gdGhpcy5faW5kZXguZ2V0SW5vZGUocGF0aCk7XG4gICAgaWYgKGlub2RlID09PSBudWxsKSB7XG4gICAgICB0aHJvdyBBcGlFcnJvci5FTk9FTlQocGF0aCk7XG4gICAgfVxuICAgIGlmIChpc0ZpbGVJbm9kZTxDZW50cmFsRGlyZWN0b3J5Pihpbm9kZSkpIHtcbiAgICAgIHJldHVybiBpbm9kZS5nZXREYXRhKCk7XG4gICAgfSBlbHNlIGlmIChpc0Rpcklub2RlPENlbnRyYWxEaXJlY3Rvcnk+KGlub2RlKSkge1xuICAgICAgcmV0dXJuIGlub2RlLmdldERhdGEoKTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgZ2V0Q2VudHJhbERpcmVjdG9yeUVudHJ5QXQoaW5kZXg6IG51bWJlcik6IENlbnRyYWxEaXJlY3Rvcnkge1xuICAgIGxldCBkaXJFbnRyeSA9IHRoaXMuX2RpcmVjdG9yeUVudHJpZXNbaW5kZXhdO1xuICAgIGlmICghZGlyRW50cnkpIHtcbiAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKGBJbnZhbGlkIGRpcmVjdG9yeSBpbmRleDogJHtpbmRleH0uYCk7XG4gICAgfVxuICAgIHJldHVybiBkaXJFbnRyeTtcbiAgfVxuXG4gIHB1YmxpYyBnZXROdW1iZXJPZkNlbnRyYWxEaXJlY3RvcnlFbnRyaWVzKCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuX2RpcmVjdG9yeUVudHJpZXMubGVuZ3RoO1xuICB9XG5cbiAgcHVibGljIGdldEVuZE9mQ2VudHJhbERpcmVjdG9yeSgpOiBFbmRPZkNlbnRyYWxEaXJlY3Rvcnkge1xuICAgIHJldHVybiB0aGlzLl9lb2NkO1xuICB9XG5cbiAgcHVibGljIHN0YXRpYyBpc0F2YWlsYWJsZSgpOiBib29sZWFuIHsgcmV0dXJuIHRydWU7IH1cblxuICBwdWJsaWMgZGlza1NwYWNlKHBhdGg6IHN0cmluZywgY2I6ICh0b3RhbDogbnVtYmVyLCBmcmVlOiBudW1iZXIpID0+IHZvaWQpOiB2b2lkIHtcbiAgICAvLyBSZWFkLW9ubHkgZmlsZSBzeXN0ZW0uXG4gICAgY2IodGhpcy5kYXRhLmxlbmd0aCwgMCk7XG4gIH1cblxuICBwdWJsaWMgaXNSZWFkT25seSgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHB1YmxpYyBzdXBwb3J0c0xpbmtzKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHB1YmxpYyBzdXBwb3J0c1Byb3BzKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHB1YmxpYyBzdXBwb3J0c1N5bmNoKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgcHVibGljIHN0YXRTeW5jKHBhdGg6IHN0cmluZywgaXNMc3RhdDogYm9vbGVhbik6IFN0YXRzIHtcbiAgICB2YXIgaW5vZGUgPSB0aGlzLl9pbmRleC5nZXRJbm9kZShwYXRoKTtcbiAgICBpZiAoaW5vZGUgPT09IG51bGwpIHtcbiAgICAgIHRocm93IEFwaUVycm9yLkVOT0VOVChwYXRoKTtcbiAgICB9XG4gICAgdmFyIHN0YXRzOiBTdGF0cztcbiAgICBpZiAoaXNGaWxlSW5vZGU8Q2VudHJhbERpcmVjdG9yeT4oaW5vZGUpKSB7XG4gICAgICBzdGF0cyA9IGlub2RlLmdldERhdGEoKS5nZXRTdGF0cygpO1xuICAgIH0gZWxzZSBpZiAoaXNEaXJJbm9kZShpbm9kZSkpIHtcbiAgICAgIHN0YXRzID0gaW5vZGUuZ2V0U3RhdHMoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU5WQUwsIFwiSW52YWxpZCBpbm9kZS5cIik7XG4gICAgfVxuICAgIHJldHVybiBzdGF0cztcbiAgfVxuXG4gIHB1YmxpYyBvcGVuU3luYyhwYXRoOiBzdHJpbmcsIGZsYWdzOiBGaWxlRmxhZywgbW9kZTogbnVtYmVyKTogZmlsZS5GaWxlIHtcbiAgICAvLyBJTlZBUklBTlQ6IENhbm5vdCB3cml0ZSB0byBSTyBmaWxlIHN5c3RlbXMuXG4gICAgaWYgKGZsYWdzLmlzV3JpdGVhYmxlKCkpIHtcbiAgICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRVBFUk0sIHBhdGgpO1xuICAgIH1cbiAgICAvLyBDaGVjayBpZiB0aGUgcGF0aCBleGlzdHMsIGFuZCBpcyBhIGZpbGUuXG4gICAgdmFyIGlub2RlID0gdGhpcy5faW5kZXguZ2V0SW5vZGUocGF0aCk7XG4gICAgaWYgKCFpbm9kZSkge1xuICAgICAgdGhyb3cgQXBpRXJyb3IuRU5PRU5UKHBhdGgpO1xuICAgIH0gZWxzZSBpZiAoaXNGaWxlSW5vZGU8Q2VudHJhbERpcmVjdG9yeT4oaW5vZGUpKSB7XG4gICAgICB2YXIgY2RSZWNvcmQgPSBpbm9kZS5nZXREYXRhKCk7XG4gICAgICB2YXIgc3RhdHMgPSBjZFJlY29yZC5nZXRTdGF0cygpO1xuICAgICAgc3dpdGNoIChmbGFncy5wYXRoRXhpc3RzQWN0aW9uKCkpIHtcbiAgICAgICAgY2FzZSBBY3Rpb25UeXBlLlRIUk9XX0VYQ0VQVElPTjpcbiAgICAgICAgY2FzZSBBY3Rpb25UeXBlLlRSVU5DQVRFX0ZJTEU6XG4gICAgICAgICAgdGhyb3cgQXBpRXJyb3IuRUVYSVNUKHBhdGgpO1xuICAgICAgICBjYXNlIEFjdGlvblR5cGUuTk9QOlxuICAgICAgICAgIHJldHVybiBuZXcgcHJlbG9hZF9maWxlLk5vU3luY0ZpbGUodGhpcywgcGF0aCwgZmxhZ3MsIHN0YXRzLCBjZFJlY29yZC5nZXREYXRhKCkpO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMLCAnSW52YWxpZCBGaWxlTW9kZSBvYmplY3QuJyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IEFwaUVycm9yLkVJU0RJUihwYXRoKTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgcmVhZGRpclN5bmMocGF0aDogc3RyaW5nKTogc3RyaW5nW10ge1xuICAgIC8vIENoZWNrIGlmIGl0IGV4aXN0cy5cbiAgICB2YXIgaW5vZGUgPSB0aGlzLl9pbmRleC5nZXRJbm9kZShwYXRoKTtcbiAgICBpZiAoIWlub2RlKSB7XG4gICAgICB0aHJvdyBBcGlFcnJvci5FTk9FTlQocGF0aCk7XG4gICAgfSBlbHNlIGlmIChpc0Rpcklub2RlKGlub2RlKSkge1xuICAgICAgcmV0dXJuIGlub2RlLmdldExpc3RpbmcoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgQXBpRXJyb3IuRU5PVERJUihwYXRoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3BlY2lhbGx5LW9wdGltaXplZCByZWFkZmlsZS5cbiAgICovXG4gIHB1YmxpYyByZWFkRmlsZVN5bmMoZm5hbWU6IHN0cmluZywgZW5jb2Rpbmc6IHN0cmluZywgZmxhZzogRmlsZUZsYWcpOiBhbnkge1xuICAgIC8vIEdldCBmaWxlLlxuICAgIHZhciBmZCA9IHRoaXMub3BlblN5bmMoZm5hbWUsIGZsYWcsIDB4MWE0KTtcbiAgICB0cnkge1xuICAgICAgdmFyIGZkQ2FzdCA9IDxwcmVsb2FkX2ZpbGUuTm9TeW5jRmlsZTxaaXBGUz4+IGZkO1xuICAgICAgdmFyIGZkQnVmZiA9IDxCdWZmZXI+IGZkQ2FzdC5nZXRCdWZmZXIoKTtcbiAgICAgIGlmIChlbmNvZGluZyA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gY29weWluZ1NsaWNlKGZkQnVmZik7XG4gICAgICB9XG4gICAgICByZXR1cm4gZmRCdWZmLnRvU3RyaW5nKGVuY29kaW5nKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgZmQuY2xvc2VTeW5jKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIExvY2F0ZXMgdGhlIGVuZCBvZiBjZW50cmFsIGRpcmVjdG9yeSByZWNvcmQgYXQgdGhlIGVuZCBvZiB0aGUgZmlsZS5cbiAgICogVGhyb3dzIGFuIGV4Y2VwdGlvbiBpZiBpdCBjYW5ub3QgYmUgZm91bmQuXG4gICAqL1xuICBwcml2YXRlIHN0YXRpYyBnZXRFT0NEKGRhdGE6IE5vZGVCdWZmZXIpOiBFbmRPZkNlbnRyYWxEaXJlY3Rvcnkge1xuICAgIC8vIFVuZm9ydHVuYXRlbHksIHRoZSBjb21tZW50IGlzIHZhcmlhYmxlIHNpemUgYW5kIHVwIHRvIDY0SyBpbiBzaXplLlxuICAgIC8vIFdlIGFzc3VtZSB0aGF0IHRoZSBtYWdpYyBzaWduYXR1cmUgZG9lcyBub3QgYXBwZWFyIGluIHRoZSBjb21tZW50LCBhbmRcbiAgICAvLyBpbiB0aGUgYnl0ZXMgYmV0d2VlbiB0aGUgY29tbWVudCBhbmQgdGhlIHNpZ25hdHVyZS4gT3RoZXIgWklQXG4gICAgLy8gaW1wbGVtZW50YXRpb25zIG1ha2UgdGhpcyBzYW1lIGFzc3VtcHRpb24sIHNpbmNlIHRoZSBhbHRlcm5hdGl2ZSBpcyB0b1xuICAgIC8vIHJlYWQgdGhyZWFkIGV2ZXJ5IGVudHJ5IGluIHRoZSBmaWxlIHRvIGdldCB0byBpdC4gOihcbiAgICAvLyBUaGVzZSBhcmUgKm5lZ2F0aXZlKiBvZmZzZXRzIGZyb20gdGhlIGVuZCBvZiB0aGUgZmlsZS5cbiAgICB2YXIgc3RhcnRPZmZzZXQgPSAyMjtcbiAgICB2YXIgZW5kT2Zmc2V0ID0gTWF0aC5taW4oc3RhcnRPZmZzZXQgKyAweEZGRkYsIGRhdGEubGVuZ3RoIC0gMSk7XG4gICAgLy8gVGhlcmUncyBub3QgZXZlbiBhIGJ5dGUgYWxpZ25tZW50IGd1YXJhbnRlZSBvbiB0aGUgY29tbWVudCBzbyB3ZSBuZWVkIHRvXG4gICAgLy8gc2VhcmNoIGJ5dGUgYnkgYnl0ZS4gKmdydW1ibGUgZ3J1bWJsZSpcbiAgICBmb3IgKHZhciBpID0gc3RhcnRPZmZzZXQ7IGkgPCBlbmRPZmZzZXQ7IGkrKykge1xuICAgICAgLy8gTWFnaWMgbnVtYmVyOiBFT0NEIFNpZ25hdHVyZVxuICAgICAgaWYgKGRhdGEucmVhZFVJbnQzMkxFKGRhdGEubGVuZ3RoIC0gaSkgPT09IDB4MDYwNTRiNTApIHtcbiAgICAgICAgcmV0dXJuIG5ldyBFbmRPZkNlbnRyYWxEaXJlY3RvcnkoZGF0YS5zbGljZShkYXRhLmxlbmd0aCAtIGkpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU5WQUwsIFwiSW52YWxpZCBaSVAgZmlsZTogQ291bGQgbm90IGxvY2F0ZSBFbmQgb2YgQ2VudHJhbCBEaXJlY3Rvcnkgc2lnbmF0dXJlLlwiKTtcbiAgfVxuXG4gIHByaXZhdGUgc3RhdGljIGFkZFRvSW5kZXgoY2Q6IENlbnRyYWxEaXJlY3RvcnksIGluZGV4OiBGaWxlSW5kZXg8Q2VudHJhbERpcmVjdG9yeT4pIHtcbiAgICAvLyBQYXRocyBtdXN0IGJlIGFic29sdXRlLCB5ZXQgemlwIGZpbGUgcGF0aHMgYXJlIGFsd2F5cyByZWxhdGl2ZSB0byB0aGVcbiAgICAvLyB6aXAgcm9vdC4gU28gd2UgYXBwZW5kICcvJyBhbmQgY2FsbCBpdCBhIGRheS5cbiAgICBsZXQgZmlsZW5hbWUgPSBjZC5maWxlTmFtZSgpO1xuICAgIGlmIChmaWxlbmFtZS5jaGFyQXQoMCkgPT09ICcvJykgdGhyb3cgbmV3IEVycm9yKFwiV0hZIElTIFRISVMgQUJTT0xVVEVcIik7XG4gICAgLy8gWFhYOiBGb3IgdGhlIGZpbGUgaW5kZXgsIHN0cmlwIHRoZSB0cmFpbGluZyAnLycuXG4gICAgaWYgKGZpbGVuYW1lLmNoYXJBdChmaWxlbmFtZS5sZW5ndGggLSAxKSA9PT0gJy8nKSB7XG4gICAgICBmaWxlbmFtZSA9IGZpbGVuYW1lLnN1YnN0cigwLCBmaWxlbmFtZS5sZW5ndGgtMSk7XG4gICAgfVxuXG4gICAgaWYgKGNkLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgIGluZGV4LmFkZFBhdGhGYXN0KCcvJyArIGZpbGVuYW1lLCBuZXcgRGlySW5vZGU8Q2VudHJhbERpcmVjdG9yeT4oY2QpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaW5kZXguYWRkUGF0aEZhc3QoJy8nICsgZmlsZW5hbWUsIG5ldyBGaWxlSW5vZGU8Q2VudHJhbERpcmVjdG9yeT4oY2QpKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHN0YXRpYyBjb21wdXRlSW5kZXhSZXNwb25zaXZlKGRhdGE6IE5vZGVCdWZmZXIsIGluZGV4OiBGaWxlSW5kZXg8Q2VudHJhbERpcmVjdG9yeT4sIGNkUHRyOiBudW1iZXIsIGNkRW5kOiBudW1iZXIsIGNiOiAoemlwVE9DOiBaaXBUT0MpID0+IHZvaWQsIGNkRW50cmllczogQ2VudHJhbERpcmVjdG9yeVtdLCBlb2NkOiBFbmRPZkNlbnRyYWxEaXJlY3RvcnkpIHtcbiAgICBpZiAoY2RQdHIgPCBjZEVuZCkge1xuICAgICAgbGV0IGNvdW50ID0gMDtcbiAgICAgIHdoaWxlIChjb3VudCsrIDwgMjAwICYmIGNkUHRyIDwgY2RFbmQpIHtcbiAgICAgICAgY29uc3QgY2Q6IENlbnRyYWxEaXJlY3RvcnkgPSBuZXcgQ2VudHJhbERpcmVjdG9yeShkYXRhLCBkYXRhLnNsaWNlKGNkUHRyKSk7XG4gICAgICAgIFppcEZTLmFkZFRvSW5kZXgoY2QsIGluZGV4KTtcbiAgICAgICAgY2RQdHIgKz0gY2QudG90YWxTaXplKCk7XG4gICAgICAgIGNkRW50cmllcy5wdXNoKGNkKTtcbiAgICAgIH1cbiAgICAgIHNldEltbWVkaWF0ZSgoKSA9PiB7XG4gICAgICAgIFppcEZTLmNvbXB1dGVJbmRleFJlc3BvbnNpdmUoZGF0YSwgaW5kZXgsIGNkUHRyLCBjZEVuZCwgY2IsIGNkRW50cmllcywgZW9jZCk7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgY2IobmV3IFppcFRPQyhpbmRleCwgY2RFbnRyaWVzLCBlb2NkLCBkYXRhKSk7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIGNvbXB1dGVJbmRleChkYXRhOiBOb2RlQnVmZmVyLCBjYjogKHppcFRPQzogWmlwVE9DKSA9PiB2b2lkKSB7XG4gICAgY29uc3QgaW5kZXg6IEZpbGVJbmRleDxDZW50cmFsRGlyZWN0b3J5PiA9IG5ldyBGaWxlSW5kZXg8Q2VudHJhbERpcmVjdG9yeT4oKTtcbiAgICBjb25zdCBlb2NkOiBFbmRPZkNlbnRyYWxEaXJlY3RvcnkgPSBaaXBGUy5nZXRFT0NEKGRhdGEpO1xuICAgIGlmIChlb2NkLmRpc2tOdW1iZXIoKSAhPT0gZW9jZC5jZERpc2tOdW1iZXIoKSlcbiAgICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMLCBcIlppcEZTIGRvZXMgbm90IHN1cHBvcnQgc3Bhbm5lZCB6aXAgZmlsZXMuXCIpO1xuXG4gICAgY29uc3QgY2RQdHIgPSBlb2NkLmNkT2Zmc2V0KCk7XG4gICAgaWYgKGNkUHRyID09PSAweEZGRkZGRkZGKVxuICAgICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU5WQUwsIFwiWmlwRlMgZG9lcyBub3Qgc3VwcG9ydCBaaXA2NC5cIik7XG4gICAgY29uc3QgY2RFbmQgPSBjZFB0ciArIGVvY2QuY2RTaXplKCk7XG4gICAgWmlwRlMuY29tcHV0ZUluZGV4UmVzcG9uc2l2ZShkYXRhLCBpbmRleCwgY2RQdHIsIGNkRW5kLCBjYiwgW10sIGVvY2QpO1xuICB9XG5cbiAgcHJpdmF0ZSBwb3B1bGF0ZUluZGV4KCkge1xuICAgIHZhciBlb2NkOiBFbmRPZkNlbnRyYWxEaXJlY3RvcnkgPSB0aGlzLl9lb2NkID0gWmlwRlMuZ2V0RU9DRCh0aGlzLmRhdGEpO1xuICAgIGlmIChlb2NkLmRpc2tOdW1iZXIoKSAhPT0gZW9jZC5jZERpc2tOdW1iZXIoKSlcbiAgICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMLCBcIlppcEZTIGRvZXMgbm90IHN1cHBvcnQgc3Bhbm5lZCB6aXAgZmlsZXMuXCIpO1xuXG4gICAgdmFyIGNkUHRyID0gZW9jZC5jZE9mZnNldCgpO1xuICAgIGlmIChjZFB0ciA9PT0gMHhGRkZGRkZGRilcbiAgICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMLCBcIlppcEZTIGRvZXMgbm90IHN1cHBvcnQgWmlwNjQuXCIpO1xuICAgIHZhciBjZEVuZCA9IGNkUHRyICsgZW9jZC5jZFNpemUoKTtcbiAgICB3aGlsZSAoY2RQdHIgPCBjZEVuZCkge1xuICAgICAgY29uc3QgY2Q6IENlbnRyYWxEaXJlY3RvcnkgPSBuZXcgQ2VudHJhbERpcmVjdG9yeSh0aGlzLmRhdGEsIHRoaXMuZGF0YS5zbGljZShjZFB0cikpO1xuICAgICAgY2RQdHIgKz0gY2QudG90YWxTaXplKCk7XG4gICAgICBaaXBGUy5hZGRUb0luZGV4KGNkLCB0aGlzLl9pbmRleCk7XG4gICAgICB0aGlzLl9kaXJlY3RvcnlFbnRyaWVzLnB1c2goY2QpO1xuICAgIH1cbiAgfVxufVxuIl19