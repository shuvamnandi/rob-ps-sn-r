"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var preload_file = require('../generic/preload_file');
var file_system = require('../core/file_system');
var api_error_1 = require('../core/api_error');
var file_flag_1 = require('../core/file_flag');
var node_fs_stats_1 = require('../core/node_fs_stats');
var path = require('path');
var global = require('../core/global');
var async = require('async');
var util_1 = require('../core/util');
function isDirectoryEntry(entry) {
    return entry.isDirectory;
}
var _getFS = global.webkitRequestFileSystem || global.requestFileSystem || null;
function _requestQuota(type, size, success, errorCallback) {
    if (typeof navigator['webkitPersistentStorage'] !== 'undefined') {
        switch (type) {
            case global.PERSISTENT:
                navigator.webkitPersistentStorage.requestQuota(size, success, errorCallback);
                break;
            case global.TEMPORARY:
                navigator.webkitTemporaryStorage.requestQuota(size, success, errorCallback);
                break;
            default:
                errorCallback(new TypeError("Invalid storage type: " + type));
                break;
        }
    }
    else {
        global.webkitStorageInfo.requestQuota(type, size, success, errorCallback);
    }
}
function _toArray(list) {
    return Array.prototype.slice.call(list || [], 0);
}
var HTML5FSFile = (function (_super) {
    __extends(HTML5FSFile, _super);
    function HTML5FSFile(_fs, _path, _flag, _stat, contents) {
        _super.call(this, _fs, _path, _flag, _stat, contents);
    }
    HTML5FSFile.prototype.sync = function (cb) {
        var _this = this;
        if (this.isDirty()) {
            var opts = {
                create: false
            };
            var _fs = this._fs;
            var success = function (entry) {
                entry.createWriter(function (writer) {
                    var buffer = _this.getBuffer();
                    var blob = new Blob([util_1.buffer2ArrayBuffer(buffer)]);
                    var length = blob.size;
                    writer.onwriteend = function () {
                        writer.onwriteend = null;
                        writer.truncate(length);
                        _this.resetDirty();
                        cb();
                    };
                    writer.onerror = function (err) {
                        cb(_fs.convert(err, _this.getPath(), false));
                    };
                    writer.write(blob);
                });
            };
            var error = function (err) {
                cb(_fs.convert(err, _this.getPath(), false));
            };
            _fs.fs.root.getFile(this.getPath(), opts, success, error);
        }
        else {
            cb();
        }
    };
    HTML5FSFile.prototype.close = function (cb) {
        this.sync(cb);
    };
    return HTML5FSFile;
}(preload_file.PreloadFile));
exports.HTML5FSFile = HTML5FSFile;
var HTML5FS = (function (_super) {
    __extends(HTML5FS, _super);
    function HTML5FS(size, type) {
        if (size === void 0) { size = 5; }
        if (type === void 0) { type = global.PERSISTENT; }
        _super.call(this);
        this.size = 1024 * 1024 * size;
        this.type = type;
    }
    HTML5FS.prototype.getName = function () {
        return 'HTML5 FileSystem';
    };
    HTML5FS.isAvailable = function () {
        return _getFS != null;
    };
    HTML5FS.prototype.isReadOnly = function () {
        return false;
    };
    HTML5FS.prototype.supportsSymlinks = function () {
        return false;
    };
    HTML5FS.prototype.supportsProps = function () {
        return false;
    };
    HTML5FS.prototype.supportsSynch = function () {
        return false;
    };
    HTML5FS.prototype.convert = function (err, p, expectedDir) {
        switch (err.name) {
            case "PathExistsError":
                return api_error_1.ApiError.EEXIST(p);
            case 'QuotaExceededError':
                return api_error_1.ApiError.FileError(api_error_1.ErrorCode.ENOSPC, p);
            case 'NotFoundError':
                return api_error_1.ApiError.ENOENT(p);
            case 'SecurityError':
                return api_error_1.ApiError.FileError(api_error_1.ErrorCode.EACCES, p);
            case 'InvalidModificationError':
                return api_error_1.ApiError.FileError(api_error_1.ErrorCode.EPERM, p);
            case 'TypeMismatchError':
                return api_error_1.ApiError.FileError(expectedDir ? api_error_1.ErrorCode.ENOTDIR : api_error_1.ErrorCode.EISDIR, p);
            case "EncodingError":
            case "InvalidStateError":
            case "NoModificationAllowedError":
            default:
                return api_error_1.ApiError.FileError(api_error_1.ErrorCode.EINVAL, p);
        }
    };
    HTML5FS.prototype.allocate = function (cb) {
        var _this = this;
        if (cb === void 0) { cb = function () { }; }
        var success = function (fs) {
            _this.fs = fs;
            cb();
        };
        var error = function (err) {
            cb(_this.convert(err, "/", true));
        };
        if (this.type === global.PERSISTENT) {
            _requestQuota(this.type, this.size, function (granted) {
                _getFS(_this.type, granted, success, error);
            }, error);
        }
        else {
            _getFS(this.type, this.size, success, error);
        }
    };
    HTML5FS.prototype.empty = function (mainCb) {
        var _this = this;
        this._readdir('/', function (err, entries) {
            if (err) {
                console.error('Failed to empty FS');
                mainCb(err);
            }
            else {
                var finished = function (er) {
                    if (err) {
                        console.error("Failed to empty FS");
                        mainCb(err);
                    }
                    else {
                        mainCb();
                    }
                };
                var deleteEntry = function (entry, cb) {
                    var succ = function () {
                        cb();
                    };
                    var error = function (err) {
                        cb(_this.convert(err, entry.fullPath, !entry.isDirectory));
                    };
                    if (isDirectoryEntry(entry)) {
                        entry.removeRecursively(succ, error);
                    }
                    else {
                        entry.remove(succ, error);
                    }
                };
                async.each(entries, deleteEntry, finished);
            }
        });
    };
    HTML5FS.prototype.rename = function (oldPath, newPath, cb) {
        var _this = this;
        var semaphore = 2, successCount = 0, root = this.fs.root, currentPath = oldPath, error = function (err) {
            if (--semaphore <= 0) {
                cb(_this.convert(err, currentPath, false));
            }
        }, success = function (file) {
            if (++successCount === 2) {
                return cb(new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, "Something was identified as both a file and a directory. This should never happen."));
            }
            if (oldPath === newPath) {
                return cb();
            }
            currentPath = path.dirname(newPath);
            root.getDirectory(currentPath, {}, function (parentDir) {
                currentPath = path.basename(newPath);
                file.moveTo(parentDir, currentPath, function (entry) { cb(); }, function (err) {
                    if (file.isDirectory) {
                        currentPath = newPath;
                        _this.unlink(newPath, function (e) {
                            if (e) {
                                error(err);
                            }
                            else {
                                _this.rename(oldPath, newPath, cb);
                            }
                        });
                    }
                    else {
                        error(err);
                    }
                });
            }, error);
        };
        root.getFile(oldPath, {}, success, error);
        root.getDirectory(oldPath, {}, success, error);
    };
    HTML5FS.prototype.stat = function (path, isLstat, cb) {
        var _this = this;
        var opts = {
            create: false
        };
        var loadAsFile = function (entry) {
            var fileFromEntry = function (file) {
                var stat = new node_fs_stats_1["default"](node_fs_stats_1.FileType.FILE, file.size);
                cb(null, stat);
            };
            entry.file(fileFromEntry, failedToLoad);
        };
        var loadAsDir = function (dir) {
            var size = 4096;
            var stat = new node_fs_stats_1["default"](node_fs_stats_1.FileType.DIRECTORY, size);
            cb(null, stat);
        };
        var failedToLoad = function (err) {
            cb(_this.convert(err, path, false));
        };
        var failedToLoadAsFile = function () {
            _this.fs.root.getDirectory(path, opts, loadAsDir, failedToLoad);
        };
        this.fs.root.getFile(path, opts, loadAsFile, failedToLoadAsFile);
    };
    HTML5FS.prototype.open = function (p, flags, mode, cb) {
        var _this = this;
        var error = function (err) {
            if (err.name === 'InvalidModificationError' && flags.isExclusive()) {
                cb(api_error_1.ApiError.EEXIST(p));
            }
            else {
                cb(_this.convert(err, p, false));
            }
        };
        this.fs.root.getFile(p, {
            create: flags.pathNotExistsAction() === file_flag_1.ActionType.CREATE_FILE,
            exclusive: flags.isExclusive()
        }, function (entry) {
            entry.file(function (file) {
                var reader = new FileReader();
                reader.onloadend = function (event) {
                    var bfs_file = _this._makeFile(p, flags, file, reader.result);
                    cb(null, bfs_file);
                };
                reader.onerror = function (ev) {
                    error(reader.error);
                };
                reader.readAsArrayBuffer(file);
            }, error);
        }, error);
    };
    HTML5FS.prototype._statType = function (stat) {
        return stat.isFile ? node_fs_stats_1.FileType.FILE : node_fs_stats_1.FileType.DIRECTORY;
    };
    HTML5FS.prototype._makeFile = function (path, flag, stat, data) {
        if (data === void 0) { data = new ArrayBuffer(0); }
        var stats = new node_fs_stats_1["default"](node_fs_stats_1.FileType.FILE, stat.size);
        var buffer = util_1.arrayBuffer2Buffer(data);
        return new HTML5FSFile(this, path, flag, stats, buffer);
    };
    HTML5FS.prototype._remove = function (path, cb, isFile) {
        var _this = this;
        var success = function (entry) {
            var succ = function () {
                cb();
            };
            var err = function (err) {
                cb(_this.convert(err, path, !isFile));
            };
            entry.remove(succ, err);
        };
        var error = function (err) {
            cb(_this.convert(err, path, !isFile));
        };
        var opts = {
            create: false
        };
        if (isFile) {
            this.fs.root.getFile(path, opts, success, error);
        }
        else {
            this.fs.root.getDirectory(path, opts, success, error);
        }
    };
    HTML5FS.prototype.unlink = function (path, cb) {
        this._remove(path, cb, true);
    };
    HTML5FS.prototype.rmdir = function (path, cb) {
        var _this = this;
        this.readdir(path, function (e, files) {
            if (e) {
                cb(e);
            }
            else if (files.length > 0) {
                cb(api_error_1.ApiError.ENOTEMPTY(path));
            }
            else {
                _this._remove(path, cb, false);
            }
        });
    };
    HTML5FS.prototype.mkdir = function (path, mode, cb) {
        var _this = this;
        var opts = {
            create: true,
            exclusive: true
        };
        var success = function (dir) {
            cb();
        };
        var error = function (err) {
            cb(_this.convert(err, path, true));
        };
        this.fs.root.getDirectory(path, opts, success, error);
    };
    HTML5FS.prototype._readdir = function (path, cb) {
        var _this = this;
        var error = function (err) {
            cb(_this.convert(err, path, true));
        };
        this.fs.root.getDirectory(path, { create: false }, function (dirEntry) {
            var reader = dirEntry.createReader();
            var entries = [];
            var readEntries = function () {
                reader.readEntries((function (results) {
                    if (results.length) {
                        entries = entries.concat(_toArray(results));
                        readEntries();
                    }
                    else {
                        cb(null, entries);
                    }
                }), error);
            };
            readEntries();
        }, error);
    };
    HTML5FS.prototype.readdir = function (path, cb) {
        this._readdir(path, function (e, entries) {
            if (e) {
                return cb(e);
            }
            var rv = [];
            for (var i = 0; i < entries.length; i++) {
                rv.push(entries[i].name);
            }
            cb(null, rv);
        });
    };
    return HTML5FS;
}(file_system.BaseFileSystem));
exports.__esModule = true;
exports["default"] = HTML5FS;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSFRNTDVGUy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9iYWNrZW5kL0hUTUw1RlMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsSUFBTyxZQUFZLFdBQVcseUJBQXlCLENBQUMsQ0FBQztBQUN6RCxJQUFPLFdBQVcsV0FBVyxxQkFBcUIsQ0FBQyxDQUFDO0FBQ3BELDBCQUFrQyxtQkFBbUIsQ0FBQyxDQUFBO0FBQ3RELDBCQUFtQyxtQkFBbUIsQ0FBQyxDQUFBO0FBQ3ZELDhCQUF5Qyx1QkFBdUIsQ0FBQyxDQUFBO0FBRWpFLElBQU8sSUFBSSxXQUFXLE1BQU0sQ0FBQyxDQUFDO0FBQzlCLElBQU8sTUFBTSxXQUFXLGdCQUFnQixDQUFDLENBQUM7QUFDMUMsSUFBTyxLQUFLLFdBQVcsT0FBTyxDQUFDLENBQUM7QUFDaEMscUJBQXFELGNBQWMsQ0FBQyxDQUFBO0FBRXBFLDBCQUEwQixLQUFZO0lBQ3BDLE1BQU0sQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDO0FBQzNCLENBQUM7QUFFRCxJQUFJLE1BQU0sR0FBMkcsTUFBTSxDQUFDLHVCQUF1QixJQUFJLE1BQU0sQ0FBQyxpQkFBaUIsSUFBSSxJQUFJLENBQUM7QUFFeEwsdUJBQXVCLElBQVksRUFBRSxJQUFZLEVBQUUsT0FBK0IsRUFBRSxhQUE0QjtJQU05RyxFQUFFLENBQUMsQ0FBQyxPQUFjLFNBQVUsQ0FBQyx5QkFBeUIsQ0FBQyxLQUFLLFdBQVcsQ0FBQyxDQUFDLENBQUM7UUFDeEUsTUFBTSxDQUFBLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztZQUNaLEtBQUssTUFBTSxDQUFDLFVBQVU7Z0JBQ2IsU0FBVSxDQUFDLHVCQUF1QixDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFLGFBQWEsQ0FBQyxDQUFDO2dCQUNyRixLQUFLLENBQUM7WUFDUixLQUFLLE1BQU0sQ0FBQyxTQUFTO2dCQUNaLFNBQVUsQ0FBQyxzQkFBc0IsQ0FBQyxZ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LE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUMzQixDQUFDO1lBQ0QsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztRQUNmLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUNILGNBQUM7QUFBRCxDQUFDLEFBdFlELENBQXFDLFdBQVcsQ0FBQyxjQUFjLEdBc1k5RDtBQXRZRDs0QkFzWUMsQ0FBQSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBwcmVsb2FkX2ZpbGUgPSByZXF1aXJlKCcuLi9nZW5lcmljL3ByZWxvYWRfZmlsZScpO1xuaW1wb3J0IGZpbGVfc3lzdGVtID0gcmVxdWlyZSgnLi4vY29yZS9maWxlX3N5c3RlbScpO1xuaW1wb3J0IHtBcGlFcnJvciwgRXJyb3JDb2RlfSBmcm9tICcuLi9jb3JlL2FwaV9lcnJvcic7XG5pbXBvcnQge0ZpbGVGbGFnLCBBY3Rpb25UeXBlfSBmcm9tICcuLi9jb3JlL2ZpbGVfZmxhZyc7XG5pbXBvcnQge2RlZmF1bHQgYXMgU3RhdHMsIEZpbGVUeXBlfSBmcm9tICcuLi9jb3JlL25vZGVfZnNfc3RhdHMnO1xuaW1wb3J0IGZpbGUgPSByZXF1aXJlKCcuLi9jb3JlL2ZpbGUnKTtcbmltcG9ydCBwYXRoID0gcmVxdWlyZSgncGF0aCcpO1xuaW1wb3J0IGdsb2JhbCA9IHJlcXVpcmUoJy4uL2NvcmUvZ2xvYmFsJyk7XG5pbXBvcnQgYXN5bmMgPSByZXF1aXJlKCdhc3luYycpO1xuaW1wb3J0IHtidWZmZXIyQXJyYXlCdWZmZXIsIGFycmF5QnVmZmVyMkJ1ZmZlcn0gZnJvbSAnLi4vY29yZS91dGlsJztcblxuZnVuY3Rpb24gaXNEaXJlY3RvcnlFbnRyeShlbnRyeTogRW50cnkpOiBlbnRyeSBpcyBEaXJlY3RvcnlFbnRyeSB7XG4gIHJldHVybiBlbnRyeS5pc0RpcmVjdG9yeTtcbn1cblxudmFyIF9nZXRGUzogKHR5cGU6bnVtYmVyLCBzaXplOm51bWJlciwgc3VjY2Vzc0NhbGxiYWNrOiBGaWxlU3lzdGVtQ2FsbGJhY2ssIGVycm9yQ2FsbGJhY2s/OiBFcnJvckNhbGxiYWNrKSA9PiB2b2lkID0gZ2xvYmFsLndlYmtpdFJlcXVlc3RGaWxlU3lzdGVtIHx8IGdsb2JhbC5yZXF1ZXN0RmlsZVN5c3RlbSB8fCBudWxsO1xuXG5mdW5jdGlvbiBfcmVxdWVzdFF1b3RhKHR5cGU6IG51bWJlciwgc2l6ZTogbnVtYmVyLCBzdWNjZXNzOiAoc2l6ZTogbnVtYmVyKSA9PiB2b2lkLCBlcnJvckNhbGxiYWNrOiBFcnJvckNhbGxiYWNrKSB7XG4gIC8vIFdlIGNhc3QgbmF2aWdhdG9yIGFuZCB3aW5kb3cgdG8gJzxhbnk+JyBiZWNhdXNlIGV2ZXJ5dGhpbmcgaGVyZSBpc1xuICAvLyBub25zdGFuZGFyZCBmdW5jdGlvbmFsaXR5LCBkZXNwaXRlIHRoZSBmYWN0IHRoYXQgQ2hyb21lIGhhcyB0aGUgb25seVxuICAvLyBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgSFRNTDVGUyBhbmQgaXMgbGlrZWx5IGRyaXZpbmcgdGhlIHN0YW5kYXJkaXphdGlvblxuICAvLyBwcm9jZXNzLiBUaHVzLCB0aGVzZSBvYmplY3RzIGRlZmluZWQgb2ZmIG9mIG5hdmlnYXRvciBhbmQgd2luZG93IGFyZSBub3RcbiAgLy8gcHJlc2VudCBpbiB0aGUgRGVmaW5pdGVseVR5cGVkIFR5cGVTY3JpcHQgdHlwaW5ncyBmb3IgRmlsZVN5c3RlbS5cbiAgaWYgKHR5cGVvZiAoPGFueT4gbmF2aWdhdG9yKVsnd2Via2l0UGVyc2lzdGVudFN0b3JhZ2UnXSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBzd2l0Y2godHlwZSkge1xuICAgICAgY2FzZSBnbG9iYWwuUEVSU0lTVEVOVDpcbiAgICAgICAgKDxhbnk+IG5hdmlnYXRvcikud2Via2l0UGVyc2lzdGVudFN0b3JhZ2UucmVxdWVzdFF1b3RhKHNpemUsIHN1Y2Nlc3MsIGVycm9yQ2FsbGJhY2spO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgZ2xvYmFsLlRFTVBPUkFSWTpcbiAgICAgICAgKDxhbnk+IG5hdmlnYXRvcikud2Via2l0VGVtcG9yYXJ5U3RvcmFnZS5yZXF1ZXN0UXVvdGEoc2l6ZSwgc3VjY2VzcywgZXJyb3JDYWxsYmFjayk7XG4gICAgICAgIGJyZWFrXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBlcnJvckNhbGxiYWNrKG5ldyBUeXBlRXJyb3IoYEludmFsaWQgc3RvcmFnZSB0eXBlOiAke3R5cGV9YCkpO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgKDxhbnk+IGdsb2JhbCkud2Via2l0U3RvcmFnZUluZm8ucmVxdWVzdFF1b3RhKHR5cGUsIHNpemUsIHN1Y2Nlc3MsIGVycm9yQ2FsbGJhY2spO1xuICB9XG59XG5cbmZ1bmN0aW9uIF90b0FycmF5KGxpc3Q/OiBhbnlbXSk6IGFueVtdIHtcbiAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGxpc3QgfHwgW10sIDApO1xufVxuXG4vLyBBIG5vdGUgYWJvdXQgZ2V0RmlsZSBhbmQgZ2V0RGlyZWN0b3J5IG9wdGlvbnM6XG4vLyBUaGVzZSBtZXRob2RzIGFyZSBjYWxsZWQgYXQgbnVtZXJvdXMgcGxhY2VzIGluIHRoaXMgZmlsZSwgYW5kIGFyZSBwYXNzZWRcbi8vIHNvbWUgY29tYmluYXRpb24gb2YgdGhlc2UgdHdvIG9wdGlvbnM6XG4vLyAgIC0gY3JlYXRlOiBJZiB0cnVlLCB0aGUgZW50cnkgd2lsbCBiZSBjcmVhdGVkIGlmIGl0IGRvZXNuJ3QgZXhpc3QuXG4vLyAgICAgICAgICAgICBJZiBmYWxzZSwgYW4gZXJyb3Igd2lsbCBiZSB0aHJvd24gaWYgaXQgZG9lc24ndCBleGlzdC5cbi8vICAgLSBleGNsdXNpdmU6IElmIHRydWUsIG9ubHkgY3JlYXRlIHRoZSBlbnRyeSBpZiBpdCBkb2Vzbid0IGFscmVhZHkgZXhpc3QsXG4vLyAgICAgICAgICAgICAgICBhbmQgdGhyb3cgYW4gZXJyb3IgaWYgaXQgZG9lcy5cblxuZXhwb3J0IGNsYXNzIEhUTUw1RlNGaWxlIGV4dGVuZHMgcHJlbG9hZF9maWxlLlByZWxvYWRGaWxlPEhUTUw1RlM+IGltcGxlbWVudHMgZmlsZS5GaWxlIHtcbiAgY29uc3RydWN0b3IoX2ZzOiBIVE1MNUZTLCBfcGF0aDogc3RyaW5nLCBfZmxhZzogRmlsZUZsYWcsIF9zdGF0OiBTdGF0cywgY29udGVudHM/OiBOb2RlQnVmZmVyKSB7XG4gICAgc3VwZXIoX2ZzLCBfcGF0aCwgX2ZsYWcsIF9zdGF0LCBjb250ZW50cyk7XG4gIH1cblxuICBwdWJsaWMgc3luYyhjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmlzRGlydHkoKSkge1xuICAgICAgLy8gRG9uJ3QgY3JlYXRlIHRoZSBmaWxlIChpdCBzaG91bGQgYWxyZWFkeSBoYXZlIGJlZW4gY3JlYXRlZCBieSBgb3BlbmApXG4gICAgICB2YXIgb3B0cyA9IHtcbiAgICAgICAgY3JlYXRlOiBmYWxzZVxuICAgICAgfTtcbiAgICAgIHZhciBfZnMgPSB0aGlzLl9mcztcbiAgICAgIHZhciBzdWNjZXNzOiBGaWxlRW50cnlDYWxsYmFjayA9IChlbnRyeSkgPT4ge1xuICAgICAgICBlbnRyeS5jcmVhdGVXcml0ZXIoKHdyaXRlcikgPT4ge1xuICAgICAgICAgIHZhciBidWZmZXIgPSB0aGlzLmdldEJ1ZmZlcigpO1xuICAgICAgICAgIHZhciBibG9iID0gbmV3IEJsb2IoW2J1ZmZlcjJBcnJheUJ1ZmZlcihidWZmZXIpXSk7XG4gICAgICAgICAgdmFyIGxlbmd0aCA9IGJsb2Iuc2l6ZTtcbiAgICAgICAgICB3cml0ZXIub253cml0ZWVuZCA9ICgpID0+IHtcbiAgICAgICAgICAgIHdyaXRlci5vbndyaXRlZW5kID0gbnVsbDtcbiAgICAgICAgICAgIHdyaXRlci50cnVuY2F0ZShsZW5ndGgpO1xuICAgICAgICAgICAgdGhpcy5yZXNldERpcnR5KCk7XG4gICAgICAgICAgICBjYigpO1xuICAgICAgICAgIH07XG4gICAgICAgICAgd3JpdGVyLm9uZXJyb3IgPSAoZXJyOiBET01FcnJvcikgPT4ge1xuICAgICAgICAgICAgY2IoX2ZzLmNvbnZlcnQoZXJyLCB0aGlzLmdldFBhdGgoKSwgZmFsc2UpKTtcbiAgICAgICAgICB9O1xuICAgICAgICAgIHdyaXRlci53cml0ZShibG9iKTtcbiAgICAgICAgfSk7XG4gICAgICB9O1xuICAgICAgdmFyIGVycm9yID0gKGVycjogRE9NRXJyb3IpID0+IHtcbiAgICAgICAgY2IoX2ZzLmNvbnZlcnQoZXJyLCB0aGlzLmdldFBhdGgoKSwgZmFsc2UpKTtcbiAgICAgIH07XG4gICAgICBfZnMuZnMucm9vdC5nZXRGaWxlKHRoaXMuZ2V0UGF0aCgpLCBvcHRzLCBzdWNjZXNzLCBlcnJvcik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNiKCk7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIGNsb3NlKGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5zeW5jKGNiKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBIVE1MNUZTIGV4dGVuZHMgZmlsZV9zeXN0ZW0uQmFzZUZpbGVTeXN0ZW0gaW1wbGVtZW50cyBmaWxlX3N5c3RlbS5GaWxlU3lzdGVtIHtcbiAgcHJpdmF0ZSBzaXplOiBudW1iZXI7XG4gIHByaXZhdGUgdHlwZTogbnVtYmVyO1xuICAvLyBIVE1MNUZpbGUgcmVhY2hlcyBpbnRvIEhUTUw1RlMuIDovXG4gIHB1YmxpYyBmczogRmlsZVN5c3RlbTtcbiAgLyoqXG4gICAqIEFyZ3VtZW50czpcbiAgICogICAtIHR5cGU6IFBFUlNJU1RFTlQgb3IgVEVNUE9SQVJZXG4gICAqICAgLSBzaXplOiBzdG9yYWdlIHF1b3RhIHRvIHJlcXVlc3QsIGluIG1lZ2FieXRlcy4gQWxsb2NhdGVkIHZhbHVlIG1heSBiZSBsZXNzLlxuICAgKi9cbiAgY29uc3RydWN0b3Ioc2l6ZTogbnVtYmVyID0gNSwgdHlwZTogbnVtYmVyID0gZ2xvYmFsLlBFUlNJU1RFTlQpIHtcbiAgICBzdXBlcigpO1xuICAgIC8vIENvbnZlcnQgTUIgdG8gYnl0ZXMuXG4gICAgdGhpcy5zaXplID0gMTAyNCAqIDEwMjQgKiBzaXplO1xuICAgIHRoaXMudHlwZSA9IHR5cGU7XG4gIH1cblxuICBwdWJsaWMgZ2V0TmFtZSgpOiBzdHJpbmcge1xuICAgIHJldHVybiAnSFRNTDUgRmlsZVN5c3RlbSc7XG4gIH1cblxuICBwdWJsaWMgc3RhdGljIGlzQXZhaWxhYmxlKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBfZ2V0RlMgIT0gbnVsbDtcbiAgfVxuXG4gIHB1YmxpYyBpc1JlYWRPbmx5KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHB1YmxpYyBzdXBwb3J0c1N5bWxpbmtzKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHB1YmxpYyBzdXBwb3J0c1Byb3BzKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHB1YmxpYyBzdXBwb3J0c1N5bmNoKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb252ZXJ0cyB0aGUgZ2l2ZW4gRE9NRXJyb3IgaW50byBhbiBhcHByb3ByaWF0ZSBBcGlFcnJvci5cbiAgICogRnVsbCBsaXN0IG9mIHZhbHVlcyBoZXJlOlxuICAgKiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvRE9NRXJyb3JcbiAgICovXG4gIHB1YmxpYyBjb252ZXJ0KGVycjogRE9NRXJyb3IsIHA6IHN0cmluZywgZXhwZWN0ZWREaXI6IGJvb2xlYW4pOiBBcGlFcnJvciB7XG4gICAgc3dpdGNoIChlcnIubmFtZSkge1xuICAgICAgLyogVGhlIHVzZXIgYWdlbnQgZmFpbGVkIHRvIGNyZWF0ZSBhIGZpbGUgb3IgZGlyZWN0b3J5IGR1ZSB0byB0aGUgZXhpc3RlbmNlIG9mIGEgZmlsZSBvclxuICAgICAgICAgZGlyZWN0b3J5IHdpdGggdGhlIHNhbWUgcGF0aC4gICovXG4gICAgICBjYXNlIFwiUGF0aEV4aXN0c0Vycm9yXCI6XG4gICAgICAgIHJldHVybiBBcGlFcnJvci5FRVhJU1QocCk7XG4gICAgICAvKiBUaGUgb3BlcmF0aW9uIGZhaWxlZCBiZWNhdXNlIGl0IHdvdWxkIGNhdXNlIHRoZSBhcHBsaWNhdGlvbiB0byBleGNlZWQgaXRzIHN0b3JhZ2UgcXVvdGEuICAqL1xuICAgICAgY2FzZSAnUXVvdGFFeGNlZWRlZEVycm9yJzpcbiAgICAgICAgcmV0dXJuIEFwaUVycm9yLkZpbGVFcnJvcihFcnJvckNvZGUuRU5PU1BDLCBwKTtcbiAgICAgIC8qICBBIHJlcXVpcmVkIGZpbGUgb3IgZGlyZWN0b3J5IGNvdWxkIG5vdCBiZSBmb3VuZCBhdCB0aGUgdGltZSBhbiBvcGVyYXRpb24gd2FzIHByb2Nlc3NlZC4gICAqL1xuICAgICAgY2FzZSAnTm90Rm91bmRFcnJvcic6XG4gICAgICAgIHJldHVybiBBcGlFcnJvci5FTk9FTlQocCk7XG4gICAgICAvKiBUaGlzIGlzIGEgc2VjdXJpdHkgZXJyb3IgY29kZSB0byBiZSB1c2VkIGluIHNpdHVhdGlvbnMgbm90IGNvdmVyZWQgYnkgYW55IG90aGVyIGVycm9yIGNvZGVzLlxuICAgICAgICAgLSBBIHJlcXVpcmVkIGZpbGUgd2FzIHVuc2FmZSBmb3IgYWNjZXNzIHdpdGhpbiBhIFdlYiBhcHBsaWNhdGlvblxuICAgICAgICAgLSBUb28gbWFueSBjYWxscyBhcmUgYmVpbmcgbWFkZSBvbiBmaWxlc3lzdGVtIHJlc291cmNlcyAqL1xuICAgICAgY2FzZSAnU2VjdXJpdHlFcnJvcic6XG4gICAgICAgIHJldHVybiBBcGlFcnJvci5GaWxlRXJyb3IoRXJyb3JDb2RlLkVBQ0NFUywgcCk7XG4gICAgICAvKiBUaGUgbW9kaWZpY2F0aW9uIHJlcXVlc3RlZCB3YXMgaWxsZWdhbC4gRXhhbXBsZXMgb2YgaW52YWxpZCBtb2RpZmljYXRpb25zIGluY2x1ZGUgbW92aW5nIGFcbiAgICAgICAgIGRpcmVjdG9yeSBpbnRvIGl0cyBvd24gY2hpbGQsIG1vdmluZyBhIGZpbGUgaW50byBpdHMgcGFyZW50IGRpcmVjdG9yeSB3aXRob3V0IGNoYW5naW5nIGl0cyBuYW1lLFxuICAgICAgICAgb3IgY29weWluZyBhIGRpcmVjdG9yeSB0byBhIHBhdGggb2NjdXBpZWQgYnkgYSBmaWxlLiAgKi9cbiAgICAgIGNhc2UgJ0ludmFsaWRNb2RpZmljYXRpb25FcnJvcic6XG4gICAgICAgIHJldHVybiBBcGlFcnJvci5GaWxlRXJyb3IoRXJyb3JDb2RlLkVQRVJNLCBwKTtcbiAgICAgIC8qIFRoZSB1c2VyIGhhcyBhdHRlbXB0ZWQgdG8gbG9vayB1cCBhIGZpbGUgb3IgZGlyZWN0b3J5LCBidXQgdGhlIEVudHJ5IGZvdW5kIGlzIG9mIHRoZSB3cm9uZyB0eXBlXG4gICAgICAgICBbZS5nLiBpcyBhIERpcmVjdG9yeUVudHJ5IHdoZW4gdGhlIHVzZXIgcmVxdWVzdGVkIGEgRmlsZUVudHJ5XS4gICovXG4gICAgICBjYXNlICdUeXBlTWlzbWF0Y2hFcnJvcic6XG4gICAgICAgIHJldHVybiBBcGlFcnJvci5GaWxlRXJyb3IoZXhwZWN0ZWREaXIgPyBFcnJvckNvZGUuRU5PVERJUiA6IEVycm9yQ29kZS5FSVNESVIsIHApO1xuICAgICAgLyogQSBwYXRoIG9yIFVSTCBzdXBwbGllZCB0byB0aGUgQVBJIHdhcyBtYWxmb3JtZWQuICAqL1xuICAgICAgY2FzZSBcIkVuY29kaW5nRXJyb3JcIjpcbiAgICAgIC8qIEFuIG9wZXJhdGlvbiBkZXBlbmRlZCBvbiBzdGF0ZSBjYWNoZWQgaW4gYW4gaW50ZXJmYWNlIG9iamVjdCwgYnV0IHRoYXQgc3RhdGUgdGhhdCBoYXMgY2hhbmdlZFxuICAgICAgICAgc2luY2UgaXQgd2FzIHJlYWQgZnJvbSBkaXNrLiAgKi9cbiAgICAgIGNhc2UgXCJJbnZhbGlkU3RhdGVFcnJvclwiOlxuICAgICAgLyogVGhlIHVzZXIgYXR0ZW1wdGVkIHRvIHdyaXRlIHRvIGEgZmlsZSBvciBkaXJlY3Rvcnkgd2hpY2ggY291bGQgbm90IGJlIG1vZGlmaWVkIGR1ZSB0byB0aGUgc3RhdGVcbiAgICAgICAgIG9mIHRoZSB1bmRlcmx5aW5nIGZpbGVzeXN0ZW0uICAqL1xuICAgICAgY2FzZSBcIk5vTW9kaWZpY2F0aW9uQWxsb3dlZEVycm9yXCI6XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gQXBpRXJyb3IuRmlsZUVycm9yKEVycm9yQ29kZS5FSU5WQUwsIHApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBOb25zdGFuZGFyZFxuICAgKiBSZXF1ZXN0cyBhIHN0b3JhZ2UgcXVvdGEgZnJvbSB0aGUgYnJvd3NlciB0byBiYWNrIHRoaXMgRlMuXG4gICAqL1xuICBwdWJsaWMgYWxsb2NhdGUoY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQgPSBmdW5jdGlvbigpe30pOiB2b2lkIHtcbiAgICB2YXIgc3VjY2VzcyA9IChmczogRmlsZVN5c3RlbSk6IHZvaWQgPT4ge1xuICAgICAgdGhpcy5mcyA9IGZzO1xuICAgICAgY2IoKVxuICAgIH07XG4gICAgdmFyIGVycm9yID0gKGVycjogRE9NRXhjZXB0aW9uKTogdm9pZCA9PiB7XG4gICAgICBjYih0aGlzLmNvbnZlcnQoZXJyLCBcIi9cIiwgdHJ1ZSkpO1xuICAgIH07XG4gICAgaWYgKHRoaXMudHlwZSA9PT0gZ2xvYmFsLlBFUlNJU1RFTlQpIHtcbiAgICAgIF9yZXF1ZXN0UXVvdGEodGhpcy50eXBlLCB0aGlzLnNpemUsIChncmFudGVkOiBudW1iZXIpID0+IHtcbiAgICAgICAgX2dldEZTKHRoaXMudHlwZSwgZ3JhbnRlZCwgc3VjY2VzcywgZXJyb3IpO1xuICAgICAgfSwgZXJyb3IpO1xuICAgIH0gZWxzZSB7XG4gICAgICBfZ2V0RlModGhpcy50eXBlLCB0aGlzLnNpemUsIHN1Y2Nlc3MsIGVycm9yKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogTm9uc3RhbmRhcmRcbiAgICogRGVsZXRlcyBldmVyeXRoaW5nIGluIHRoZSBGUy4gVXNlZCBmb3IgdGVzdGluZy5cbiAgICogS2FybWEgY2xlYXJzIHRoZSBzdG9yYWdlIGFmdGVyIHlvdSBxdWl0IGl0IGJ1dCBub3QgYmV0d2VlbiBydW5zIG9mIHRoZSB0ZXN0XG4gICAqIHN1aXRlLCBhbmQgdGhlIHRlc3RzIGV4cGVjdCBhbiBlbXB0eSBGUyBldmVyeSB0aW1lLlxuICAgKi9cbiAgcHVibGljIGVtcHR5KG1haW5DYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIC8vIEdldCBhIGxpc3Qgb2YgYWxsIGVudHJpZXMgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IHRvIGRlbGV0ZSB0aGVtXG4gICAgdGhpcy5fcmVhZGRpcignLycsIChlcnI6IEFwaUVycm9yLCBlbnRyaWVzPzogRW50cnlbXSk6IHZvaWQgPT4ge1xuICAgICAgaWYgKGVycikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gZW1wdHkgRlMnKTtcbiAgICAgICAgbWFpbkNiKGVycik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBDYWxsZWQgd2hlbiBldmVyeSBlbnRyeSBoYXMgYmVlbiBvcGVyYXRlZCBvblxuICAgICAgICB2YXIgZmluaXNoZWQgPSAoZXI6IGFueSk6IHZvaWQgPT4ge1xuICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJGYWlsZWQgdG8gZW1wdHkgRlNcIik7XG4gICAgICAgICAgICBtYWluQ2IoZXJyKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbWFpbkNiKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICAvLyBSZW1vdmVzIGZpbGVzIGFuZCByZWN1cnNpdmVseSByZW1vdmVzIGRpcmVjdG9yaWVzXG4gICAgICAgIHZhciBkZWxldGVFbnRyeSA9IChlbnRyeTogRW50cnksIGNiOiAoZT86IGFueSkgPT4gdm9pZCk6IHZvaWQgPT4ge1xuICAgICAgICAgIHZhciBzdWNjID0gKCkgPT4ge1xuICAgICAgICAgICAgY2IoKTtcbiAgICAgICAgICB9O1xuICAgICAgICAgIHZhciBlcnJvciA9IChlcnI6IERPTUV4Y2VwdGlvbikgPT4ge1xuICAgICAgICAgICAgY2IodGhpcy5jb252ZXJ0KGVyciwgZW50cnkuZnVsbFBhdGgsICFlbnRyeS5pc0RpcmVjdG9yeSkpO1xuICAgICAgICAgIH07XG4gICAgICAgICAgaWYgKGlzRGlyZWN0b3J5RW50cnkoZW50cnkpKSB7XG4gICAgICAgICAgICBlbnRyeS5yZW1vdmVSZWN1cnNpdmVseShzdWNjLCBlcnJvcik7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGVudHJ5LnJlbW92ZShzdWNjLCBlcnJvcik7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICAvLyBMb29wIHRocm91Z2ggdGhlIGVudHJpZXMgYW5kIHJlbW92ZSB0aGVtLCB0aGVuIGNhbGwgdGhlIGNhbGxiYWNrXG4gICAgICAgIC8vIHdoZW4gdGhleSdyZSBhbGwgZmluaXNoZWQuXG4gICAgICAgIGFzeW5jLmVhY2goZW50cmllcywgZGVsZXRlRW50cnksIGZpbmlzaGVkKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyByZW5hbWUob2xkUGF0aDogc3RyaW5nLCBuZXdQYXRoOiBzdHJpbmcsIGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdmFyIHNlbWFwaG9yZTogbnVtYmVyID0gMixcbiAgICAgIHN1Y2Nlc3NDb3VudDogbnVtYmVyID0gMCxcbiAgICAgIHJvb3Q6IERpcmVjdG9yeUVudHJ5ID0gdGhpcy5mcy5yb290LFxuICAgICAgY3VycmVudFBhdGg6IHN0cmluZyA9IG9sZFBhdGgsXG4gICAgICBlcnJvciA9IChlcnI6IERPTUV4Y2VwdGlvbik6IHZvaWQgPT4ge1xuICAgICAgICBpZiAoLS1zZW1hcGhvcmUgPD0gMCkge1xuICAgICAgICAgICAgY2IodGhpcy5jb252ZXJ0KGVyciwgY3VycmVudFBhdGgsIGZhbHNlKSk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBzdWNjZXNzID0gKGZpbGU6IEVudHJ5KTogdm9pZCA9PiB7XG4gICAgICAgIGlmICgrK3N1Y2Nlc3NDb3VudCA9PT0gMikge1xuICAgICAgICAgIHJldHVybiBjYihuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTlZBTCwgXCJTb21ldGhpbmcgd2FzIGlkZW50aWZpZWQgYXMgYm90aCBhIGZpbGUgYW5kIGEgZGlyZWN0b3J5LiBUaGlzIHNob3VsZCBuZXZlciBoYXBwZW4uXCIpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNQRUNJQUwgQ0FTRTogSWYgbmV3UGF0aCA9PT0gb2xkUGF0aCwgYW5kIHRoZSBwYXRoIGV4aXN0cywgdGhlblxuICAgICAgICAvLyB0aGlzIG9wZXJhdGlvbiB0cml2aWFsbHkgc3VjY2VlZHMuXG4gICAgICAgIGlmIChvbGRQYXRoID09PSBuZXdQYXRoKSB7XG4gICAgICAgICAgcmV0dXJuIGNiKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBHZXQgdGhlIG5ldyBwYXJlbnQgZGlyZWN0b3J5LlxuICAgICAgICBjdXJyZW50UGF0aCA9IHBhdGguZGlybmFtZShuZXdQYXRoKTtcbiAgICAgICAgcm9vdC5nZXREaXJlY3RvcnkoY3VycmVudFBhdGgsIHt9LCAocGFyZW50RGlyOiBEaXJlY3RvcnlFbnRyeSk6IHZvaWQgPT4ge1xuICAgICAgICAgIGN1cnJlbnRQYXRoID0gcGF0aC5iYXNlbmFtZShuZXdQYXRoKTtcbiAgICAgICAgICBmaWxlLm1vdmVUbyhwYXJlbnREaXIsIGN1cnJlbnRQYXRoLCAoZW50cnk6IEVudHJ5KTogdm9pZCA9PiB7IGNiKCk7IH0sIChlcnI6IERPTUV4Y2VwdGlvbik6IHZvaWQgPT4ge1xuICAgICAgICAgICAgLy8gU1BFQ0lBTCBDQVNFOiBJZiBvbGRQYXRoIGlzIGEgZGlyZWN0b3J5LCBhbmQgbmV3UGF0aCBpcyBhXG4gICAgICAgICAgICAvLyBmaWxlLCByZW5hbWUgc2hvdWxkIGRlbGV0ZSB0aGUgZmlsZSBhbmQgcGVyZm9ybSB0aGUgbW92ZS5cbiAgICAgICAgICAgIGlmIChmaWxlLmlzRGlyZWN0b3J5KSB7XG4gICAgICAgICAgICAgIGN1cnJlbnRQYXRoID0gbmV3UGF0aDtcbiAgICAgICAgICAgICAgLy8gVW5saW5rIG9ubHkgd29ya3Mgb24gZmlsZXMuIFRyeSB0byBkZWxldGUgbmV3UGF0aC5cbiAgICAgICAgICAgICAgdGhpcy51bmxpbmsobmV3UGF0aCwgKGU/KTogdm9pZCA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGUpIHtcbiAgICAgICAgICAgICAgICAgIC8vIG5ld1BhdGggaXMgcHJvYmFibHkgYSBkaXJlY3RvcnkuXG4gICAgICAgICAgICAgICAgICBlcnJvcihlcnIpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAvLyBSZWN1ciwgbm93IHRoYXQgbmV3UGF0aCBkb2Vzbid0IGV4aXN0LlxuICAgICAgICAgICAgICAgICAgdGhpcy5yZW5hbWUob2xkUGF0aCwgbmV3UGF0aCwgY2IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBlcnJvcihlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9LCBlcnJvcik7XG4gICAgICB9O1xuXG4gICAgLy8gV2UgZG9uJ3Qga25vdyBpZiBvbGRQYXRoIGlzIGEgKmZpbGUqIG9yIGEgKmRpcmVjdG9yeSosIGFuZCB0aGVyZSdzIG5vXG4gICAgLy8gd2F5IHRvIHN0YXQgaXRlbXMuIFNvIGxhdW5jaCBib3RoIHJlcXVlc3RzLCBzZWUgd2hpY2ggb25lIHN1Y2NlZWRzLlxuICAgIHJvb3QuZ2V0RmlsZShvbGRQYXRoLCB7fSwgc3VjY2VzcywgZXJyb3IpO1xuICAgIHJvb3QuZ2V0RGlyZWN0b3J5KG9sZFBhdGgsIHt9LCBzdWNjZXNzLCBlcnJvcik7XG4gIH1cblxuICBwdWJsaWMgc3RhdChwYXRoOiBzdHJpbmcsIGlzTHN0YXQ6IGJvb2xlYW4sIGNiOiAoZXJyOiBBcGlFcnJvciwgc3RhdD86IFN0YXRzKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgLy8gVGhyb3cgYW4gZXJyb3IgaWYgdGhlIGVudHJ5IGRvZXNuJ3QgZXhpc3QsIGJlY2F1c2UgdGhlbiB0aGVyZSdzIG5vdGhpbmdcbiAgICAvLyB0byBzdGF0LlxuICAgIHZhciBvcHRzID0ge1xuICAgICAgY3JlYXRlOiBmYWxzZVxuICAgIH07XG4gICAgLy8gQ2FsbGVkIHdoZW4gdGhlIHBhdGggaGFzIGJlZW4gc3VjY2Vzc2Z1bGx5IGxvYWRlZCBhcyBhIGZpbGUuXG4gICAgdmFyIGxvYWRBc0ZpbGUgPSAoZW50cnk6IEZpbGVFbnRyeSk6IHZvaWQgPT4ge1xuICAgICAgdmFyIGZpbGVGcm9tRW50cnkgPSAoZmlsZTogRmlsZSk6IHZvaWQgPT4ge1xuICAgICAgICB2YXIgc3RhdCA9IG5ldyBTdGF0cyhGaWxlVHlwZS5GSUxFLCBmaWxlLnNpemUpO1xuICAgICAgICBjYihudWxsLCBzdGF0KTtcbiAgICAgIH07XG4gICAgICBlbnRyeS5maWxlKGZpbGVGcm9tRW50cnksIGZhaWxlZFRvTG9hZCk7XG4gICAgfTtcbiAgICAvLyBDYWxsZWQgd2hlbiB0aGUgcGF0aCBoYXMgYmVlbiBzdWNjZXNzZnVsbHkgbG9hZGVkIGFzIGEgZGlyZWN0b3J5LlxuICAgIHZhciBsb2FkQXNEaXIgPSAoZGlyOiBEaXJlY3RvcnlFbnRyeSk6IHZvaWQgPT4ge1xuICAgICAgLy8gRGlyZWN0b3J5IGVudHJ5IHNpemUgY2FuJ3QgYmUgZGV0ZXJtaW5lZCBmcm9tIHRoZSBIVE1MNSBGUyBBUEksIGFuZCBpc1xuICAgICAgLy8gaW1wbGVtZW50YXRpb24tZGVwZW5kYW50IGFueXdheSwgc28gYSBkdW1teSB2YWx1ZSBpcyB1c2VkLlxuICAgICAgdmFyIHNpemUgPSA0MDk2O1xuICAgICAgdmFyIHN0YXQgPSBuZXcgU3RhdHMoRmlsZVR5cGUuRElSRUNUT1JZLCBzaXplKTtcbiAgICAgIGNiKG51bGwsIHN0YXQpO1xuICAgIH07XG4gICAgLy8gQ2FsbGVkIHdoZW4gdGhlIHBhdGggY291bGRuJ3QgYmUgb3BlbmVkIGFzIGEgZGlyZWN0b3J5IG9yIGEgZmlsZS5cbiAgICB2YXIgZmFpbGVkVG9Mb2FkID0gKGVycjogRE9NRXhjZXB0aW9uKTogdm9pZCA9PiB7XG4gICAgICBjYih0aGlzLmNvbnZlcnQoZXJyLCBwYXRoLCBmYWxzZSAvKiBVbmtub3duIC8gaXJyZWxldmFudCAqLykpO1xuICAgIH07XG4gICAgLy8gQ2FsbGVkIHdoZW4gdGhlIHBhdGggY291bGRuJ3QgYmUgb3BlbmVkIGFzIGEgZmlsZSwgYnV0IG1pZ2h0IHN0aWxsIGJlIGFcbiAgICAvLyBkaXJlY3RvcnkuXG4gICAgdmFyIGZhaWxlZFRvTG9hZEFzRmlsZSA9ICgpOiB2b2lkID0+IHtcbiAgICAgIHRoaXMuZnMucm9vdC5nZXREaXJlY3RvcnkocGF0aCwgb3B0cywgbG9hZEFzRGlyLCBmYWlsZWRUb0xvYWQpO1xuICAgIH07XG4gICAgLy8gTm8gbWV0aG9kIGN1cnJlbnRseSBleGlzdHMgdG8gZGV0ZXJtaW5lIHdoZXRoZXIgYSBwYXRoIHJlZmVycyB0byBhXG4gICAgLy8gZGlyZWN0b3J5IG9yIGEgZmlsZSwgc28gdGhpcyBpbXBsZW1lbnRhdGlvbiB0cmllcyBib3RoIGFuZCB1c2VzIHRoZSBmaXJzdFxuICAgIC8vIG9uZSB0aGF0IHN1Y2NlZWRzLlxuICAgIHRoaXMuZnMucm9vdC5nZXRGaWxlKHBhdGgsIG9wdHMsIGxvYWRBc0ZpbGUsIGZhaWxlZFRvTG9hZEFzRmlsZSk7XG4gIH1cblxuICBwdWJsaWMgb3BlbihwOiBzdHJpbmcsIGZsYWdzOiBGaWxlRmxhZywgbW9kZTogbnVtYmVyLCBjYjogKGVycjogQXBpRXJyb3IsIGZkPzogZmlsZS5GaWxlKSA9PiBhbnkpOiB2b2lkIHtcbiAgICB2YXIgZXJyb3IgPSAoZXJyOiBET01FcnJvcik6IHZvaWQgPT4ge1xuICAgICAgaWYgKGVyci5uYW1lID09PSAnSW52YWxpZE1vZGlmaWNhdGlvbkVycm9yJyAmJiBmbGFncy5pc0V4Y2x1c2l2ZSgpKSB7XG4gICAgICAgIGNiKEFwaUVycm9yLkVFWElTVChwKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjYih0aGlzLmNvbnZlcnQoZXJyLCBwLCBmYWxzZSkpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICB0aGlzLmZzLnJvb3QuZ2V0RmlsZShwLCB7XG4gICAgICBjcmVhdGU6IGZsYWdzLnBhdGhOb3RFeGlzdHNBY3Rpb24oKSA9PT0gQWN0aW9uVHlwZS5DUkVBVEVfRklMRSxcbiAgICAgIGV4Y2x1c2l2ZTogZmxhZ3MuaXNFeGNsdXNpdmUoKVxuICAgIH0sIChlbnRyeTogRmlsZUVudHJ5KTogdm9pZCA9PiB7XG4gICAgICAvLyBUcnkgdG8gZmV0Y2ggY29ycmVzcG9uZGluZyBmaWxlLlxuICAgICAgZW50cnkuZmlsZSgoZmlsZTogRmlsZSk6IHZvaWQgPT4ge1xuICAgICAgICB2YXIgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcbiAgICAgICAgcmVhZGVyLm9ubG9hZGVuZCA9IChldmVudDogRXZlbnQpOiB2b2lkID0+IHtcbiAgICAgICAgICB2YXIgYmZzX2ZpbGUgPSB0aGlzLl9tYWtlRmlsZShwLCBmbGFncywgZmlsZSwgPEFycmF5QnVmZmVyPiByZWFkZXIucmVzdWx0KTtcbiAgICAgICAgICBjYihudWxsLCBiZnNfZmlsZSk7XG4gICAgICAgIH07XG4gICAgICAgIHJlYWRlci5vbmVycm9yID0gKGV2OiBFdmVudCkgPT4ge1xuICAgICAgICAgIGVycm9yKHJlYWRlci5lcnJvcik7XG4gICAgICAgIH07XG4gICAgICAgIHJlYWRlci5yZWFkQXNBcnJheUJ1ZmZlcihmaWxlKTtcbiAgICAgIH0sIGVycm9yKTtcbiAgICB9LCBlcnJvcik7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBhIEJyb3dzZXJGUyBvYmplY3QgcmVwcmVzZW50aW5nIHRoZSB0eXBlIG9mIGEgRHJvcGJveC5qcyBzdGF0IG9iamVjdFxuICAgKi9cbiAgcHJpdmF0ZSBfc3RhdFR5cGUoc3RhdDogRW50cnkpOiBGaWxlVHlwZSB7XG4gICAgcmV0dXJuIHN0YXQuaXNGaWxlID8gRmlsZVR5cGUuRklMRSA6IEZpbGVUeXBlLkRJUkVDVE9SWTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGEgQnJvd3NlckZTIG9iamVjdCByZXByZXNlbnRpbmcgYSBGaWxlLCBjcmVhdGVkIGZyb20gdGhlIGRhdGFcbiAgICogcmV0dXJuZWQgYnkgY2FsbHMgdG8gdGhlIERyb3Bib3ggQVBJLlxuICAgKi9cbiAgcHJpdmF0ZSBfbWFrZUZpbGUocGF0aDogc3RyaW5nLCBmbGFnOiBGaWxlRmxhZywgc3RhdDogRmlsZSwgZGF0YTogQXJyYXlCdWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoMCkpOiBIVE1MNUZTRmlsZSB7XG4gICAgdmFyIHN0YXRzID0gbmV3IFN0YXRzKEZpbGVUeXBlLkZJTEUsIHN0YXQuc2l6ZSk7XG4gICAgdmFyIGJ1ZmZlciA9IGFycmF5QnVmZmVyMkJ1ZmZlcihkYXRhKTtcbiAgICByZXR1cm4gbmV3IEhUTUw1RlNGaWxlKHRoaXMsIHBhdGgsIGZsYWcsIHN0YXRzLCBidWZmZXIpO1xuICB9XG5cbiAgLyoqXG4gICAqIERlbGV0ZSBhIGZpbGUgb3IgZGlyZWN0b3J5IGZyb20gdGhlIGZpbGUgc3lzdGVtXG4gICAqIGlzRmlsZSBzaG91bGQgcmVmbGVjdCB3aGljaCBjYWxsIHdhcyBtYWRlIHRvIHJlbW92ZSB0aGUgaXQgKGB1bmxpbmtgIG9yXG4gICAqIGBybWRpcmApLiBJZiB0aGlzIGRvZXNuJ3QgbWF0Y2ggd2hhdCdzIGFjdHVhbGx5IGF0IGBwYXRoYCwgYW4gZXJyb3Igd2lsbCBiZVxuICAgKiByZXR1cm5lZFxuICAgKi9cbiAgcHJpdmF0ZSBfcmVtb3ZlKHBhdGg6IHN0cmluZywgY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQsIGlzRmlsZTogYm9vbGVhbik6IHZvaWQge1xuICAgIHZhciBzdWNjZXNzID0gKGVudHJ5OiBFbnRyeSk6IHZvaWQgPT4ge1xuICAgICAgdmFyIHN1Y2MgPSAoKSA9PiB7XG4gICAgICAgIGNiKCk7XG4gICAgICB9O1xuICAgICAgdmFyIGVyciA9IChlcnI6IERPTUV4Y2VwdGlvbikgPT4ge1xuICAgICAgICBjYih0aGlzLmNvbnZlcnQoZXJyLCBwYXRoLCAhaXNGaWxlKSk7XG4gICAgICB9O1xuICAgICAgZW50cnkucmVtb3ZlKHN1Y2MsIGVycik7XG4gICAgfTtcbiAgICB2YXIgZXJyb3IgPSAoZXJyOiBET01FeGNlcHRpb24pOiB2b2lkID0+IHtcbiAgICAgIGNiKHRoaXMuY29udmVydChlcnIsIHBhdGgsICFpc0ZpbGUpKTtcbiAgICB9O1xuICAgIC8vIERlbGV0aW5nIHRoZSBlbnRyeSwgc28gZG9uJ3QgY3JlYXRlIGl0XG4gICAgdmFyIG9wdHMgPSB7XG4gICAgICBjcmVhdGU6IGZhbHNlXG4gICAgfTtcblxuICAgIGlmIChpc0ZpbGUpIHtcbiAgICAgIHRoaXMuZnMucm9vdC5nZXRGaWxlKHBhdGgsIG9wdHMsIHN1Y2Nlc3MsIGVycm9yKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5mcy5yb290LmdldERpcmVjdG9yeShwYXRoLCBvcHRzLCBzdWNjZXNzLCBlcnJvcik7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIHVubGluayhwYXRoOiBzdHJpbmcsIGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5fcmVtb3ZlKHBhdGgsIGNiLCB0cnVlKTtcbiAgfVxuXG4gIHB1YmxpYyBybWRpcihwYXRoOiBzdHJpbmcsIGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgLy8gQ2hlY2sgaWYgZGlyZWN0b3J5IGlzIG5vbi1lbXB0eSwgZmlyc3QuXG4gICAgdGhpcy5yZWFkZGlyKHBhdGgsIChlLCBmaWxlcz8pID0+IHtcbiAgICAgIGlmIChlKSB7XG4gICAgICAgIGNiKGUpO1xuICAgICAgfSBlbHNlIGlmIChmaWxlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNiKEFwaUVycm9yLkVOT1RFTVBUWShwYXRoKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9yZW1vdmUocGF0aCwgY2IsIGZhbHNlKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyBta2RpcihwYXRoOiBzdHJpbmcsIG1vZGU6IG51bWJlciwgY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkIHtcbiAgICAvLyBDcmVhdGUgdGhlIGRpcmVjdG9yeSwgYnV0IHRocm93IGFuIGVycm9yIGlmIGl0IGFscmVhZHkgZXhpc3RzLCBhcyBwZXJcbiAgICAvLyBta2RpcigxKVxuICAgIHZhciBvcHRzID0ge1xuICAgICAgY3JlYXRlOiB0cnVlLFxuICAgICAgZXhjbHVzaXZlOiB0cnVlXG4gICAgfTtcbiAgICB2YXIgc3VjY2VzcyA9IChkaXI6IERpcmVjdG9yeUVudHJ5KTogdm9pZCA9PiB7XG4gICAgICBjYigpO1xuICAgIH07XG4gICAgdmFyIGVycm9yID0gKGVycjogRE9NRXhjZXB0aW9uKTogdm9pZCA9PiB7XG4gICAgICBjYih0aGlzLmNvbnZlcnQoZXJyLCBwYXRoLCB0cnVlKSk7XG4gICAgfTtcbiAgICB0aGlzLmZzLnJvb3QuZ2V0RGlyZWN0b3J5KHBhdGgsIG9wdHMsIHN1Y2Nlc3MsIGVycm9yKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGFuIGFycmF5IG9mIGBGaWxlRW50cnlgcy4gVXNlZCBpbnRlcm5hbGx5IGJ5IGVtcHR5IGFuZCByZWFkZGlyLlxuICAgKi9cbiAgcHJpdmF0ZSBfcmVhZGRpcihwYXRoOiBzdHJpbmcsIGNiOiAoZTogQXBpRXJyb3IsIGVudHJpZXM/OiBFbnRyeVtdKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdmFyIGVycm9yID0gKGVycjogRE9NRXhjZXB0aW9uKTogdm9pZCA9PiB7XG4gICAgICBjYih0aGlzLmNvbnZlcnQoZXJyLCBwYXRoLCB0cnVlKSk7XG4gICAgfTtcbiAgICAvLyBHcmFiIHRoZSByZXF1ZXN0ZWQgZGlyZWN0b3J5LlxuICAgIHRoaXMuZnMucm9vdC5nZXREaXJlY3RvcnkocGF0aCwgeyBjcmVhdGU6IGZhbHNlIH0sIChkaXJFbnRyeTogRGlyZWN0b3J5RW50cnkpID0+IHtcbiAgICAgIHZhciByZWFkZXIgPSBkaXJFbnRyeS5jcmVhdGVSZWFkZXIoKTtcbiAgICAgIHZhciBlbnRyaWVzOiBFbnRyeVtdID0gW107XG5cbiAgICAgIC8vIENhbGwgdGhlIHJlYWRlci5yZWFkRW50cmllcygpIHVudGlsIG5vIG1vcmUgcmVzdWx0cyBhcmUgcmV0dXJuZWQuXG4gICAgICB2YXIgcmVhZEVudHJpZXMgPSAoKSA9PiB7XG4gICAgICAgIHJlYWRlci5yZWFkRW50cmllcygoKHJlc3VsdHMpID0+IHtcbiAgICAgICAgICBpZiAocmVzdWx0cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGVudHJpZXMgPSBlbnRyaWVzLmNvbmNhdChfdG9BcnJheShyZXN1bHRzKSk7XG4gICAgICAgICAgICByZWFkRW50cmllcygpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYihudWxsLCBlbnRyaWVzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pLCBlcnJvcik7XG4gICAgICB9O1xuICAgICAgcmVhZEVudHJpZXMoKTtcbiAgICB9LCBlcnJvcik7XG4gIH1cblxuICAvKipcbiAgICogTWFwIF9yZWFkZGlyJ3MgbGlzdCBvZiBgRmlsZUVudHJ5YHMgdG8gdGhlaXIgbmFtZXMgYW5kIHJldHVybiB0aGF0LlxuICAgKi9cbiAgcHVibGljIHJlYWRkaXIocGF0aDogc3RyaW5nLCBjYjogKGVycjogQXBpRXJyb3IsIGZpbGVzPzogc3RyaW5nW10pID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLl9yZWFkZGlyKHBhdGgsIChlOiBBcGlFcnJvciwgZW50cmllcz86IEVudHJ5W10pOiB2b2lkID0+IHtcbiAgICAgIGlmIChlKSB7XG4gICAgICAgIHJldHVybiBjYihlKTtcbiAgICAgIH1cbiAgICAgIHZhciBydjogc3RyaW5nW10gPSBbXTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZW50cmllcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBydi5wdXNoKGVudHJpZXNbaV0ubmFtZSk7XG4gICAgICB9XG4gICAgICBjYihudWxsLCBydik7XG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==