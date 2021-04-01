"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var preload_file = require('../generic/preload_file');
var file_system = require('../core/file_system');
var node_fs_stats_1 = require('../core/node_fs_stats');
var api_error_1 = require('../core/api_error');
var async = require('async');
var path = require('path');
var util_1 = require('../core/util');
var errorCodeLookup = null;
function constructErrorCodeLookup() {
    if (errorCodeLookup !== null) {
        return;
    }
    errorCodeLookup = {};
    errorCodeLookup[Dropbox.ApiError.NETWORK_ERROR] = api_error_1.ErrorCode.EIO;
    errorCodeLookup[Dropbox.ApiError.INVALID_PARAM] = api_error_1.ErrorCode.EINVAL;
    errorCodeLookup[Dropbox.ApiError.INVALID_TOKEN] = api_error_1.ErrorCode.EPERM;
    errorCodeLookup[Dropbox.ApiError.OAUTH_ERROR] = api_error_1.ErrorCode.EPERM;
    errorCodeLookup[Dropbox.ApiError.NOT_FOUND] = api_error_1.ErrorCode.ENOENT;
    errorCodeLookup[Dropbox.ApiError.INVALID_METHOD] = api_error_1.ErrorCode.EINVAL;
    errorCodeLookup[Dropbox.ApiError.NOT_ACCEPTABLE] = api_error_1.ErrorCode.EINVAL;
    errorCodeLookup[Dropbox.ApiError.CONFLICT] = api_error_1.ErrorCode.EINVAL;
    errorCodeLookup[Dropbox.ApiError.RATE_LIMITED] = api_error_1.ErrorCode.EBUSY;
    errorCodeLookup[Dropbox.ApiError.SERVER_ERROR] = api_error_1.ErrorCode.EBUSY;
    errorCodeLookup[Dropbox.ApiError.OVER_QUOTA] = api_error_1.ErrorCode.ENOSPC;
}
function isFileInfo(cache) {
    return cache && cache.stat.isFile;
}
function isDirInfo(cache) {
    return cache && cache.stat.isFolder;
}
function isArrayBuffer(ab) {
    return ab === null || ab === undefined || (typeof (ab) === 'object' && typeof (ab['byteLength']) === 'number');
}
var CachedDropboxClient = (function () {
    function CachedDropboxClient(client) {
        this._cache = {};
        this._client = client;
    }
    CachedDropboxClient.prototype.getCachedInfo = function (p) {
        return this._cache[p.toLowerCase()];
    };
    CachedDropboxClient.prototype.putCachedInfo = function (p, cache) {
        this._cache[p.toLowerCase()] = cache;
    };
    CachedDropboxClient.prototype.deleteCachedInfo = function (p) {
        delete this._cache[p.toLowerCase()];
    };
    CachedDropboxClient.prototype.getCachedDirInfo = function (p) {
        var info = this.getCachedInfo(p);
        if (isDirInfo(info)) {
            return info;
        }
        else {
            return null;
        }
    };
    CachedDropboxClient.prototype.getCachedFileInfo = function (p) {
        var info = this.getCachedInfo(p);
        if (isFileInfo(info)) {
            return info;
        }
        else {
            return null;
        }
    };
    CachedDropboxClient.prototype.updateCachedDirInfo = function (p, stat, contents) {
        if (contents === void 0) { contents = null; }
        var cachedInfo = this.getCachedInfo(p);
        if (stat.contentHash !== null && (cachedInfo === undefined || cachedInfo.stat.contentHash !== stat.contentHash)) {
            this.putCachedInfo(p, {
                stat: stat,
                contents: contents
            });
        }
    };
    CachedDropboxClient.prototype.updateCachedFileInfo = function (p, stat, contents) {
        if (contents === void 0) { contents = null; }
        var cachedInfo = this.getCachedInfo(p);
        if (stat.versionTag !== null && (cachedInfo === undefined || cachedInfo.stat.versionTag !== stat.versionTag)) {
            this.putCachedInfo(p, {
                stat: stat,
                contents: contents
            });
        }
    };
    CachedDropboxClient.prototype.updateCachedInfo = function (p, stat, contents) {
        if (contents === void 0) { contents = null; }
        if (stat.isFile && isArrayBuffer(contents)) {
            this.updateCachedFileInfo(p, stat, contents);
        }
        else if (stat.isFolder && Array.isArray(contents)) {
            this.updateCachedDirInfo(p, stat, contents);
        }
    };
    CachedDropboxClient.prototype.readdir = function (p, cb) {
        var _this = this;
        var cacheInfo = this.getCachedDirInfo(p);
        this._wrap(function (interceptCb) {
            if (cacheInfo !== null && cacheInfo.contents) {
                _this._client.readdir(p, {
                    contentHash: cacheInfo.stat.contentHash
                }, interceptCb);
            }
            else {
                _this._client.readdir(p, interceptCb);
            }
        }, function (err, filenames, stat, folderEntries) {
            if (err) {
                if (err.status === Dropbox.ApiError.NO_CONTENT && cacheInfo !== null) {
                    cb(null, cacheInfo.contents.slice(0));
                }
                else {
                    cb(err);
                }
            }
            else {
                _this.updateCachedDirInfo(p, stat, filenames.slice(0));
                folderEntries.forEach(function (entry) {
                    _this.updateCachedInfo(path.join(p, entry.name), entry);
                });
                cb(null, filenames);
            }
        });
    };
    CachedDropboxClient.prototype.remove = function (p, cb) {
        var _this = this;
        this._wrap(function (interceptCb) {
            _this._client.remove(p, interceptCb);
        }, function (err, stat) {
            if (!err) {
                _this.updateCachedInfo(p, stat);
            }
            cb(err);
        });
    };
    CachedDropboxClient.prototype.move = function (src, dest, cb) {
        var _this = this;
        this._wrap(function (interceptCb) {
            _this._client.move(src, dest, interceptCb);
        }, function (err, stat) {
            if (!err) {
                _this.deleteCachedInfo(src);
                _this.updateCachedInfo(dest, stat);
            }
            cb(err);
        });
    };
    CachedDropboxClient.prototype.stat = function (p, cb) {
        var _this = this;
        this._wrap(function (interceptCb) {
            _this._client.stat(p, interceptCb);
        }, function (err, stat) {
            if (!err) {
                _this.updateCachedInfo(p, stat);
            }
            cb(err, stat);
        });
    };
    CachedDropboxClient.prototype.readFile = function (p, cb) {
        var _this = this;
        var cacheInfo = this.getCachedFileInfo(p);
        if (cacheInfo !== null && cacheInfo.contents !== null) {
            this.stat(p, function (error, stat) {
                if (error) {
                    cb(error);
                }
                else if (stat.contentHash === cacheInfo.stat.contentHash) {
                    cb(error, cacheInfo.contents.slice(0), cacheInfo.stat);
                }
                else {
                    _this.readFile(p, cb);
                }
            });
        }
        else {
            this._wrap(function (interceptCb) {
                _this._client.readFile(p, { arrayBuffer: true }, interceptCb);
            }, function (err, contents, stat) {
                if (!err) {
                    _this.updateCachedInfo(p, stat, contents.slice(0));
                }
                cb(err, contents, stat);
            });
        }
    };
    CachedDropboxClient.prototype.writeFile = function (p, contents, cb) {
        var _this = this;
        this._wrap(function (interceptCb) {
            _this._client.writeFile(p, contents, interceptCb);
        }, function (err, stat) {
            if (!err) {
                _this.updateCachedInfo(p, stat, contents.slice(0));
            }
            cb(err, stat);
        });
    };
    CachedDropboxClient.prototype.mkdir = function (p, cb) {
        var _this = this;
        this._wrap(function (interceptCb) {
            _this._client.mkdir(p, interceptCb);
        }, function (err, stat) {
            if (!err) {
                _this.updateCachedInfo(p, stat, []);
            }
            cb(err);
        });
    };
    CachedDropboxClient.prototype._wrap = function (performOp, cb) {
        var numRun = 0, interceptCb = function (error) {
            var timeoutDuration = 2;
            if (error && 3 > (++numRun)) {
                switch (error.status) {
                    case Dropbox.ApiError.SERVER_ERROR:
                    case Dropbox.ApiError.NETWORK_ERROR:
                    case Dropbox.ApiError.RATE_LIMITED:
                        setTimeout(function () {
                            performOp(interceptCb);
                        }, timeoutDuration * 1000);
                        break;
                    default:
                        cb.apply(null, arguments);
                        break;
                }
            }
            else {
                cb.apply(null, arguments);
            }
        };
        performOp(interceptCb);
    };
    return CachedDropboxClient;
}());
var DropboxFile = (function (_super) {
    __extends(DropboxFile, _super);
    function DropboxFile(_fs, _path, _flag, _stat, contents) {
        _super.call(this, _fs, _path, _flag, _stat, contents);
    }
    DropboxFile.prototype.sync = function (cb) {
        var _this = this;
        if (this.isDirty()) {
            var buffer = this.getBuffer(), arrayBuffer = util_1.buffer2ArrayBuffer(buffer);
            this._fs._writeFileStrict(this.getPath(), arrayBuffer, function (e) {
                if (!e) {
                    _this.resetDirty();
                }
                cb(e);
            });
        }
        else {
            cb();
        }
    };
    DropboxFile.prototype.close = function (cb) {
        this.sync(cb);
    };
    return DropboxFile;
}(preload_file.PreloadFile));
exports.DropboxFile = DropboxFile;
var DropboxFileSystem = (function (_super) {
    __extends(DropboxFileSystem, _super);
    function DropboxFileSystem(client) {
        _super.call(this);
        this._client = new CachedDropboxClient(client);
        constructErrorCodeLookup();
    }
    DropboxFileSystem.prototype.getName = function () {
        return 'Dropbox';
    };
    DropboxFileSystem.isAvailable = function () {
        return typeof Dropbox !== 'undefined';
    };
    DropboxFileSystem.prototype.isReadOnly = function () {
        return false;
    };
    DropboxFileSystem.prototype.supportsSymlinks = function () {
        return false;
    };
    DropboxFileSystem.prototype.supportsProps = function () {
        return false;
    };
    DropboxFileSystem.prototype.supportsSynch = function () {
        return false;
    };
    DropboxFileSystem.prototype.empty = function (mainCb) {
        var _this = this;
        this._client.readdir('/', function (error, files) {
            if (error) {
                mainCb(_this.convert(error, '/'));
            }
            else {
                var deleteFile = function (file, cb) {
                    var p = path.join('/', file);
                    _this._client.remove(p, function (err) {
                        cb(err ? _this.convert(err, p) : null);
                    });
                };
                var finished = function (err) {
                    if (err) {
                        mainCb(err);
                    }
                    else {
                        mainCb();
                    }
                };
                async.each(files, deleteFile, finished);
            }
        });
    };
    DropboxFileSystem.prototype.rename = function (oldPath, newPath, cb) {
        var _this = this;
        this._client.move(oldPath, newPath, function (error) {
            if (error) {
                _this._client.stat(newPath, function (error2, stat) {
                    if (error2 || stat.isFolder) {
                        var missingPath = error.response.error.indexOf(oldPath) > -1 ? oldPath : newPath;
                        cb(_this.convert(error, missingPath));
                    }
                    else {
                        _this._client.remove(newPath, function (error2) {
                            if (error2) {
                                cb(_this.convert(error2, newPath));
                            }
                            else {
                                _this.rename(oldPath, newPath, cb);
                            }
                        });
                    }
                });
            }
            else {
                cb();
            }
        });
    };
    DropboxFileSystem.prototype.stat = function (path, isLstat, cb) {
        var _this = this;
        this._client.stat(path, function (error, stat) {
            if (error) {
                cb(_this.convert(error, path));
            }
            else if ((stat != null) && stat.isRemoved) {
                cb(api_error_1.ApiError.FileError(api_error_1.ErrorCode.ENOENT, path));
            }
            else {
                var stats = new node_fs_stats_1["default"](_this._statType(stat), stat.size);
                return cb(null, stats);
            }
        });
    };
    DropboxFileSystem.prototype.open = function (path, flags, mode, cb) {
        var _this = this;
        this._client.readFile(path, function (error, content, dbStat) {
            if (error) {
                if (flags.isReadable()) {
                    cb(_this.convert(error, path));
                }
                else {
                    switch (error.status) {
                        case Dropbox.ApiError.NOT_FOUND:
                            var ab = new ArrayBuffer(0);
                            return _this._writeFileStrict(path, ab, function (error2, stat) {
                                if (error2) {
                                    cb(error2);
                                }
                                else {
                                    var file = _this._makeFile(path, flags, stat, util_1.arrayBuffer2Buffer(ab));
                                    cb(null, file);
                                }
                            });
                        default:
                            return cb(_this.convert(error, path));
                    }
                }
            }
            else {
                var buffer;
                if (content === null) {
                    buffer = new Buffer(0);
                }
                else {
                    buffer = util_1.arrayBuffer2Buffer(content);
                }
                var file = _this._makeFile(path, flags, dbStat, buffer);
                return cb(null, file);
            }
        });
    };
    DropboxFileSystem.prototype._writeFileStrict = function (p, data, cb) {
        var _this = this;
        var parent = path.dirname(p);
        this.stat(parent, false, function (error, stat) {
            if (error) {
                cb(api_error_1.ApiError.FileError(api_error_1.ErrorCode.ENOENT, parent));
            }
            else {
                _this._client.writeFile(p, data, function (error2, stat) {
                    if (error2) {
                        cb(_this.convert(error2, p));
                    }
                    else {
                        cb(null, stat);
                    }
                });
            }
        });
    };
    DropboxFileSystem.prototype._statType = function (stat) {
        return stat.isFile ? node_fs_stats_1.FileType.FILE : node_fs_stats_1.FileType.DIRECTORY;
    };
    DropboxFileSystem.prototype._makeFile = function (path, flag, stat, buffer) {
        var type = this._statType(stat);
        var stats = new node_fs_stats_1["default"](type, stat.size);
        return new DropboxFile(this, path, flag, stats, buffer);
    };
    DropboxFileSystem.prototype._remove = function (path, cb, isFile) {
        var _this = this;
        this._client.stat(path, function (error, stat) {
            if (error) {
                cb(_this.convert(error, path));
            }
            else {
                if (stat.isFile && !isFile) {
                    cb(api_error_1.ApiError.FileError(api_error_1.ErrorCode.ENOTDIR, path));
                }
                else if (!stat.isFile && isFile) {
                    cb(api_error_1.ApiError.FileError(api_error_1.ErrorCode.EISDIR, path));
                }
                else {
                    _this._client.remove(path, function (error) {
                        if (error) {
                            cb(_this.convert(error, path));
                        }
                        else {
                            cb(null);
                        }
                    });
                }
            }
        });
    };
    DropboxFileSystem.prototype.unlink = function (path, cb) {
        this._remove(path, cb, true);
    };
    DropboxFileSystem.prototype.rmdir = function (path, cb) {
        this._remove(path, cb, false);
    };
    DropboxFileSystem.prototype.mkdir = function (p, mode, cb) {
        var _this = this;
        var parent = path.dirname(p);
        this._client.stat(parent, function (error, stat) {
            if (error) {
                cb(_this.convert(error, parent));
            }
            else {
                _this._client.mkdir(p, function (error) {
                    if (error) {
                        cb(api_error_1.ApiError.FileError(api_error_1.ErrorCode.EEXIST, p));
                    }
                    else {
                        cb(null);
                    }
                });
            }
        });
    };
    DropboxFileSystem.prototype.readdir = function (path, cb) {
        var _this = this;
        this._client.readdir(path, function (error, files) {
            if (error) {
                return cb(_this.convert(error));
            }
            else {
                return cb(null, files);
            }
        });
    };
    DropboxFileSystem.prototype.convert = function (err, path) {
        if (path === void 0) { path = null; }
        var errorCode = errorCodeLookup[err.status];
        if (errorCode === undefined) {
            errorCode = api_error_1.ErrorCode.EIO;
        }
        if (path == null) {
            return new api_error_1.ApiError(errorCode);
        }
        else {
            return api_error_1.ApiError.FileError(errorCode, path);
        }
    };
    return DropboxFileSystem;
}(file_system.BaseFileSystem));
exports.__esModule = true;
exports["default"] = DropboxFileSystem;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRHJvcGJveC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9iYWNrZW5kL0Ryb3Bib3gudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsSUFBTyxZQUFZLFdBQVcseUJBQXlCLENBQUMsQ0FBQztBQUN6RCxJQUFPLFdBQVcsV0FBVyxxQkFBcUIsQ0FBQyxDQUFDO0FBRXBELDhCQUF5Qyx1QkFBdUIsQ0FBQyxDQUFBO0FBQ2pFLDBCQUFrQyxtQkFBbUIsQ0FBQyxDQUFBO0FBRXRELElBQU8sS0FBSyxXQUFXLE9BQU8sQ0FBQyxDQUFDO0FBQ2hDLElBQU8sSUFBSSxXQUFXLE1BQU0sQ0FBQyxDQUFDO0FBQzlCLHFCQUFxRCxjQUFjLENBQUMsQ0FBQTtBQUVwRSxJQUFJLGVBQWUsR0FBNEMsSUFBSSxDQUFDO0FBRXBFO0lBQ0UsRUFBRSxDQUFDLENBQUMsZUFBZSxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDN0IsTUFBTSxDQUFDO0lBQ1QsQ0FBQztJQUNELGVBQWUsR0FBRyxFQUFFLENBQUM7SUFFckIsZUFBZSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLEdBQUcscUJBQVMsQ0FBQyxHQUFHLENBQUM7SUFJaEUsZUFBZSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLEdBQUcscUJBQVMsQ0FBQyxNQUFNLENBQUM7SUFFbkUsZUFBZSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLEdBQUcscUJBQVMsQ0FBQyxLQUFLLENBQUM7SUFHbEUsZUFBZSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLEdBQUcscUJBQVMsQ0FBQyxLQUFLLENBQUM7SUFFaEUsZUFBZSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLEdBQUcscUJBQVMsQ0FBQyxNQUFNLENBQUM7SUFFL0QsZUFBZSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsY0FBYyxD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Q0FBQyxTQUFTLENBQUMsQ0FBQztRQUNqQyxDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDTixNQUFNLENBQUMsb0JBQVEsQ0FBQyxTQUFTLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQzdDLENBQUM7SUFDSCxDQUFDO0lBQ0gsd0JBQUM7QUFBRCxDQUFDLEFBM1JELENBQStDLFdBQVcsQ0FBQyxjQUFjLEdBMlJ4RTtBQTNSRDtzQ0EyUkMsQ0FBQSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBwcmVsb2FkX2ZpbGUgPSByZXF1aXJlKCcuLi9nZW5lcmljL3ByZWxvYWRfZmlsZScpO1xuaW1wb3J0IGZpbGVfc3lzdGVtID0gcmVxdWlyZSgnLi4vY29yZS9maWxlX3N5c3RlbScpO1xuaW1wb3J0IGZpbGVfZmxhZyA9IHJlcXVpcmUoJy4uL2NvcmUvZmlsZV9mbGFnJyk7XG5pbXBvcnQge2RlZmF1bHQgYXMgU3RhdHMsIEZpbGVUeXBlfSBmcm9tICcuLi9jb3JlL25vZGVfZnNfc3RhdHMnO1xuaW1wb3J0IHtBcGlFcnJvciwgRXJyb3JDb2RlfSBmcm9tICcuLi9jb3JlL2FwaV9lcnJvcic7XG5pbXBvcnQgZmlsZSA9IHJlcXVpcmUoJy4uL2NvcmUvZmlsZScpO1xuaW1wb3J0IGFzeW5jID0gcmVxdWlyZSgnYXN5bmMnKTtcbmltcG9ydCBwYXRoID0gcmVxdWlyZSgncGF0aCcpO1xuaW1wb3J0IHthcnJheUJ1ZmZlcjJCdWZmZXIsIGJ1ZmZlcjJBcnJheUJ1ZmZlcn0gZnJvbSAnLi4vY29yZS91dGlsJztcblxudmFyIGVycm9yQ29kZUxvb2t1cDoge1tkcm9wYm94RXJyb3JDb2RlOiBudW1iZXJdOiBFcnJvckNvZGV9ID0gbnVsbDtcbi8vIExhemlseSBjb25zdHJ1Y3QgZXJyb3IgY29kZSBsb29rdXAsIHNpbmNlIERyb3Bib3hKUyBtaWdodCBiZSBsb2FkZWQgKmFmdGVyKiBCcm93c2VyRlMgKG9yIG5vdCBhdCBhbGwhKVxuZnVuY3Rpb24gY29uc3RydWN0RXJyb3JDb2RlTG9va3VwKCkge1xuICBpZiAoZXJyb3JDb2RlTG9va3VwICE9PSBudWxsKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGVycm9yQ29kZUxvb2t1cCA9IHt9O1xuICAvLyBUaGlzIGluZGljYXRlcyBhIG5ldHdvcmsgdHJhbnNtaXNzaW9uIGVycm9yIG9uIG1vZGVybiBicm93c2Vycy4gSW50ZXJuZXQgRXhwbG9yZXIgbWlnaHQgY2F1c2UgdGhpcyBjb2RlIHRvIGJlIHJlcG9ydGVkIG9uIHNvbWUgQVBJIHNlcnZlciBlcnJvcnMuXG4gIGVycm9yQ29kZUxvb2t1cFtEcm9wYm94LkFwaUVycm9yLk5FVFdPUktfRVJST1JdID0gRXJyb3JDb2RlLkVJTztcbiAgLy8gVGhpcyBoYXBwZW5zIHdoZW4gdGhlIGNvbnRlbnRIYXNoIHBhcmFtZXRlciBwYXNzZWQgdG8gYSBEcm9wYm94LkNsaWVudCNyZWFkZGlyIG9yIERyb3Bib3guQ2xpZW50I3N0YXQgbWF0Y2hlcyB0aGUgbW9zdCByZWNlbnQgY29udGVudCwgc28gdGhlIEFQSSBjYWxsIHJlc3BvbnNlIGlzIG9taXR0ZWQsIHRvIHNhdmUgYmFuZHdpZHRoLlxuICAvLyBlcnJvckNvZGVMb29rdXBbRHJvcGJveC5BcGlFcnJvci5OT19DT05URU5UXTtcbiAgLy8gVGhlIGVycm9yIHByb3BlcnR5IG9uIHtEcm9wYm94LkFwaUVycm9yI3Jlc3BvbnNlfSBzaG91bGQgaW5kaWNhdGUgd2hpY2ggaW5wdXQgcGFyYW1ldGVyIGlzIGludmFsaWQgYW5kIHdoeS5cbiAgZXJyb3JDb2RlTG9va3VwW0Ryb3Bib3guQXBpRXJyb3IuSU5WQUxJRF9QQVJBTV0gPSBFcnJvckNvZGUuRUlOVkFMO1xuICAvLyBUaGUgT0F1dGggdG9rZW4gdXNlZCBmb3IgdGhlIHJlcXVlc3Qgd2lsbCBuZXZlciBiZWNvbWUgdmFsaWQgYWdhaW4sIHNvIHRoZSB1c2VyIHNob3VsZCBiZSByZS1hdXRoZW50aWNhdGVkLlxuICBlcnJvckNvZGVMb29rdXBbRHJvcGJveC5BcGlFcnJvci5JTlZBTElEX1RPS0VOXSA9IEVycm9yQ29kZS5FUEVSTTtcbiAgLy8gVGhpcyBpbmRpY2F0ZXMgYSBidWcgaW4gZHJvcGJveC5qcyBhbmQgc2hvdWxkIG5ldmVyIG9jY3VyIHVuZGVyIG5vcm1hbCBjaXJjdW1zdGFuY2VzLlxuICAvLyBeIEFjdHVhbGx5LCB0aGF0J3MgZmFsc2UuIFRoaXMgb2NjdXJzIHdoZW4geW91IHRyeSB0byBtb3ZlIGZvbGRlcnMgdG8gdGhlbXNlbHZlcywgb3IgbW92ZSBhIGZpbGUgb3ZlciBhbm90aGVyIGZpbGUuXG4gIGVycm9yQ29kZUxvb2t1cFtEcm9wYm94LkFwaUVycm9yLk9BVVRIX0VSUk9SXSA9IEVycm9yQ29kZS5FUEVSTTtcbiAgLy8gVGhpcyBoYXBwZW5zIHdoZW4gdHJ5aW5nIHRvIHJlYWQgZnJvbSBhIG5vbi1leGlzdGluZyBmaWxlLCByZWFkZGlyIGEgbm9uLWV4aXN0aW5nIGRpcmVjdG9yeSwgd3JpdGUgYSBmaWxlIGludG8gYSBub24tZXhpc3RpbmcgZGlyZWN0b3J5LCBldGMuXG4gIGVycm9yQ29kZUxvb2t1cFtEcm9wYm94LkFwaUVycm9yLk5PVF9GT1VORF0gPSBFcnJvckNvZGUuRU5PRU5UO1xuICAvLyBUaGlzIGluZGljYXRlcyBhIGJ1ZyBpbiBkcm9wYm94LmpzIGFuZCBzaG91bGQgbmV2ZXIgb2NjdXIgdW5kZXIgbm9ybWFsIGNpcmN1bXN0YW5jZXMuXG4gIGVycm9yQ29kZUxvb2t1cFtEcm9wYm94LkFwaUVycm9yLklOVkFMSURfTUVUSE9EXSA9IEVycm9yQ29kZS5FSU5WQUw7XG4gIC8vIFRoaXMgaGFwcGVucyB3aGVuIGEgRHJvcGJveC5DbGllbnQjcmVhZGRpciBvciBEcm9wYm94LkNsaWVudCNzdGF0IGNhbGwgd291bGQgcmV0dXJuIG1vcmUgdGhhbiBhIG1heGltdW0gYW1vdW50IG9mIGRpcmVjdG9yeSBlbnRyaWVzLlxuICBlcnJvckNvZGVMb29rdXBbRHJvcGJveC5BcGlFcnJvci5OT1RfQUNDRVBUQUJMRV0gPSBFcnJvckNvZGUuRUlOVkFMO1xuICAvLyBUaGlzIGlzIHVzZWQgYnkgc29tZSBiYWNrZW5kIG1ldGhvZHMgdG8gaW5kaWNhdGUgdGhhdCB0aGUgY2xpZW50IG5lZWRzIHRvIGRvd25sb2FkIHNlcnZlci1zaWRlIGNoYW5nZXMgYW5kIHBlcmZvcm0gY29uZmxpY3QgcmVzb2x1dGlvbi4gVW5kZXIgbm9ybWFsIHVzYWdlLCBlcnJvcnMgd2l0aCB0aGlzIGNvZGUgc2hvdWxkIG5ldmVyIHN1cmZhY2UgdG8gdGhlIGNvZGUgdXNpbmcgZHJvcGJveC5qcy5cbiAgZXJyb3JDb2RlTG9va3VwW0Ryb3Bib3guQXBpRXJyb3IuQ09ORkxJQ1RdID0gRXJyb3JDb2RlLkVJTlZBTDtcbiAgLy8gU3RhdHVzIHZhbHVlIGluZGljYXRpbmcgdGhhdCB0aGUgYXBwbGljYXRpb24gaXMgbWFraW5nIHRvbyBtYW55IHJlcXVlc3RzLlxuICBlcnJvckNvZGVMb29rdXBbRHJvcGJveC5BcGlFcnJvci5SQVRFX0xJTUlURURdID0gRXJyb3JDb2RlLkVCVVNZO1xuICAvLyBUaGUgcmVxdWVzdCBzaG91bGQgYmUgcmV0cmllZCBhZnRlciBzb21lIHRpbWUuXG4gIGVycm9yQ29kZUxvb2t1cFtEcm9wYm94LkFwaUVycm9yLlNFUlZFUl9FUlJPUl0gPSBFcnJvckNvZGUuRUJVU1k7XG4gIC8vIFN0YXR1cyB2YWx1ZSBpbmRpY2F0aW5nIHRoYXQgdGhlIHVzZXIncyBEcm9wYm94IGlzIG92ZXIgaXRzIHN0b3JhZ2UgcXVvdGEuXG4gIGVycm9yQ29kZUxvb2t1cFtEcm9wYm94LkFwaUVycm9yLk9WRVJfUVVPVEFdID0gRXJyb3JDb2RlLkVOT1NQQztcbn1cblxuaW50ZXJmYWNlIElDYWNoZWRQYXRoSW5mbyB7XG4gIHN0YXQ6IERyb3Bib3guRmlsZS5TdGF0O1xufVxuXG5pbnRlcmZhY2UgSUNhY2hlZEZpbGVJbmZvIGV4dGVuZHMgSUNhY2hlZFBhdGhJbmZvIHtcbiAgY29udGVudHM6IEFycmF5QnVmZmVyO1xufVxuXG5mdW5jdGlvbiBpc0ZpbGVJbmZvKGNhY2hlOiBJQ2FjaGVkUGF0aEluZm8pOiBjYWNoZSBpcyBJQ2FjaGVkRmlsZUluZm8ge1xuICByZXR1cm4gY2FjaGUgJiYgY2FjaGUuc3RhdC5pc0ZpbGU7XG59XG5cbmludGVyZmFjZSBJQ2FjaGVkRGlySW5mbyBleHRlbmRzIElDYWNoZWRQYXRoSW5mbyB7XG4gIGNvbnRlbnRzOiBzdHJpbmdbXTtcbn1cblxuZnVuY3Rpb24gaXNEaXJJbmZvKGNhY2hlOiBJQ2FjaGVkUGF0aEluZm8pOiBjYWNoZSBpcyBJQ2FjaGVkRGlySW5mbyB7XG4gIHJldHVybiBjYWNoZSAmJiBjYWNoZS5zdGF0LmlzRm9sZGVyO1xufVxuXG5mdW5jdGlvbiBpc0FycmF5QnVmZmVyKGFiOiBhbnkpOiBhYiBpcyBBcnJheUJ1ZmZlciB7XG4gIC8vIEFjY2VwdCBudWxsIC8gdW5kZWZpbmVkLCB0b28uXG4gIHJldHVybiBhYiA9PT0gbnVsbCB8fCBhYiA9PT0gdW5kZWZpbmVkIHx8ICh0eXBlb2YoYWIpID09PSAnb2JqZWN0JyAmJiB0eXBlb2YoYWJbJ2J5dGVMZW5ndGgnXSkgPT09ICdudW1iZXInKTtcbn1cblxuLyoqXG4gKiBXcmFwcyBhIERyb3Bib3ggY2xpZW50IGFuZCBjYWNoZXMgb3BlcmF0aW9ucy5cbiAqL1xuY2xhc3MgQ2FjaGVkRHJvcGJveENsaWVudCB7XG4gIHByaXZhdGUgX2NhY2hlOiB7W3BhdGg6IHN0cmluZ106IElDYWNoZWRQYXRoSW5mb30gPSB7fTtcbiAgcHJpdmF0ZSBfY2xpZW50OiBEcm9wYm94LkNsaWVudDtcblxuICBjb25zdHJ1Y3RvcihjbGllbnQ6IERyb3Bib3guQ2xpZW50KSB7XG4gICAgdGhpcy5fY2xpZW50ID0gY2xpZW50O1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRDYWNoZWRJbmZvKHA6IHN0cmluZyk6IElDYWNoZWRQYXRoSW5mbyB7XG4gICAgcmV0dXJuIHRoaXMuX2NhY2hlW3AudG9Mb3dlckNhc2UoKV07XG4gIH1cblxuICBwcml2YXRlIHB1dENhY2hlZEluZm8ocDogc3RyaW5nLCBjYWNoZTogSUNhY2hlZFBhdGhJbmZvKTogdm9pZCB7XG4gICAgdGhpcy5fY2FjaGVbcC50b0xvd2VyQ2FzZSgpXSA9IGNhY2hlO1xuICB9XG5cbiAgcHJpdmF0ZSBkZWxldGVDYWNoZWRJbmZvKHA6IHN0cmluZyk6IHZvaWQge1xuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZVtwLnRvTG93ZXJDYXNlKCldO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRDYWNoZWREaXJJbmZvKHA6IHN0cmluZyk6IElDYWNoZWREaXJJbmZvIHtcbiAgICB2YXIgaW5mbyA9IHRoaXMuZ2V0Q2FjaGVkSW5mbyhwKTtcbiAgICBpZiAoaXNEaXJJbmZvKGluZm8pKSB7XG4gICAgICByZXR1cm4gaW5mbztcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBnZXRDYWNoZWRGaWxlSW5mbyhwOiBzdHJpbmcpOiBJQ2FjaGVkRmlsZUluZm8ge1xuICAgIHZhciBpbmZvID0gdGhpcy5nZXRDYWNoZWRJbmZvKHApO1xuICAgIGlmIChpc0ZpbGVJbmZvKGluZm8pKSB7XG4gICAgICByZXR1cm4gaW5mbztcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVDYWNoZWREaXJJbmZvKHA6IHN0cmluZywgc3RhdDogRHJvcGJveC5GaWxlLlN0YXQsIGNvbnRlbnRzOiBzdHJpbmdbXSA9IG51bGwpOiB2b2lkIHtcbiAgICB2YXIgY2FjaGVkSW5mbyA9IHRoaXMuZ2V0Q2FjaGVkSW5mbyhwKTtcbiAgICAvLyBEcm9wYm94IHVzZXMgdGhlICpjb250ZW50SGFzaCogcHJvcGVydHkgZm9yIGRpcmVjdG9yaWVzLlxuICAgIC8vIElnbm9yZSBzdGF0IG9iamVjdHMgdy9vIGEgY29udGVudEhhc2ggZGVmaW5lZDsgdGhvc2UgYWN0dWFsbHkgZXhpc3QhISFcbiAgICAvLyAoRXhhbXBsZTogcmVhZGRpciByZXR1cm5zIGFuIGFycmF5IG9mIHN0YXQgb2Jqczsgc3RhdCBvYmpzIGZvciBkaXJzIGluIHRoYXQgY29udGV4dCBoYXZlIG5vIGNvbnRlbnRIYXNoKVxuICAgIGlmIChzdGF0LmNvbnRlbnRIYXNoICE9PSBudWxsICYmIChjYWNoZWRJbmZvID09PSB1bmRlZmluZWQgfHwgY2FjaGVkSW5mby5zdGF0LmNvbnRlbnRIYXNoICE9PSBzdGF0LmNvbnRlbnRIYXNoKSkge1xuICAgICAgdGhpcy5wdXRDYWNoZWRJbmZvKHAsIDxJQ2FjaGVkRGlySW5mbz4ge1xuICAgICAgICBzdGF0OiBzdGF0LFxuICAgICAgICBjb250ZW50czogY29udGVudHNcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgdXBkYXRlQ2FjaGVkRmlsZUluZm8ocDogc3RyaW5nLCBzdGF0OiBEcm9wYm94LkZpbGUuU3RhdCwgY29udGVudHM6IEFycmF5QnVmZmVyID0gbnVsbCk6IHZvaWQge1xuICAgIHZhciBjYWNoZWRJbmZvID0gdGhpcy5nZXRDYWNoZWRJbmZvKHApO1xuICAgIC8vIERyb3Bib3ggdXNlcyB0aGUgKnZlcnNpb25UYWcqIHByb3BlcnR5IGZvciBmaWxlcy5cbiAgICAvLyBJZ25vcmUgc3RhdCBvYmplY3RzIHcvbyBhIHZlcnNpb25UYWcgZGVmaW5lZC5cbiAgICBpZiAoc3RhdC52ZXJzaW9uVGFnICE9PSBudWxsICYmIChjYWNoZWRJbmZvID09PSB1bmRlZmluZWQgfHwgY2FjaGVkSW5mby5zdGF0LnZlcnNpb25UYWcgIT09IHN0YXQudmVyc2lvblRhZykpIHtcbiAgICAgIHRoaXMucHV0Q2FjaGVkSW5mbyhwLCA8SUNhY2hlZEZpbGVJbmZvPiB7XG4gICAgICAgIHN0YXQ6IHN0YXQsXG4gICAgICAgIGNvbnRlbnRzOiBjb250ZW50c1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVDYWNoZWRJbmZvKHA6IHN0cmluZywgc3RhdDogRHJvcGJveC5GaWxlLlN0YXQsIGNvbnRlbnRzOiBBcnJheUJ1ZmZlciB8IHN0cmluZ1tdID0gbnVsbCk6IHZvaWQge1xuICAgIGlmIChzdGF0LmlzRmlsZSAmJiBpc0FycmF5QnVmZmVyKGNvbnRlbnRzKSkge1xuICAgICAgdGhpcy51cGRhdGVDYWNoZWRGaWxlSW5mbyhwLCBzdGF0LCBjb250ZW50cyk7XG4gICAgfSBlbHNlIGlmIChzdGF0LmlzRm9sZGVyICYmIEFycmF5LmlzQXJyYXkoY29udGVudHMpKSB7XG4gICAgICB0aGlzLnVwZGF0ZUNhY2hlZERpckluZm8ocCwgc3RhdCwgY29udGVudHMpO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyByZWFkZGlyKHA6IHN0cmluZywgY2I6IChlcnJvcjogRHJvcGJveC5BcGlFcnJvciwgY29udGVudHM/OiBzdHJpbmdbXSkgPT4gdm9pZCk6IHZvaWQge1xuICAgIHZhciBjYWNoZUluZm8gPSB0aGlzLmdldENhY2hlZERpckluZm8ocCk7XG5cbiAgICB0aGlzLl93cmFwKChpbnRlcmNlcHRDYikgPT4ge1xuICAgICAgaWYgKGNhY2hlSW5mbyAhPT0gbnVsbCAmJiBjYWNoZUluZm8uY29udGVudHMpIHtcbiAgICAgICAgdGhpcy5fY2xpZW50LnJlYWRkaXIocCwge1xuICAgICAgICAgIGNvbnRlbnRIYXNoOiBjYWNoZUluZm8uc3RhdC5jb250ZW50SGFzaFxuICAgICAgICB9LCBpbnRlcmNlcHRDYik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9jbGllbnQucmVhZGRpcihwLCBpbnRlcmNlcHRDYik7XG4gICAgICB9XG4gICAgfSwgKGVycjogRHJvcGJveC5BcGlFcnJvciwgZmlsZW5hbWVzOiBzdHJpbmdbXSwgc3RhdDogRHJvcGJveC5GaWxlLlN0YXQsIGZvbGRlckVudHJpZXM6IERyb3Bib3guRmlsZS5TdGF0W10pID0+IHtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgaWYgKGVyci5zdGF0dXMgPT09IERyb3Bib3guQXBpRXJyb3IuTk9fQ09OVEVOVCAmJiBjYWNoZUluZm8gIT09IG51bGwpIHtcbiAgICAgICAgICBjYihudWxsLCBjYWNoZUluZm8uY29udGVudHMuc2xpY2UoMCkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNiKGVycik7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMudXBkYXRlQ2FjaGVkRGlySW5mbyhwLCBzdGF0LCBmaWxlbmFtZXMuc2xpY2UoMCkpO1xuICAgICAgICBmb2xkZXJFbnRyaWVzLmZvckVhY2goKGVudHJ5KSA9PiB7XG4gICAgICAgICAgdGhpcy51cGRhdGVDYWNoZWRJbmZvKHBhdGguam9pbihwLCBlbnRyeS5uYW1lKSwgZW50cnkpO1xuICAgICAgICB9KTtcbiAgICAgICAgY2IobnVsbCwgZmlsZW5hbWVzKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyByZW1vdmUocDogc3RyaW5nLCBjYjogKGVycm9yPzogRHJvcGJveC5BcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuX3dyYXAoKGludGVyY2VwdENiKSA9PiB7XG4gICAgICB0aGlzLl9jbGllbnQucmVtb3ZlKHAsIGludGVyY2VwdENiKTtcbiAgICB9LCAoZXJyOiBEcm9wYm94LkFwaUVycm9yLCBzdGF0PzogRHJvcGJveC5GaWxlLlN0YXQpID0+IHtcbiAgICAgIGlmICghZXJyKSB7XG4gICAgICAgIHRoaXMudXBkYXRlQ2FjaGVkSW5mbyhwLCBzdGF0KTtcbiAgICAgIH1cbiAgICAgIGNiKGVycik7XG4gICAgfSk7XG4gIH1cblxuICBwdWJsaWMgbW92ZShzcmM6IHN0cmluZywgZGVzdDogc3RyaW5nLCBjYjogKGVycm9yPzogRHJvcGJveC5BcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuX3dyYXAoKGludGVyY2VwdENiKSA9PiB7XG4gICAgICB0aGlzLl9jbGllbnQubW92ZShzcmMsIGRlc3QsIGludGVyY2VwdENiKTtcbiAgICB9LCAoZXJyOiBEcm9wYm94LkFwaUVycm9yLCBzdGF0OiBEcm9wYm94LkZpbGUuU3RhdCkgPT4ge1xuICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgdGhpcy5kZWxldGVDYWNoZWRJbmZvKHNyYyk7XG4gICAgICAgIHRoaXMudXBkYXRlQ2FjaGVkSW5mbyhkZXN0LCBzdGF0KTtcbiAgICAgIH1cbiAgICAgIGNiKGVycik7XG4gICAgfSk7XG4gIH1cblxuICBwdWJsaWMgc3RhdChwOiBzdHJpbmcsIGNiOiAoZXJyb3I6IERyb3Bib3guQXBpRXJyb3IsIHN0YXQ/OiBEcm9wYm94LkZpbGUuU3RhdCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuX3dyYXAoKGludGVyY2VwdENiKSA9PiB7XG4gICAgICB0aGlzLl9jbGllbnQuc3RhdChwLCBpbnRlcmNlcHRDYik7XG4gICAgfSwgKGVycjogRHJvcGJveC5BcGlFcnJvciwgc3RhdDogRHJvcGJveC5GaWxlLlN0YXQpID0+IHtcbiAgICAgIGlmICghZXJyKSB7XG4gICAgICAgIHRoaXMudXBkYXRlQ2FjaGVkSW5mbyhwLCBzdGF0KTtcbiAgICAgIH1cbiAgICAgIGNiKGVyciwgc3RhdCk7XG4gICAgfSk7XG4gIH1cblxuICBwdWJsaWMgcmVhZEZpbGUocDogc3RyaW5nLCBjYjogKGVycm9yOiBEcm9wYm94LkFwaUVycm9yLCBmaWxlPzogQXJyYXlCdWZmZXIsIHN0YXQ/OiBEcm9wYm94LkZpbGUuU3RhdCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIHZhciBjYWNoZUluZm8gPSB0aGlzLmdldENhY2hlZEZpbGVJbmZvKHApO1xuICAgIGlmIChjYWNoZUluZm8gIT09IG51bGwgJiYgY2FjaGVJbmZvLmNvbnRlbnRzICE9PSBudWxsKSB7XG4gICAgICAvLyBUcnkgdG8gdXNlIGNhY2hlZCBpbmZvOyBpc3N1ZSBhIHN0YXQgdG8gc2VlIGlmIGNvbnRlbnRzIGFyZSB1cC10by1kYXRlLlxuICAgICAgdGhpcy5zdGF0KHAsIChlcnJvciwgc3RhdD8pID0+IHtcbiAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgY2IoZXJyb3IpO1xuICAgICAgICB9IGVsc2UgaWYgKHN0YXQuY29udGVudEhhc2ggPT09IGNhY2hlSW5mby5zdGF0LmNvbnRlbnRIYXNoKSB7XG4gICAgICAgICAgLy8gTm8gZmlsZSBjaGFuZ2VzLlxuICAgICAgICAgIGNiKGVycm9yLCBjYWNoZUluZm8uY29udGVudHMuc2xpY2UoMCksIGNhY2hlSW5mby5zdGF0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBGaWxlIGNoYW5nZXM7IHJlcnVuIHRvIHRyaWdnZXIgYWN0dWFsIHJlYWRGaWxlLlxuICAgICAgICAgIHRoaXMucmVhZEZpbGUocCwgY2IpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fd3JhcCgoaW50ZXJjZXB0Q2IpID0+IHtcbiAgICAgICAgdGhpcy5fY2xpZW50LnJlYWRGaWxlKHAsIHsgYXJyYXlCdWZmZXI6IHRydWUgfSwgaW50ZXJjZXB0Q2IpO1xuICAgICAgfSwgKGVycjogRHJvcGJveC5BcGlFcnJvciwgY29udGVudHM6IGFueSwgc3RhdDogRHJvcGJveC5GaWxlLlN0YXQpID0+IHtcbiAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICB0aGlzLnVwZGF0ZUNhY2hlZEluZm8ocCwgc3RhdCwgY29udGVudHMuc2xpY2UoMCkpO1xuICAgICAgICB9XG4gICAgICAgIGNiKGVyciwgY29udGVudHMsIHN0YXQpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIHdyaXRlRmlsZShwOiBzdHJpbmcsIGNvbnRlbnRzOiBBcnJheUJ1ZmZlciwgY2I6IChlcnJvcjogRHJvcGJveC5BcGlFcnJvciwgc3RhdD86IERyb3Bib3guRmlsZS5TdGF0KSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5fd3JhcCgoaW50ZXJjZXB0Q2IpID0+IHtcbiAgICAgIHRoaXMuX2NsaWVudC53cml0ZUZpbGUocCwgY29udGVudHMsIGludGVyY2VwdENiKTtcbiAgICB9LChlcnI6IERyb3Bib3guQXBpRXJyb3IsIHN0YXQ6IERyb3Bib3guRmlsZS5TdGF0KSA9PiB7XG4gICAgICBpZiAoIWVycikge1xuICAgICAgICB0aGlzLnVwZGF0ZUNhY2hlZEluZm8ocCwgc3RhdCwgY29udGVudHMuc2xpY2UoMCkpO1xuICAgICAgfVxuICAgICAgY2IoZXJyLCBzdGF0KTtcbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyBta2RpcihwOiBzdHJpbmcsIGNiOiAoZXJyb3I/OiBEcm9wYm94LkFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5fd3JhcCgoaW50ZXJjZXB0Q2IpID0+IHtcbiAgICAgIHRoaXMuX2NsaWVudC5ta2RpcihwLCBpbnRlcmNlcHRDYik7XG4gICAgfSwgKGVycjogRHJvcGJveC5BcGlFcnJvciwgc3RhdDogRHJvcGJveC5GaWxlLlN0YXQpID0+IHtcbiAgICAgIGlmICghZXJyKSB7XG4gICAgICAgIHRoaXMudXBkYXRlQ2FjaGVkSW5mbyhwLCBzdGF0LCBbXSk7XG4gICAgICB9XG4gICAgICBjYihlcnIpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFdyYXBzIGFuIG9wZXJhdGlvbiBzdWNoIHRoYXQgd2UgcmV0cnkgYSBmYWlsZWQgb3BlcmF0aW9uIDMgdGltZXMuXG4gICAqIE5lY2Vzc2FyeSB0byBkZWFsIHdpdGggRHJvcGJveCByYXRlIGxpbWl0aW5nLlxuICAgKlxuICAgKiBAcGFyYW0gcGVyZm9ybU9wIEZ1bmN0aW9uIHRoYXQgcGVyZm9ybXMgdGhlIG9wZXJhdGlvbi4gV2lsbCBiZSBjYWxsZWQgdXAgdG8gdGhyZWUgdGltZXMuXG4gICAqIEBwYXJhbSBjYiBDYWxsZWQgd2hlbiB0aGUgb3BlcmF0aW9uIHN1Y2NlZWRzLCBmYWlscyBpbiBhIG5vbi10ZW1wb3JhcnkgbWFubmVyLCBvciBmYWlscyB0aHJlZSB0aW1lcy5cbiAgICovXG4gIHByaXZhdGUgX3dyYXAocGVyZm9ybU9wOiAoaW50ZXJjZXB0Q2I6IChlcnJvcjogRHJvcGJveC5BcGlFcnJvcikgPT4gdm9pZCkgPT4gdm9pZCwgY2I6IEZ1bmN0aW9uKTogdm9pZCB7XG4gICAgdmFyIG51bVJ1biA9IDAsXG4gICAgICBpbnRlcmNlcHRDYiA9IGZ1bmN0aW9uIChlcnJvcjogRHJvcGJveC5BcGlFcnJvcik6IHZvaWQge1xuICAgICAgICAvLyBUaW1lb3V0IGR1cmF0aW9uLCBpbiBzZWNvbmRzLlxuICAgICAgICB2YXIgdGltZW91dER1cmF0aW9uOiBudW1iZXIgPSAyO1xuICAgICAgICBpZiAoZXJyb3IgJiYgMyA+ICgrK251bVJ1bikpIHtcbiAgICAgICAgICBzd2l0Y2goZXJyb3Iuc3RhdHVzKSB7XG4gICAgICAgICAgICBjYXNlIERyb3Bib3guQXBpRXJyb3IuU0VSVkVSX0VSUk9SOlxuICAgICAgICAgICAgY2FzZSBEcm9wYm94LkFwaUVycm9yLk5FVFdPUktfRVJST1I6XG4gICAgICAgICAgICBjYXNlIERyb3Bib3guQXBpRXJyb3IuUkFURV9MSU1JVEVEOlxuICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICBwZXJmb3JtT3AoaW50ZXJjZXB0Q2IpO1xuICAgICAgICAgICAgICB9LCB0aW1lb3V0RHVyYXRpb24gKiAxMDAwKTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICBjYi5hcHBseShudWxsLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY2IuYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgIHBlcmZvcm1PcChpbnRlcmNlcHRDYik7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIERyb3Bib3hGaWxlIGV4dGVuZHMgcHJlbG9hZF9maWxlLlByZWxvYWRGaWxlPERyb3Bib3hGaWxlU3lzdGVtPiBpbXBsZW1lbnRzIGZpbGUuRmlsZSB7XG4gIGNvbnN0cnVjdG9yKF9mczogRHJvcGJveEZpbGVTeXN0ZW0sIF9wYXRoOiBzdHJpbmcsIF9mbGFnOiBmaWxlX2ZsYWcuRmlsZUZsYWcsIF9zdGF0OiBTdGF0cywgY29udGVudHM/OiBOb2RlQnVmZmVyKSB7XG4gICAgc3VwZXIoX2ZzLCBfcGF0aCwgX2ZsYWcsIF9zdGF0LCBjb250ZW50cylcbiAgfVxuXG4gIHB1YmxpYyBzeW5jKGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuaXNEaXJ0eSgpKSB7XG4gICAgICB2YXIgYnVmZmVyID0gdGhpcy5nZXRCdWZmZXIoKSxcbiAgICAgICAgYXJyYXlCdWZmZXIgPSBidWZmZXIyQXJyYXlCdWZmZXIoYnVmZmVyKTtcbiAgICAgIHRoaXMuX2ZzLl93cml0ZUZpbGVTdHJpY3QodGhpcy5nZXRQYXRoKCksIGFycmF5QnVmZmVyLCAoZT86IEFwaUVycm9yKSA9PiB7XG4gICAgICAgIGlmICghZSkge1xuICAgICAgICAgIHRoaXMucmVzZXREaXJ0eSgpO1xuICAgICAgICB9XG4gICAgICAgIGNiKGUpO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNiKCk7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIGNsb3NlKGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5zeW5jKGNiKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBEcm9wYm94RmlsZVN5c3RlbSBleHRlbmRzIGZpbGVfc3lzdGVtLkJhc2VGaWxlU3lzdGVtIGltcGxlbWVudHMgZmlsZV9zeXN0ZW0uRmlsZVN5c3RlbSB7XG4gIC8vIFRoZSBEcm9wYm94IGNsaWVudC5cbiAgcHJpdmF0ZSBfY2xpZW50OiBDYWNoZWREcm9wYm94Q2xpZW50O1xuXG4gIC8qKlxuICAgKiBBcmd1bWVudHM6IGFuIGF1dGhlbnRpY2F0ZWQgRHJvcGJveC5qcyBjbGllbnRcbiAgICovXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogRHJvcGJveC5DbGllbnQpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuX2NsaWVudCA9IG5ldyBDYWNoZWREcm9wYm94Q2xpZW50KGNsaWVudCk7XG4gICAgY29uc3RydWN0RXJyb3JDb2RlTG9va3VwKCk7XG4gIH1cblxuICBwdWJsaWMgZ2V0TmFtZSgpOiBzdHJpbmcge1xuICAgIHJldHVybiAnRHJvcGJveCc7XG4gIH1cblxuICBwdWJsaWMgc3RhdGljIGlzQXZhaWxhYmxlKCk6IGJvb2xlYW4ge1xuICAgIC8vIENoZWNrcyBpZiB0aGUgRHJvcGJveCBsaWJyYXJ5IGlzIGxvYWRlZC5cbiAgICByZXR1cm4gdHlwZW9mIERyb3Bib3ggIT09ICd1bmRlZmluZWQnO1xuICB9XG5cbiAgcHVibGljIGlzUmVhZE9ubHkoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLy8gRHJvcGJveCBkb2Vzbid0IHN1cHBvcnQgc3ltbGlua3MsIHByb3BlcnRpZXMsIG9yIHN5bmNocm9ub3VzIGNhbGxzXG5cbiAgcHVibGljIHN1cHBvcnRzU3ltbGlua3MoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcHVibGljIHN1cHBvcnRzUHJvcHMoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcHVibGljIHN1cHBvcnRzU3luY2goKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcHVibGljIGVtcHR5KG1haW5DYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuX2NsaWVudC5yZWFkZGlyKCcvJywgKGVycm9yLCBmaWxlcykgPT4ge1xuICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgIG1haW5DYih0aGlzLmNvbnZlcnQoZXJyb3IsICcvJykpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGRlbGV0ZUZpbGUgPSAoZmlsZTogc3RyaW5nLCBjYjogKGVycj86IEFwaUVycm9yKSA9PiB2b2lkKSA9PiB7XG4gICAgICAgICAgdmFyIHAgPSBwYXRoLmpvaW4oJy8nLCBmaWxlKTtcbiAgICAgICAgICB0aGlzLl9jbGllbnQucmVtb3ZlKHAsIChlcnIpID0+IHtcbiAgICAgICAgICAgIGNiKGVyciA/IHRoaXMuY29udmVydChlcnIsIHApIDogbnVsbCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH07XG4gICAgICAgIHZhciBmaW5pc2hlZCA9IChlcnI/OiBBcGlFcnJvcikgPT4ge1xuICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIG1haW5DYihlcnIpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBtYWluQ2IoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIC8vIFhYWDogPGFueT4gdHlwaW5nIGlzIHRvIGdldCBhcm91bmQgb3Zlcmx5LXJlc3RyaWN0aXZlIEVycm9yQ2FsbGJhY2sgdHlwaW5nLlxuICAgICAgICBhc3luYy5lYWNoKGZpbGVzLCA8YW55PiBkZWxldGVGaWxlLCA8YW55PiBmaW5pc2hlZCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuIHB1YmxpYyByZW5hbWUob2xkUGF0aDogc3RyaW5nLCBuZXdQYXRoOiBzdHJpbmcsIGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5fY2xpZW50Lm1vdmUob2xkUGF0aCwgbmV3UGF0aCwgKGVycm9yKSA9PiB7XG4gICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgLy8gdGhlIG1vdmUgaXMgcGVybWl0dGVkIGlmIG5ld1BhdGggaXMgYSBmaWxlLlxuICAgICAgICAvLyBDaGVjayBpZiB0aGlzIGlzIHRoZSBjYXNlLCBhbmQgcmVtb3ZlIGlmIHNvLlxuICAgICAgICB0aGlzLl9jbGllbnQuc3RhdChuZXdQYXRoLCAoZXJyb3IyLCBzdGF0KSA9PiB7XG4gICAgICAgICAgaWYgKGVycm9yMiB8fCBzdGF0LmlzRm9sZGVyKSB7XG4gICAgICAgICAgICB2YXIgbWlzc2luZ1BhdGggPSAoPGFueT4gZXJyb3IucmVzcG9uc2UpLmVycm9yLmluZGV4T2Yob2xkUGF0aCkgPiAtMSA/IG9sZFBhdGggOiBuZXdQYXRoO1xuICAgICAgICAgICAgY2IodGhpcy5jb252ZXJ0KGVycm9yLCBtaXNzaW5nUGF0aCkpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBEZWxldGUgZmlsZSwgcmVwZWF0IHJlbmFtZS5cbiAgICAgICAgICAgIHRoaXMuX2NsaWVudC5yZW1vdmUobmV3UGF0aCwgKGVycm9yMikgPT4ge1xuICAgICAgICAgICAgICBpZiAoZXJyb3IyKSB7XG4gICAgICAgICAgICAgICAgY2IodGhpcy5jb252ZXJ0KGVycm9yMiwgbmV3UGF0aCkpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMucmVuYW1lKG9sZFBhdGgsIG5ld1BhdGgsIGNiKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNiKCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBwdWJsaWMgc3RhdChwYXRoOiBzdHJpbmcsIGlzTHN0YXQ6IGJvb2xlYW4sIGNiOiAoZXJyOiBBcGlFcnJvciwgc3RhdD86IFN0YXRzKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgLy8gSWdub3JlIGxzdGF0IGNhc2UgLS0gRHJvcGJveCBkb2Vzbid0IHN1cHBvcnQgc3ltbGlua3NcbiAgICAvLyBTdGF0IHRoZSBmaWxlXG4gICAgdGhpcy5fY2xpZW50LnN0YXQocGF0aCwgKGVycm9yLCBzdGF0KSA9PiB7XG4gICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgY2IodGhpcy5jb252ZXJ0KGVycm9yLCBwYXRoKSk7XG4gICAgICB9IGVsc2UgaWYgKChzdGF0ICE9IG51bGwpICYmIHN0YXQuaXNSZW1vdmVkKSB7XG4gICAgICAgIC8vIERyb3Bib3gga2VlcHMgdHJhY2sgb2YgZGVsZXRlZCBmaWxlcywgc28gaWYgYSBmaWxlIGhhcyBleGlzdGVkIGluIHRoZVxuICAgICAgICAvLyBwYXN0IGJ1dCBkb2Vzbid0IGFueSBsb25nZXIsIHlvdSB3b250IGdldCBhbiBlcnJvclxuICAgICAgICBjYihBcGlFcnJvci5GaWxlRXJyb3IoRXJyb3JDb2RlLkVOT0VOVCwgcGF0aCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIHN0YXRzID0gbmV3IFN0YXRzKHRoaXMuX3N0YXRUeXBlKHN0YXQpLCBzdGF0LnNpemUpO1xuICAgICAgICByZXR1cm4gY2IobnVsbCwgc3RhdHMpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIG9wZW4ocGF0aDogc3RyaW5nLCBmbGFnczogZmlsZV9mbGFnLkZpbGVGbGFnLCBtb2RlOiBudW1iZXIsIGNiOiAoZXJyOiBBcGlFcnJvciwgZmQ/OiBmaWxlLkZpbGUpID0+IGFueSk6IHZvaWQge1xuICAgIC8vIFRyeSBhbmQgZ2V0IHRoZSBmaWxlJ3MgY29udGVudHNcbiAgICB0aGlzLl9jbGllbnQucmVhZEZpbGUocGF0aCwgKGVycm9yLCBjb250ZW50LCBkYlN0YXQpID0+IHtcbiAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAvLyBJZiB0aGUgZmlsZSdzIGJlaW5nIG9wZW5lZCBmb3IgcmVhZGluZyBhbmQgZG9lc24ndCBleGlzdCwgcmV0dXJuIGFuXG4gICAgICAgIC8vIGVycm9yXG4gICAgICAgIGlmIChmbGFncy5pc1JlYWRhYmxlKCkpIHtcbiAgICAgICAgICBjYih0aGlzLmNvbnZlcnQoZXJyb3IsIHBhdGgpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzd2l0Y2ggKGVycm9yLnN0YXR1cykge1xuICAgICAgICAgICAgLy8gSWYgaXQncyBiZWluZyBvcGVuZWQgZm9yIHdyaXRpbmcgb3IgYXBwZW5kaW5nLCBjcmVhdGUgaXQgc28gdGhhdFxuICAgICAgICAgICAgLy8gaXQgY2FuIGJlIHdyaXR0ZW4gdG9cbiAgICAgICAgICAgIGNhc2UgRHJvcGJveC5BcGlFcnJvci5OT1RfRk9VTkQ6XG4gICAgICAgICAgICAgIHZhciBhYiA9IG5ldyBBcnJheUJ1ZmZlcigwKTtcbiAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3dyaXRlRmlsZVN0cmljdChwYXRoLCBhYiwgKGVycm9yMjogQXBpRXJyb3IsIHN0YXQ/OiBEcm9wYm94LkZpbGUuU3RhdCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChlcnJvcjIpIHtcbiAgICAgICAgICAgICAgICAgIGNiKGVycm9yMik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHZhciBmaWxlID0gdGhpcy5fbWFrZUZpbGUocGF0aCwgZmxhZ3MsIHN0YXQsIGFycmF5QnVmZmVyMkJ1ZmZlcihhYikpO1xuICAgICAgICAgICAgICAgICAgY2IobnVsbCwgZmlsZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgIHJldHVybiBjYih0aGlzLmNvbnZlcnQoZXJyb3IsIHBhdGgpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIE5vIGVycm9yXG4gICAgICAgIHZhciBidWZmZXI6IEJ1ZmZlcjtcbiAgICAgICAgLy8gRHJvcGJveC5qcyBzZWVtcyB0byBzZXQgYGNvbnRlbnRgIHRvIGBudWxsYCByYXRoZXIgdGhhbiB0byBhbiBlbXB0eVxuICAgICAgICAvLyBidWZmZXIgd2hlbiByZWFkaW5nIGFuIGVtcHR5IGZpbGUuIE5vdCBzdXJlIHdoeSB0aGlzIGlzLlxuICAgICAgICBpZiAoY29udGVudCA9PT0gbnVsbCkge1xuICAgICAgICAgIGJ1ZmZlciA9IG5ldyBCdWZmZXIoMCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYnVmZmVyID0gYXJyYXlCdWZmZXIyQnVmZmVyKGNvbnRlbnQpO1xuICAgICAgICB9XG4gICAgICAgIHZhciBmaWxlID0gdGhpcy5fbWFrZUZpbGUocGF0aCwgZmxhZ3MsIGRiU3RhdCwgYnVmZmVyKTtcbiAgICAgICAgcmV0dXJuIGNiKG51bGwsIGZpbGUpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIF93cml0ZUZpbGVTdHJpY3QocDogc3RyaW5nLCBkYXRhOiBBcnJheUJ1ZmZlciwgY2I6IChlOiBBcGlFcnJvciwgc3RhdD86IERyb3Bib3guRmlsZS5TdGF0KSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdmFyIHBhcmVudCA9IHBhdGguZGlybmFtZShwKTtcbiAgICB0aGlzLnN0YXQocGFyZW50LCBmYWxzZSwgKGVycm9yOiBBcGlFcnJvciwgc3RhdD86IFN0YXRzKTogdm9pZCA9PiB7XG4gICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgY2IoQXBpRXJyb3IuRmlsZUVycm9yKEVycm9yQ29kZS5FTk9FTlQsIHBhcmVudCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fY2xpZW50LndyaXRlRmlsZShwLCBkYXRhLCAoZXJyb3IyLCBzdGF0KSA9PiB7XG4gICAgICAgICAgaWYgKGVycm9yMikge1xuICAgICAgICAgICAgY2IodGhpcy5jb252ZXJ0KGVycm9yMiwgcCkpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYihudWxsLCBzdGF0KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFByaXZhdGVcbiAgICogUmV0dXJucyBhIEJyb3dzZXJGUyBvYmplY3QgcmVwcmVzZW50aW5nIHRoZSB0eXBlIG9mIGEgRHJvcGJveC5qcyBzdGF0IG9iamVjdFxuICAgKi9cbiAgcHVibGljIF9zdGF0VHlwZShzdGF0OiBEcm9wYm94LkZpbGUuU3RhdCk6IEZpbGVUeXBlIHtcbiAgICByZXR1cm4gc3RhdC5pc0ZpbGUgPyBGaWxlVHlwZS5GSUxFIDogRmlsZVR5cGUuRElSRUNUT1JZO1xuICB9XG5cbiAgLyoqXG4gICAqIFByaXZhdGVcbiAgICogUmV0dXJucyBhIEJyb3dzZXJGUyBvYmplY3QgcmVwcmVzZW50aW5nIGEgRmlsZSwgY3JlYXRlZCBmcm9tIHRoZSBkYXRhXG4gICAqIHJldHVybmVkIGJ5IGNhbGxzIHRvIHRoZSBEcm9wYm94IEFQSS5cbiAgICovXG4gIHB1YmxpYyBfbWFrZUZpbGUocGF0aDogc3RyaW5nLCBmbGFnOiBmaWxlX2ZsYWcuRmlsZUZsYWcsIHN0YXQ6IERyb3Bib3guRmlsZS5TdGF0LCBidWZmZXI6IE5vZGVCdWZmZXIpOiBEcm9wYm94RmlsZSB7XG4gICAgdmFyIHR5cGUgPSB0aGlzLl9zdGF0VHlwZShzdGF0KTtcbiAgICB2YXIgc3RhdHMgPSBuZXcgU3RhdHModHlwZSwgc3RhdC5zaXplKTtcbiAgICByZXR1cm4gbmV3IERyb3Bib3hGaWxlKHRoaXMsIHBhdGgsIGZsYWcsIHN0YXRzLCBidWZmZXIpO1xuICB9XG5cbiAgLyoqXG4gICAqIFByaXZhdGVcbiAgICogRGVsZXRlIGEgZmlsZSBvciBkaXJlY3RvcnkgZnJvbSBEcm9wYm94XG4gICAqIGlzRmlsZSBzaG91bGQgcmVmbGVjdCB3aGljaCBjYWxsIHdhcyBtYWRlIHRvIHJlbW92ZSB0aGUgaXQgKGB1bmxpbmtgIG9yXG4gICAqIGBybWRpcmApLiBJZiB0aGlzIGRvZXNuJ3QgbWF0Y2ggd2hhdCdzIGFjdHVhbGx5IGF0IGBwYXRoYCwgYW4gZXJyb3Igd2lsbCBiZVxuICAgKiByZXR1cm5lZFxuICAgKi9cbiAgcHVibGljIF9yZW1vdmUocGF0aDogc3RyaW5nLCBjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCwgaXNGaWxlOiBib29sZWFuKTogdm9pZCB7XG4gICAgdGhpcy5fY2xpZW50LnN0YXQocGF0aCwgKGVycm9yLCBzdGF0KSA9PiB7XG4gICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgY2IodGhpcy5jb252ZXJ0KGVycm9yLCBwYXRoKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoc3RhdC5pc0ZpbGUgJiYgIWlzRmlsZSkge1xuICAgICAgICAgIGNiKEFwaUVycm9yLkZpbGVFcnJvcihFcnJvckNvZGUuRU5PVERJUiwgcGF0aCkpO1xuICAgICAgICB9IGVsc2UgaWYgKCFzdGF0LmlzRmlsZSAmJiBpc0ZpbGUpIHtcbiAgICAgICAgICBjYihBcGlFcnJvci5GaWxlRXJyb3IoRXJyb3JDb2RlLkVJU0RJUiwgcGF0aCkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuX2NsaWVudC5yZW1vdmUocGF0aCwgKGVycm9yKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgY2IodGhpcy5jb252ZXJ0KGVycm9yLCBwYXRoKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBjYihudWxsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIERlbGV0ZSBhIGZpbGVcbiAgICovXG4gIHB1YmxpYyB1bmxpbmsocGF0aDogc3RyaW5nLCBjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuX3JlbW92ZShwYXRoLCBjYiwgdHJ1ZSk7XG4gIH1cblxuICAvKipcbiAgICogRGVsZXRlIGEgZGlyZWN0b3J5XG4gICAqL1xuICBwdWJsaWMgcm1kaXIocGF0aDogc3RyaW5nLCBjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuX3JlbW92ZShwYXRoLCBjYiwgZmFsc2UpO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIGRpcmVjdG9yeVxuICAgKi9cbiAgcHVibGljIG1rZGlyKHA6IHN0cmluZywgbW9kZTogbnVtYmVyLCBjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIC8vIERyb3Bib3guanMnIGNsaWVudC5ta2RpcigpIGJlaGF2ZXMgbGlrZSBgbWtkaXIgLXBgLCBpLmUuIGl0IGNyZWF0ZXMgYVxuICAgIC8vIGRpcmVjdG9yeSBhbmQgYWxsIGl0cyBhbmNlc3RvcnMgaWYgdGhleSBkb24ndCBleGlzdC5cbiAgICAvLyBOb2RlJ3MgZnMubWtkaXIoKSBiZWhhdmVzIGxpa2UgYG1rZGlyYCwgaS5lLiBpdCB0aHJvd3MgYW4gZXJyb3IgaWYgYW4gYXR0ZW1wdFxuICAgIC8vIGlzIG1hZGUgdG8gY3JlYXRlIGEgZGlyZWN0b3J5IHdpdGhvdXQgYSBwYXJlbnQuXG4gICAgLy8gVG8gaGFuZGxlIHRoaXMgaW5jb25zaXN0ZW5jeSwgYSBjaGVjayBmb3IgdGhlIGV4aXN0ZW5jZSBvZiBgcGF0aGAncyBwYXJlbnRcbiAgICAvLyBtdXN0IGJlIHBlcmZvcm1lZCBiZWZvcmUgaXQgaXMgY3JlYXRlZCwgYW5kIGFuIGVycm9yIHRocm93biBpZiBpdCBkb2VzXG4gICAgLy8gbm90IGV4aXN0XG4gICAgdmFyIHBhcmVudCA9IHBhdGguZGlybmFtZShwKTtcbiAgICB0aGlzLl9jbGllbnQuc3RhdChwYXJlbnQsIChlcnJvciwgc3RhdCkgPT4ge1xuICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgIGNiKHRoaXMuY29udmVydChlcnJvciwgcGFyZW50KSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9jbGllbnQubWtkaXIocCwgKGVycm9yKSA9PiB7XG4gICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICBjYihBcGlFcnJvci5GaWxlRXJyb3IoRXJyb3JDb2RlLkVFWElTVCwgcCkpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYihudWxsKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aGUgbmFtZXMgb2YgdGhlIGZpbGVzIGluIGEgZGlyZWN0b3J5XG4gICAqL1xuICBwdWJsaWMgcmVhZGRpcihwYXRoOiBzdHJpbmcsIGNiOiAoZXJyOiBBcGlFcnJvciwgZmlsZXM/OiBzdHJpbmdbXSkgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuX2NsaWVudC5yZWFkZGlyKHBhdGgsIChlcnJvciwgZmlsZXMpID0+IHtcbiAgICAgIGlmIChlcnJvcikge1xuICAgICAgICByZXR1cm4gY2IodGhpcy5jb252ZXJ0KGVycm9yKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gY2IobnVsbCwgZmlsZXMpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnZlcnRzIGEgRHJvcGJveC1KUyBlcnJvciBpbnRvIGEgQkZTIGVycm9yLlxuICAgKi9cbiAgcHVibGljIGNvbnZlcnQoZXJyOiBEcm9wYm94LkFwaUVycm9yLCBwYXRoOiBzdHJpbmcgPSBudWxsKTogQXBpRXJyb3Ige1xuICAgIHZhciBlcnJvckNvZGUgPSBlcnJvckNvZGVMb29rdXBbZXJyLnN0YXR1c107XG4gICAgaWYgKGVycm9yQ29kZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBlcnJvckNvZGUgPSBFcnJvckNvZGUuRUlPO1xuICAgIH1cblxuICAgIGlmIChwYXRoID09IG51bGwpIHtcbiAgICAgIHJldHVybiBuZXcgQXBpRXJyb3IoZXJyb3JDb2RlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIEFwaUVycm9yLkZpbGVFcnJvcihlcnJvckNvZGUsIHBhdGgpO1xuICAgIH1cbiAgfVxufVxuIl19