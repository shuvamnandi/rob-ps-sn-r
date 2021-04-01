"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var file_system = require('../core/file_system');
var api_error_1 = require('../core/api_error');
var node_fs_stats_1 = require('../core/node_fs_stats');
var path = require('path');
var Inode = require('../generic/inode');
var preload_file = require('../generic/preload_file');
var ROOT_NODE_ID = "/";
function GenerateRandomID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
function noError(e, cb) {
    if (e) {
        cb(e);
        return false;
    }
    return true;
}
function noErrorTx(e, tx, cb) {
    if (e) {
        tx.abort(function () {
            cb(e);
        });
        return false;
    }
    return true;
}
var SimpleSyncRWTransaction = (function () {
    function SimpleSyncRWTransaction(store) {
        this.store = store;
        this.originalData = {};
        this.modifiedKeys = [];
    }
    SimpleSyncRWTransaction.prototype.stashOldValue = function (key, value) {
        if (!this.originalData.hasOwnProperty(key)) {
            this.originalData[key] = value;
        }
    };
    SimpleSyncRWTransaction.prototype.markModified = function (key) {
        if (this.modifiedKeys.indexOf(key) === -1) {
            this.modifiedKeys.push(key);
            if (!this.originalData.hasOwnProperty(key)) {
                this.originalData[key] = this.store.get(key);
            }
        }
    };
    SimpleSyncRWTransaction.prototype.get = function (key) {
        var val = this.store.get(key);
        this.stashOldValue(key, val);
        return val;
    };
    SimpleSyncRWTransaction.prototype.put = function (key, data, overwrite) {
        this.markModified(key);
        return this.store.put(key, data, overwrite);
    };
    SimpleSyncRWTransaction.prototype.del = function (key) {
        this.markModified(key);
        this.store.del(key);
    };
    SimpleSyncRWTransaction.prototype.commit = function () { };
    SimpleSyncRWTransaction.prototype.abort = function () {
        var i, key, value;
        for (i = 0; i < this.modifiedKeys.length; i++) {
            key = this.modifiedKeys[i];
            value = this.originalData[key];
            if (value === null) {
                this.store.del(key);
            }
            else {
                this.store.put(key, value, true);
            }
        }
    };
    return SimpleSyncRWTransaction;
}());
exports.SimpleSyncRWTransaction = SimpleSyncRWTransaction;
var SyncKeyValueFile = (function (_super) {
    __extends(SyncKeyValueFile, _super);
    function SyncKeyValueFile(_fs, _path, _flag, _stat, contents) {
        _super.call(this, _fs, _path, _flag, _stat, contents);
    }
    SyncKeyValueFile.prototype.syncSync = function () {
        if (this.isDirty()) {
            this._fs._syncSync(this.getPath(), this.getBuffer(), this.getStats());
            this.resetDirty();
        }
    };
    SyncKeyValueFile.prototype.closeSync = function () {
        this.syncSync();
    };
    return SyncKeyValueFile;
}(preload_file.PreloadFile));
exports.SyncKeyValueFile = SyncKeyValueFile;
var SyncKeyValueFileSystem = (function (_super) {
    __extends(SyncKeyValueFileSystem, _super);
    function SyncKeyValueFileSystem(options) {
        _super.call(this);
        this.store = options.store;
        this.makeRootDirectory();
    }
    SyncKeyValueFileSystem.isAvailable = function () { return true; };
    SyncKeyValueFileSystem.prototype.getName = function () { return this.store.name(); };
    SyncKeyValueFileSystem.prototype.isReadOnly = function () { return false; };
    SyncKeyValueFileSystem.prototype.supportsSymlinks = function () { return false; };
    SyncKeyValueFileSystem.prototype.supportsProps = function () { return false; };
    SyncKeyValueFileSystem.prototype.supportsSynch = function () { return true; };
    SyncKeyValueFileSystem.prototype.makeRootDirectory = function () {
        var tx = this.store.beginTransaction('readwrite');
        if (tx.get(ROOT_NODE_ID) === undefined) {
            var currTime = (new Date()).getTime(), dirInode = new Inode(GenerateRandomID(), 4096, 511 | node_fs_stats_1.FileType.DIRECTORY, currTime, currTime, currTime);
            tx.put(dirInode.id, new Buffer("{}"), false);
            tx.put(ROOT_NODE_ID, dirInode.toBuffer(), false);
            tx.commit();
        }
    };
    SyncKeyValueFileSystem.prototype._findINode = function (tx, parent, filename) {
        var _this = this;
        var read_directory = function (inode) {
            var dirList = _this.getDirListing(tx, parent, inode);
            if (dirList[filename]) {
                return dirList[filename];
            }
            else {
                throw api_error_1.ApiError.ENOENT(path.resolve(parent, filename));
            }
        };
        if (parent === '/') {
            if (filename === '') {
                return ROOT_NODE_ID;
            }
            else {
                return read_directory(this.getINode(tx, parent, ROOT_NODE_ID));
            }
        }
        else {
            return read_directory(this.getINode(tx, parent + path.sep + filename, this._findINode(tx, path.dirname(parent), path.basename(parent))));
        }
    };
    SyncKeyValueFileSystem.prototype.findINode = function (tx, p) {
        return this.getINode(tx, p, this._findINode(tx, path.dirname(p), path.basename(p)));
    };
    SyncKeyValueFileSystem.prototype.getINode = function (tx, p, id) {
        var inode = tx.get(id);
        if (inode === undefined) {
            throw api_error_1.ApiError.ENOENT(p);
        }
        return Inode.fromBuffer(inode);
    };
    SyncKeyValueFileSystem.prototype.getDirListing = function (tx, p, inode) {
        if (!inode.isDirectory()) {
            throw api_error_1.ApiError.ENOTDIR(p);
        }
        var data = tx.get(inode.id);
        if (data === undefined) {
            throw api_error_1.ApiError.ENOENT(p);
        }
        return JSON.parse(data.toString());
    };
    SyncKeyValueFileSystem.prototype.addNewNode = function (tx, data) {
        var retries = 0, currId;
        while (retries < 5) {
            try {
                currId = GenerateRandomID();
                tx.put(currId, data, false);
                return currId;
            }
            catch (e) {
            }
        }
        throw new api_error_1.ApiError(api_error_1.ErrorCode.EIO, 'Unable to commit data to key-value store.');
    };
    SyncKeyValueFileSystem.prototype.commitNewFile = function (tx, p, type, mode, data) {
        var parentDir = path.dirname(p), fname = path.basename(p), parentNode = this.findINode(tx, parentDir), dirListing = this.getDirListing(tx, parentDir, parentNode), currTime = (new Date()).getTime();
        if (p === '/') {
            throw api_error_1.ApiError.EEXIST(p);
        }
        if (dirListing[fname]) {
            throw api_error_1.ApiError.EEXIST(p);
        }
        try {
            var dataId = this.addNewNode(tx, data), fileNode = new Inode(dataId, data.length, mode | type, currTime, currTime, currTime), fileNodeId = this.addNewNode(tx, fileNode.toBuffer());
            dirListing[fname] = fileNodeId;
            tx.put(parentNode.id, new Buffer(JSON.stringify(dirListing)), true);
        }
        catch (e) {
            tx.abort();
            throw e;
        }
        tx.commit();
        return fileNode;
    };
    SyncKeyValueFileSystem.prototype.empty = function () {
        this.store.clear();
        this.makeRootDirectory();
    };
    SyncKeyValueFileSystem.prototype.renameSync = function (oldPath, newPath) {
        var tx = this.store.beginTransaction('readwrite'), oldParent = path.dirname(oldPath), oldName = path.basename(oldPath), newParent = path.dirname(newPath), newName = path.basename(newPath), oldDirNode = this.findINode(tx, oldParent), oldDirList = this.getDirListing(tx, oldParent, oldDirNode);
        if (!oldDirList[oldName]) {
            throw api_error_1.ApiError.ENOENT(oldPath);
        }
        var nodeId = oldDirList[oldName];
        delete oldDirList[oldName];
        if ((newParent + '/').indexOf(oldPath + '/') === 0) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EBUSY, oldParent);
        }
        var newDirNode, newDirList;
        if (newParent === oldParent) {
            newDirNode = oldDirNode;
            newDirList = oldDirList;
        }
        else {
            newDirNode = this.findINode(tx, newParent);
            newDirList = this.getDirListing(tx, newParent, newDirNode);
        }
        if (newDirList[newName]) {
            var newNameNode = this.getINode(tx, newPath, newDirList[newName]);
            if (newNameNode.isFile()) {
                try {
                    tx.del(newNameNode.id);
                    tx.del(newDirList[newName]);
                }
                catch (e) {
                    tx.abort();
                    throw e;
                }
            }
            else {
                throw api_error_1.ApiError.EPERM(newPath);
            }
        }
        newDirList[newName] = nodeId;
        try {
            tx.put(oldDirNode.id, new Buffer(JSON.stringify(oldDirList)), true);
            tx.put(newDirNode.id, new Buffer(JSON.stringify(newDirList)), true);
        }
        catch (e) {
            tx.abort();
            throw e;
        }
        tx.commit();
    };
    SyncKeyValueFileSystem.prototype.statSync = function (p, isLstat) {
        return this.findINode(this.store.beginTransaction('readonly'), p).toStats();
    };
    SyncKeyValueFileSystem.prototype.createFileSync = function (p, flag, mode) {
        var tx = this.store.beginTransaction('readwrite'), data = new Buffer(0), newFile = this.commitNewFile(tx, p, node_fs_stats_1.FileType.FILE, mode, data);
        return new SyncKeyValueFile(this, p, flag, newFile.toStats(), data);
    };
    SyncKeyValueFileSystem.prototype.openFileSync = function (p, flag) {
        var tx = this.store.beginTransaction('readonly'), node = this.findINode(tx, p), data = tx.get(node.id);
        if (data === undefined) {
            throw api_error_1.ApiError.ENOENT(p);
        }
        return new SyncKeyValueFile(this, p, flag, node.toStats(), data);
    };
    SyncKeyValueFileSystem.prototype.removeEntry = function (p, isDir) {
        var tx = this.store.beginTransaction('readwrite'), parent = path.dirname(p), parentNode = this.findINode(tx, parent), parentListing = this.getDirListing(tx, parent, parentNode), fileName = path.basename(p);
        if (!parentListing[fileName]) {
            throw api_error_1.ApiError.ENOENT(p);
        }
        var fileNodeId = parentListing[fileName];
        delete parentListing[fileName];
        var fileNode = this.getINode(tx, p, fileNodeId);
        if (!isDir && fileNode.isDirectory()) {
            throw api_error_1.ApiError.EISDIR(p);
        }
        else if (isDir && !fileNode.isDirectory()) {
            throw api_error_1.ApiError.ENOTDIR(p);
        }
        try {
            tx.del(fileNode.id);
            tx.del(fileNodeId);
            tx.put(parentNode.id, new Buffer(JSON.stringify(parentListing)), true);
        }
        catch (e) {
            tx.abort();
            throw e;
        }
        tx.commit();
    };
    SyncKeyValueFileSystem.prototype.unlinkSync = function (p) {
        this.removeEntry(p, false);
    };
    SyncKeyValueFileSystem.prototype.rmdirSync = function (p) {
        if (this.readdirSync(p).length > 0) {
            throw api_error_1.ApiError.ENOTEMPTY(p);
        }
        else {
            this.removeEntry(p, true);
        }
    };
    SyncKeyValueFileSystem.prototype.mkdirSync = function (p, mode) {
        var tx = this.store.beginTransaction('readwrite'), data = new Buffer('{}');
        this.commitNewFile(tx, p, node_fs_stats_1.FileType.DIRECTORY, mode, data);
    };
    SyncKeyValueFileSystem.prototype.readdirSync = function (p) {
        var tx = this.store.beginTransaction('readonly');
        return Object.keys(this.getDirListing(tx, p, this.findINode(tx, p)));
    };
    SyncKeyValueFileSystem.prototype._syncSync = function (p, data, stats) {
        var tx = this.store.beginTransaction('readwrite'), fileInodeId = this._findINode(tx, path.dirname(p), path.basename(p)), fileInode = this.getINode(tx, p, fileInodeId), inodeChanged = fileInode.update(stats);
        try {
            tx.put(fileInode.id, data, true);
            if (inodeChanged) {
                tx.put(fileInodeId, fileInode.toBuffer(), true);
            }
        }
        catch (e) {
            tx.abort();
            throw e;
        }
        tx.commit();
    };
    return SyncKeyValueFileSystem;
}(file_system.SynchronousFileSystem));
exports.SyncKeyValueFileSystem = SyncKeyValueFileSystem;
var AsyncKeyValueFile = (function (_super) {
    __extends(AsyncKeyValueFile, _super);
    function AsyncKeyValueFile(_fs, _path, _flag, _stat, contents) {
        _super.call(this, _fs, _path, _flag, _stat, contents);
    }
    AsyncKeyValueFile.prototype.sync = function (cb) {
        var _this = this;
        if (this.isDirty()) {
            this._fs._sync(this.getPath(), this.getBuffer(), this.getStats(), function (e) {
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
    AsyncKeyValueFile.prototype.close = function (cb) {
        this.sync(cb);
    };
    return AsyncKeyValueFile;
}(preload_file.PreloadFile));
exports.AsyncKeyValueFile = AsyncKeyValueFile;
var AsyncKeyValueFileSystem = (function (_super) {
    __extends(AsyncKeyValueFileSystem, _super);
    function AsyncKeyValueFileSystem() {
        _super.apply(this, arguments);
    }
    AsyncKeyValueFileSystem.prototype.init = function (store, cb) {
        this.store = store;
        this.makeRootDirectory(cb);
    };
    AsyncKeyValueFileSystem.isAvailable = function () { return true; };
    AsyncKeyValueFileSystem.prototype.getName = function () { return this.store.name(); };
    AsyncKeyValueFileSystem.prototype.isReadOnly = function () { return false; };
    AsyncKeyValueFileSystem.prototype.supportsSymlinks = function () { return false; };
    AsyncKeyValueFileSystem.prototype.supportsProps = function () { return false; };
    AsyncKeyValueFileSystem.prototype.supportsSynch = function () { return false; };
    AsyncKeyValueFileSystem.prototype.makeRootDirectory = function (cb) {
        var tx = this.store.beginTransaction('readwrite');
        tx.get(ROOT_NODE_ID, function (e, data) {
            if (e || data === undefined) {
                var currTime = (new Date()).getTime(), dirInode = new Inode(GenerateRandomID(), 4096, 511 | node_fs_stats_1.FileType.DIRECTORY, currTime, currTime, currTime);
                tx.put(dirInode.id, new Buffer("{}"), false, function (e) {
                    if (noErrorTx(e, tx, cb)) {
                        tx.put(ROOT_NODE_ID, dirInode.toBuffer(), false, function (e) {
                            if (e) {
                                tx.abort(function () { cb(e); });
                            }
                            else {
                                tx.commit(cb);
                            }
                        });
                    }
                });
            }
            else {
                tx.commit(cb);
            }
        });
    };
    AsyncKeyValueFileSystem.prototype._findINode = function (tx, parent, filename, cb) {
        var _this = this;
        var handle_directory_listings = function (e, inode, dirList) {
            if (e) {
                cb(e);
            }
            else if (dirList[filename]) {
                cb(null, dirList[filename]);
            }
            else {
                cb(api_error_1.ApiError.ENOENT(path.resolve(parent, filename)));
            }
        };
        if (parent === '/') {
            if (filename === '') {
                cb(null, ROOT_NODE_ID);
            }
            else {
                this.getINode(tx, parent, ROOT_NODE_ID, function (e, inode) {
                    if (noError(e, cb)) {
                        _this.getDirListing(tx, parent, inode, function (e, dirList) {
                            handle_directory_listings(e, inode, dirList);
                        });
                    }
                });
            }
        }
        else {
            this.findINodeAndDirListing(tx, parent, handle_directory_listings);
        }
    };
    AsyncKeyValueFileSystem.prototype.findINode = function (tx, p, cb) {
        var _this = this;
        this._findINode(tx, path.dirname(p), path.basename(p), function (e, id) {
            if (noError(e, cb)) {
                _this.getINode(tx, p, id, cb);
            }
        });
    };
    AsyncKeyValueFileSystem.prototype.getINode = function (tx, p, id, cb) {
        tx.get(id, function (e, data) {
            if (noError(e, cb)) {
                if (data === undefined) {
                    cb(api_error_1.ApiError.ENOENT(p));
                }
                else {
                    cb(null, Inode.fromBuffer(data));
                }
            }
        });
    };
    AsyncKeyValueFileSystem.prototype.getDirListing = function (tx, p, inode, cb) {
        if (!inode.isDirectory()) {
            cb(api_error_1.ApiError.ENOTDIR(p));
        }
        else {
            tx.get(inode.id, function (e, data) {
                if (noError(e, cb)) {
                    try {
                        cb(null, JSON.parse(data.toString()));
                    }
                    catch (e) {
                        cb(api_error_1.ApiError.ENOENT(p));
                    }
                }
            });
        }
    };
    AsyncKeyValueFileSystem.prototype.findINodeAndDirListing = function (tx, p, cb) {
        var _this = this;
        this.findINode(tx, p, function (e, inode) {
            if (noError(e, cb)) {
                _this.getDirListing(tx, p, inode, function (e, listing) {
                    if (noError(e, cb)) {
                        cb(null, inode, listing);
                    }
                });
            }
        });
    };
    AsyncKeyValueFileSystem.prototype.addNewNode = function (tx, data, cb) {
        var retries = 0, currId, reroll = function () {
            if (++retries === 5) {
                cb(new api_error_1.ApiError(api_error_1.ErrorCode.EIO, 'Unable to commit data to key-value store.'));
            }
            else {
                currId = GenerateRandomID();
                tx.put(currId, data, false, function (e, committed) {
                    if (e || !committed) {
                        reroll();
                    }
                    else {
                        cb(null, currId);
                    }
                });
            }
        };
        reroll();
    };
    AsyncKeyValueFileSystem.prototype.commitNewFile = function (tx, p, type, mode, data, cb) {
        var _this = this;
        var parentDir = path.dirname(p), fname = path.basename(p), currTime = (new Date()).getTime();
        if (p === '/') {
            return cb(api_error_1.ApiError.EEXIST(p));
        }
        this.findINodeAndDirListing(tx, parentDir, function (e, parentNode, dirListing) {
            if (noErrorTx(e, tx, cb)) {
                if (dirListing[fname]) {
                    tx.abort(function () {
                        cb(api_error_1.ApiError.EEXIST(p));
                    });
                }
                else {
                    _this.addNewNode(tx, data, function (e, dataId) {
                        if (noErrorTx(e, tx, cb)) {
                            var fileInode = new Inode(dataId, data.length, mode | type, currTime, currTime, currTime);
                            _this.addNewNode(tx, fileInode.toBuffer(), function (e, fileInodeId) {
                                if (noErrorTx(e, tx, cb)) {
                                    dirListing[fname] = fileInodeId;
                                    tx.put(parentNode.id, new Buffer(JSON.stringify(dirListing)), true, function (e) {
                                        if (noErrorTx(e, tx, cb)) {
                                            tx.commit(function (e) {
                                                if (noErrorTx(e, tx, cb)) {
                                                    cb(null, fileInode);
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            }
        });
    };
    AsyncKeyValueFileSystem.prototype.empty = function (cb) {
        var _this = this;
        this.store.clear(function (e) {
            if (noError(e, cb)) {
                _this.makeRootDirectory(cb);
            }
        });
    };
    AsyncKeyValueFileSystem.prototype.rename = function (oldPath, newPath, cb) {
        var _this = this;
        var tx = this.store.beginTransaction('readwrite'), oldParent = path.dirname(oldPath), oldName = path.basename(oldPath), newParent = path.dirname(newPath), newName = path.basename(newPath), inodes = {}, lists = {}, errorOccurred = false;
        if ((newParent + '/').indexOf(oldPath + '/') === 0) {
            return cb(new api_error_1.ApiError(api_error_1.ErrorCode.EBUSY, oldParent));
        }
        var theOleSwitcharoo = function () {
            if (errorOccurred || !lists.hasOwnProperty(oldParent) || !lists.hasOwnProperty(newParent)) {
                return;
            }
            var oldParentList = lists[oldParent], oldParentINode = inodes[oldParent], newParentList = lists[newParent], newParentINode = inodes[newParent];
            if (!oldParentList[oldName]) {
                cb(api_error_1.ApiError.ENOENT(oldPath));
            }
            else {
                var fileId = oldParentList[oldName];
                delete oldParentList[oldName];
                var completeRename = function () {
                    newParentList[newName] = fileId;
                    tx.put(oldParentINode.id, new Buffer(JSON.stringify(oldParentList)), true, function (e) {
                        if (noErrorTx(e, tx, cb)) {
                            if (oldParent === newParent) {
                                tx.commit(cb);
                            }
                            else {
                                tx.put(newParentINode.id, new Buffer(JSON.stringify(newParentList)), true, function (e) {
                                    if (noErrorTx(e, tx, cb)) {
                                        tx.commit(cb);
                                    }
                                });
                            }
                        }
                    });
                };
                if (newParentList[newName]) {
                    _this.getINode(tx, newPath, newParentList[newName], function (e, inode) {
                        if (noErrorTx(e, tx, cb)) {
                            if (inode.isFile()) {
                                tx.del(inode.id, function (e) {
                                    if (noErrorTx(e, tx, cb)) {
                                        tx.del(newParentList[newName], function (e) {
                                            if (noErrorTx(e, tx, cb)) {
                                                completeRename();
                                            }
                                        });
                                    }
                                });
                            }
                            else {
                                tx.abort(function (e) {
                                    cb(api_error_1.ApiError.EPERM(newPath));
                                });
                            }
                        }
                    });
                }
                else {
                    completeRename();
                }
            }
        };
        var processInodeAndListings = function (p) {
            _this.findINodeAndDirListing(tx, p, function (e, node, dirList) {
                if (e) {
                    if (!errorOccurred) {
                        errorOccurred = true;
                        tx.abort(function () {
                            cb(e);
                        });
                    }
                }
                else {
                    inodes[p] = node;
                    lists[p] = dirList;
                    theOleSwitcharoo();
                }
            });
        };
        processInodeAndListings(oldParent);
        if (oldParent !== newParent) {
            processInodeAndListings(newParent);
        }
    };
    AsyncKeyValueFileSystem.prototype.stat = function (p, isLstat, cb) {
        var tx = this.store.beginTransaction('readonly');
        this.findINode(tx, p, function (e, inode) {
            if (noError(e, cb)) {
                cb(null, inode.toStats());
            }
        });
    };
    AsyncKeyValueFileSystem.prototype.createFile = function (p, flag, mode, cb) {
        var _this = this;
        var tx = this.store.beginTransaction('readwrite'), data = new Buffer(0);
        this.commitNewFile(tx, p, node_fs_stats_1.FileType.FILE, mode, data, function (e, newFile) {
            if (noError(e, cb)) {
                cb(null, new AsyncKeyValueFile(_this, p, flag, newFile.toStats(), data));
            }
        });
    };
    AsyncKeyValueFileSystem.prototype.openFile = function (p, flag, cb) {
        var _this = this;
        var tx = this.store.beginTransaction('readonly');
        this.findINode(tx, p, function (e, inode) {
            if (noError(e, cb)) {
                tx.get(inode.id, function (e, data) {
                    if (noError(e, cb)) {
                        if (data === undefined) {
                            cb(api_error_1.ApiError.ENOENT(p));
                        }
                        else {
                            cb(null, new AsyncKeyValueFile(_this, p, flag, inode.toStats(), data));
                        }
                    }
                });
            }
        });
    };
    AsyncKeyValueFileSystem.prototype.removeEntry = function (p, isDir, cb) {
        var _this = this;
        var tx = this.store.beginTransaction('readwrite'), parent = path.dirname(p), fileName = path.basename(p);
        this.findINodeAndDirListing(tx, parent, function (e, parentNode, parentListing) {
            if (noErrorTx(e, tx, cb)) {
                if (!parentListing[fileName]) {
                    tx.abort(function () {
                        cb(api_error_1.ApiError.ENOENT(p));
                    });
                }
                else {
                    var fileNodeId = parentListing[fileName];
                    delete parentListing[fileName];
                    _this.getINode(tx, p, fileNodeId, function (e, fileNode) {
                        if (noErrorTx(e, tx, cb)) {
                            if (!isDir && fileNode.isDirectory()) {
                                tx.abort(function () {
                                    cb(api_error_1.ApiError.EISDIR(p));
                                });
                            }
                            else if (isDir && !fileNode.isDirectory()) {
                                tx.abort(function () {
                                    cb(api_error_1.ApiError.ENOTDIR(p));
                                });
                            }
                            else {
                                tx.del(fileNode.id, function (e) {
                                    if (noErrorTx(e, tx, cb)) {
                                        tx.del(fileNodeId, function (e) {
                                            if (noErrorTx(e, tx, cb)) {
                                                tx.put(parentNode.id, new Buffer(JSON.stringify(parentListing)), true, function (e) {
                                                    if (noErrorTx(e, tx, cb)) {
                                                        tx.commit(cb);
                                                    }
                                                });
                                            }
                                        });
                                    }
                                });
                            }
                        }
                    });
                }
            }
        });
    };
    AsyncKeyValueFileSystem.prototype.unlink = function (p, cb) {
        this.removeEntry(p, false, cb);
    };
    AsyncKeyValueFileSystem.prototype.rmdir = function (p, cb) {
        var _this = this;
        this.readdir(p, function (err, files) {
            if (err) {
                cb(err);
            }
            else if (files.length > 0) {
                cb(api_error_1.ApiError.ENOTEMPTY(p));
            }
            else {
                _this.removeEntry(p, true, cb);
            }
        });
    };
    AsyncKeyValueFileSystem.prototype.mkdir = function (p, mode, cb) {
        var tx = this.store.beginTransaction('readwrite'), data = new Buffer('{}');
        this.commitNewFile(tx, p, node_fs_stats_1.FileType.DIRECTORY, mode, data, cb);
    };
    AsyncKeyValueFileSystem.prototype.readdir = function (p, cb) {
        var _this = this;
        var tx = this.store.beginTransaction('readonly');
        this.findINode(tx, p, function (e, inode) {
            if (noError(e, cb)) {
                _this.getDirListing(tx, p, inode, function (e, dirListing) {
                    if (noError(e, cb)) {
                        cb(null, Object.keys(dirListing));
                    }
                });
            }
        });
    };
    AsyncKeyValueFileSystem.prototype._sync = function (p, data, stats, cb) {
        var _this = this;
        var tx = this.store.beginTransaction('readwrite');
        this._findINode(tx, path.dirname(p), path.basename(p), function (e, fileInodeId) {
            if (noErrorTx(e, tx, cb)) {
                _this.getINode(tx, p, fileInodeId, function (e, fileInode) {
                    if (noErrorTx(e, tx, cb)) {
                        var inodeChanged = fileInode.update(stats);
                        tx.put(fileInode.id, data, true, function (e) {
                            if (noErrorTx(e, tx, cb)) {
                                if (inodeChanged) {
                                    tx.put(fileInodeId, fileInode.toBuffer(), true, function (e) {
                                        if (noErrorTx(e, tx, cb)) {
                                            tx.commit(cb);
                                        }
                                    });
                                }
                                else {
                                    tx.commit(cb);
                                }
                            }
                        });
                    }
                });
            }
        });
    };
    return AsyncKeyValueFileSystem;
}(file_system.BaseFileSystem));
exports.AsyncKeyValueFileSystem = AsyncKeyValueFileSystem;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoia2V5X3ZhbHVlX2ZpbGVzeXN0ZW0uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvZ2VuZXJpYy9rZXlfdmFsdWVfZmlsZXN5c3RlbS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxJQUFPLFdBQVcsV0FBVyxxQkFBcUIsQ0FBQyxDQUFDO0FBQ3BELDBCQUFrQyxtQkFBbUIsQ0FBQyxDQUFBO0FBQ3RELDhCQUF5Qyx1QkFBdUIsQ0FBQyxDQUFBO0FBR2pFLElBQU8sSUFBSSxXQUFXLE1BQU0sQ0FBQyxDQUFDO0FBQzlCLElBQU8sS0FBSyxXQUFXLGtCQUFrQixDQUFDLENBQUM7QUFDM0MsSUFBTyxZQUFZLFdBQVcseUJBQXlCLENBQUMsQ0FBQztBQUN6RCxJQUFJLFlBQVksR0FBVyxHQUFHLENBQUM7QUFLL0I7SUFFRSxNQUFNLENBQUMsc0NBQXNDLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxVQUFVLENBQUM7UUFDeEUsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztRQUNuRSxNQUFNLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUN4QixDQUFDLENBQUMsQ0FBQztBQUNMLENBQUM7QUFNRCxpQkFBaUIsQ0FBVyxFQUFFLEVBQXlCO0lBQ3JELEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDTixFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDTixNQUFNLENBQUMsS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUNELE1BQU0sQ0FBQyxJQUFJLENBQUM7QUFDZCxDQUFDO0FBTUQsbUJBQW1CLENBQVcsRUFBRSxFQUE4QixFQUFFLEVBQXlCO0lBQ3ZGLEVBQUUs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RSxJQUFJLEVBQUUsVUFBQyxDQUFXOzRCQUMzQyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0NBRXpCLEVBQUUsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7b0NBQ2pCLEVBQUUsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLFNBQVMsQ0FBQyxRQUFRLEVBQUUsRUFBRSxJQUFJLEVBQUUsVUFBQyxDQUFXO3dDQUMxRCxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7NENBQ3pCLEVBQUUsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7d0NBQ2hCLENBQUM7b0NBQ0gsQ0FBQyxDQUFDLENBQUM7Z0NBQ0wsQ0FBQztnQ0FBQyxJQUFJLENBQUMsQ0FBQztvQ0FFTixFQUFFLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dDQUNoQixDQUFDOzRCQUNILENBQUM7d0JBQ0gsQ0FBQyxDQUFDLENBQUM7b0JBQ0wsQ0FBQztnQkFDSCxDQUFDLENBQUMsQ0FBQztZQUNMLENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFDSCw4QkFBQztBQUFELENBQUMsQUFoaUJELENBQTZDLFdBQVcsQ0FBQyxjQUFjLEdBZ2lCdEU7QUFoaUJZLCtCQUF1QiwwQkFnaUJuQyxDQUFBIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGZpbGVfc3lzdGVtID0gcmVxdWlyZSgnLi4vY29yZS9maWxlX3N5c3RlbScpO1xuaW1wb3J0IHtBcGlFcnJvciwgRXJyb3JDb2RlfSBmcm9tICcuLi9jb3JlL2FwaV9lcnJvcic7XG5pbXBvcnQge2RlZmF1bHQgYXMgU3RhdHMsIEZpbGVUeXBlfSBmcm9tICcuLi9jb3JlL25vZGVfZnNfc3RhdHMnO1xuaW1wb3J0IGZpbGUgPSByZXF1aXJlKCcuLi9jb3JlL2ZpbGUnKTtcbmltcG9ydCBmaWxlX2ZsYWcgPSByZXF1aXJlKCcuLi9jb3JlL2ZpbGVfZmxhZycpO1xuaW1wb3J0IHBhdGggPSByZXF1aXJlKCdwYXRoJyk7XG5pbXBvcnQgSW5vZGUgPSByZXF1aXJlKCcuLi9nZW5lcmljL2lub2RlJyk7XG5pbXBvcnQgcHJlbG9hZF9maWxlID0gcmVxdWlyZSgnLi4vZ2VuZXJpYy9wcmVsb2FkX2ZpbGUnKTtcbnZhciBST09UX05PREVfSUQ6IHN0cmluZyA9IFwiL1wiO1xuXG4vKipcbiAqIEdlbmVyYXRlcyBhIHJhbmRvbSBJRC5cbiAqL1xuZnVuY3Rpb24gR2VuZXJhdGVSYW5kb21JRCgpOiBzdHJpbmcge1xuICAvLyBGcm9tIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMTA1MDM0L2hvdy10by1jcmVhdGUtYS1ndWlkLXV1aWQtaW4tamF2YXNjcmlwdFxuICByZXR1cm4gJ3h4eHh4eHh4LXh4eHgtNHh4eC15eHh4LXh4eHh4eHh4eHh4eCcucmVwbGFjZSgvW3h5XS9nLCBmdW5jdGlvbiAoYykge1xuICAgIHZhciByID0gTWF0aC5yYW5kb20oKSAqIDE2IHwgMCwgdiA9IGMgPT0gJ3gnID8gciA6IChyICYgMHgzIHwgMHg4KTtcbiAgICByZXR1cm4gdi50b1N0cmluZygxNik7XG4gIH0pO1xufVxuXG4vKipcbiAqIEhlbHBlciBmdW5jdGlvbi4gQ2hlY2tzIGlmICdlJyBpcyBkZWZpbmVkLiBJZiBzbywgaXQgdHJpZ2dlcnMgdGhlIGNhbGxiYWNrXG4gKiB3aXRoICdlJyBhbmQgcmV0dXJucyBmYWxzZS4gT3RoZXJ3aXNlLCByZXR1cm5zIHRydWUuXG4gKi9cbmZ1bmN0aW9uIG5vRXJyb3IoZTogQXBpRXJyb3IsIGNiOiAoZTogQXBpRXJyb3IpID0+IHZvaWQpOiBib29sZWFuIHtcbiAgaWYgKGUpIHtcbiAgICBjYihlKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbi8qKlxuICogSGVscGVyIGZ1bmN0aW9uLiBDaGVja3MgaWYgJ2UnIGlzIGRlZmluZWQuIElmIHNvLCBpdCBhYm9ydHMgdGhlIHRyYW5zYWN0aW9uLFxuICogdHJpZ2dlcnMgdGhlIGNhbGxiYWNrIHdpdGggJ2UnLCBhbmQgcmV0dXJucyBmYWxzZS4gT3RoZXJ3aXNlLCByZXR1cm5zIHRydWUuXG4gKi9cbmZ1bmN0aW9uIG5vRXJyb3JUeChlOiBBcGlFcnJvciwgdHg6IEFzeW5jS2V5VmFsdWVSV1RyYW5zYWN0aW9uLCBjYjogKGU6IEFwaUVycm9yKSA9PiB2b2lkKTogYm9vbGVhbiB7XG4gIGlmIChlKSB7XG4gICAgdHguYWJvcnQoKCkgPT4ge1xuICAgICAgY2IoZSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG4vKipcbiAqIFJlcHJlc2VudHMgYSAqc3luY2hyb25vdXMqIGtleS12YWx1ZSBzdG9yZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTeW5jS2V5VmFsdWVTdG9yZSB7XG4gIC8qKlxuICAgKiBUaGUgbmFtZSBvZiB0aGUga2V5LXZhbHVlIHN0b3JlLlxuICAgKi9cbiAgbmFtZSgpOiBzdHJpbmc7XG4gIC8qKlxuICAgKiBFbXB0aWVzIHRoZSBrZXktdmFsdWUgc3RvcmUgY29tcGxldGVseS5cbiAgICovXG4gIGNsZWFyKCk6IHZvaWQ7XG4gIC8qKlxuICAgKiBCZWdpbnMgYSBuZXcgcmVhZC1vbmx5IHRyYW5zYWN0aW9uLlxuICAgKi9cbiAgYmVnaW5UcmFuc2FjdGlvbih0eXBlOiBcInJlYWRvbmx5XCIpOiBTeW5jS2V5VmFsdWVST1RyYW5zYWN0aW9uO1xuICAvKipcbiAgICogQmVnaW5zIGEgbmV3IHJlYWQtd3JpdGUgdHJhbnNhY3Rpb24uXG4gICAqL1xuICBiZWdpblRyYW5zYWN0aW9uKHR5cGU6IFwicmVhZHdyaXRlXCIpOiBTeW5jS2V5VmFsdWVSV1RyYW5zYWN0aW9uO1xuICBiZWdpblRyYW5zYWN0aW9uKHR5cGU6IHN0cmluZyk6IFN5bmNLZXlWYWx1ZVJPVHJhbnNhY3Rpb247XG59XG5cbi8qKlxuICogQSByZWFkLW9ubHkgdHJhbnNhY3Rpb24gZm9yIGEgc3luY2hyb25vdXMga2V5IHZhbHVlIHN0b3JlLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFN5bmNLZXlWYWx1ZVJPVHJhbnNhY3Rpb24ge1xuICAvKipcbiAgICogUmV0cmlldmVzIHRoZSBkYXRhIGF0IHRoZSBnaXZlbiBrZXkuIFRocm93cyBhbiBBcGlFcnJvciBpZiBhbiBlcnJvciBvY2N1cnNcbiAgICogb3IgaWYgdGhlIGtleSBkb2VzIG5vdCBleGlzdC5cbiAgICogQHBhcmFtIGtleSBUaGUga2V5IHRvIGxvb2sgdW5kZXIgZm9yIGRhdGEuXG4gICAqIEByZXR1cm4gVGhlIGRhdGEgc3RvcmVkIHVuZGVyIHRoZSBrZXksIG9yIHVuZGVmaW5lZCBpZiBub3QgcHJlc2VudC5cbiAgICovXG4gIGdldChrZXk6IHN0cmluZyk6IE5vZGVCdWZmZXI7XG59XG5cbi8qKlxuICogQSByZWFkLXdyaXRlIHRyYW5zYWN0aW9uIGZvciBhIHN5bmNocm9ub3VzIGtleSB2YWx1ZSBzdG9yZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTeW5jS2V5VmFsdWVSV1RyYW5zYWN0aW9uIGV4dGVuZHMgU3luY0tleVZhbHVlUk9UcmFuc2FjdGlvbiB7XG4gIC8qKlxuICAgKiBBZGRzIHRoZSBkYXRhIHRvIHRoZSBzdG9yZSB1bmRlciB0aGUgZ2l2ZW4ga2V5LlxuICAgKiBAcGFyYW0ga2V5IFRoZSBrZXkgdG8gYWRkIHRoZSBkYXRhIHVuZGVyLlxuICAgKiBAcGFyYW0gZGF0YSBUaGUgZGF0YSB0byBhZGQgdG8gdGhlIHN0b3JlLlxuICAgKiBAcGFyYW0gb3ZlcndyaXRlIElmICd0cnVlJywgb3ZlcndyaXRlIGFueSBleGlzdGluZyBkYXRhLiBJZiAnZmFsc2UnLFxuICAgKiAgIGF2b2lkcyBzdG9yaW5nIHRoZSBkYXRhIGlmIHRoZSBrZXkgZXhpc3RzLlxuICAgKiBAcmV0dXJuIFRydWUgaWYgc3RvcmFnZSBzdWNjZWVkZWQsIGZhbHNlIG90aGVyd2lzZS5cbiAgICovXG4gIHB1dChrZXk6IHN0cmluZywgZGF0YTogTm9kZUJ1ZmZlciwgb3ZlcndyaXRlOiBib29sZWFuKTogYm9vbGVhbjtcbiAgLyoqXG4gICAqIERlbGV0ZXMgdGhlIGRhdGEgYXQgdGhlIGdpdmVuIGtleS5cbiAgICogQHBhcmFtIGtleSBUaGUga2V5IHRvIGRlbGV0ZSBmcm9tIHRoZSBzdG9yZS5cbiAgICovXG4gIGRlbChrZXk6IHN0cmluZyk6IHZvaWQ7XG4gIC8qKlxuICAgKiBDb21taXRzIHRoZSB0cmFuc2FjdGlvbi5cbiAgICovXG4gIGNvbW1pdCgpOiB2b2lkO1xuICAvKipcbiAgICogQWJvcnRzIGFuZCByb2xscyBiYWNrIHRoZSB0cmFuc2FjdGlvbi5cbiAgICovXG4gIGFib3J0KCk6IHZvaWQ7XG59XG5cbi8qKlxuICogQW4gaW50ZXJmYWNlIGZvciBzaW1wbGUgc3luY2hyb25vdXMga2V5LXZhbHVlIHN0b3JlcyB0aGF0IGRvbid0IGhhdmUgc3BlY2lhbFxuICogc3VwcG9ydCBmb3IgdHJhbnNhY3Rpb25zIGFuZCBzdWNoLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFNpbXBsZVN5bmNTdG9yZSB7XG4gIGdldChrZXk6IHN0cmluZyk6IE5vZGVCdWZmZXI7XG4gIHB1dChrZXk6IHN0cmluZywgZGF0YTogTm9kZUJ1ZmZlciwgb3ZlcndyaXRlOiBib29sZWFuKTogYm9vbGVhbjtcbiAgZGVsKGtleTogc3RyaW5nKTogdm9pZDtcbn1cblxuLyoqXG4gKiBBIHNpbXBsZSBSVyB0cmFuc2FjdGlvbiBmb3Igc2ltcGxlIHN5bmNocm9ub3VzIGtleS12YWx1ZSBzdG9yZXMuXG4gKi9cbmV4cG9ydCBjbGFzcyBTaW1wbGVTeW5jUldUcmFuc2FjdGlvbiBpbXBsZW1lbnRzIFN5bmNLZXlWYWx1ZVJXVHJhbnNhY3Rpb24ge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHN0b3JlOiBTaW1wbGVTeW5jU3RvcmUpIHsgfVxuICAvKipcbiAgICogU3RvcmVzIGRhdGEgaW4gdGhlIGtleXMgd2UgbW9kaWZ5IHByaW9yIHRvIG1vZGlmeWluZyB0aGVtLlxuICAgKiBBbGxvd3MgdXMgdG8gcm9sbCBiYWNrIGNvbW1pdHMuXG4gICAqL1xuICBwcml2YXRlIG9yaWdpbmFsRGF0YTogeyBba2V5OiBzdHJpbmddOiBOb2RlQnVmZmVyIH0gPSB7fTtcbiAgLyoqXG4gICAqIExpc3Qgb2Yga2V5cyBtb2RpZmllZCBpbiB0aGlzIHRyYW5zYWN0aW9uLCBpZiBhbnkuXG4gICAqL1xuICBwcml2YXRlIG1vZGlmaWVkS2V5czogc3RyaW5nW10gPSBbXTtcbiAgLyoqXG4gICAqIFN0YXNoZXMgZ2l2ZW4ga2V5IHZhbHVlIHBhaXIgaW50byBgb3JpZ2luYWxEYXRhYCBpZiBpdCBkb2Vzbid0IGFscmVhZHlcbiAgICogZXhpc3QuIEFsbG93cyB1cyB0byBzdGFzaCB2YWx1ZXMgdGhlIHByb2dyYW0gaXMgcmVxdWVzdGluZyBhbnl3YXkgdG9cbiAgICogcHJldmVudCBuZWVkbGVzcyBgZ2V0YCByZXF1ZXN0cyBpZiB0aGUgcHJvZ3JhbSBtb2RpZmllcyB0aGUgZGF0YSBsYXRlclxuICAgKiBvbiBkdXJpbmcgdGhlIHRyYW5zYWN0aW9uLlxuICAgKi9cbiAgcHJpdmF0ZSBzdGFzaE9sZFZhbHVlKGtleTogc3RyaW5nLCB2YWx1ZTogTm9kZUJ1ZmZlcikge1xuICAgIC8vIEtlZXAgb25seSB0aGUgZWFybGllc3QgdmFsdWUgaW4gdGhlIHRyYW5zYWN0aW9uLlxuICAgIGlmICghdGhpcy5vcmlnaW5hbERhdGEuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgdGhpcy5vcmlnaW5hbERhdGFba2V5XSA9IHZhbHVlXG4gICAgfVxuICB9XG4gIC8qKlxuICAgKiBNYXJrcyB0aGUgZ2l2ZW4ga2V5IGFzIG1vZGlmaWVkLCBhbmQgc3Rhc2hlcyBpdHMgdmFsdWUgaWYgaXQgaGFzIG5vdCBiZWVuXG4gICAqIHN0YXNoZWQgYWxyZWFkeS5cbiAgICovXG4gIHByaXZhdGUgbWFya01vZGlmaWVkKGtleTogc3RyaW5nKSB7XG4gICAgaWYgKHRoaXMubW9kaWZpZWRLZXlzLmluZGV4T2Yoa2V5KSA9PT0gLTEpIHtcbiAgICAgIHRoaXMubW9kaWZpZWRLZXlzLnB1c2goa2V5KTtcbiAgICAgIGlmICghdGhpcy5vcmlnaW5hbERhdGEuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICB0aGlzLm9yaWdpbmFsRGF0YVtrZXldID0gdGhpcy5zdG9yZS5nZXQoa2V5KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwdWJsaWMgZ2V0KGtleTogc3RyaW5nKTogTm9kZUJ1ZmZlciB7XG4gICAgdmFyIHZhbCA9IHRoaXMuc3RvcmUuZ2V0KGtleSk7XG4gICAgdGhpcy5zdGFzaE9sZFZhbHVlKGtleSwgdmFsKTtcbiAgICByZXR1cm4gdmFsO1xuICB9XG5cbiAgcHVibGljIHB1dChrZXk6IHN0cmluZywgZGF0YTogTm9kZUJ1ZmZlciwgb3ZlcndyaXRlOiBib29sZWFuKTogYm9vbGVhbiB7XG4gICAgdGhpcy5tYXJrTW9kaWZpZWQoa2V5KTtcbiAgICByZXR1cm4gdGhpcy5zdG9yZS5wdXQoa2V5LCBkYXRhLCBvdmVyd3JpdGUpO1xuICB9XG5cbiAgcHVibGljIGRlbChrZXk6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMubWFya01vZGlmaWVkKGtleSk7XG4gICAgdGhpcy5zdG9yZS5kZWwoa2V5KTtcbiAgfVxuXG4gIHB1YmxpYyBjb21taXQoKTogdm9pZCB7LyogTk9QICovfVxuICBwdWJsaWMgYWJvcnQoKTogdm9pZCB7XG4gICAgLy8gUm9sbGJhY2sgb2xkIHZhbHVlcy5cbiAgICB2YXIgaTogbnVtYmVyLCBrZXk6IHN0cmluZywgdmFsdWU6IE5vZGVCdWZmZXI7XG4gICAgZm9yIChpID0gMDsgaSA8IHRoaXMubW9kaWZpZWRLZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBrZXkgPSB0aGlzLm1vZGlmaWVkS2V5c1tpXTtcbiAgICAgIHZhbHVlID0gdGhpcy5vcmlnaW5hbERhdGFba2V5XTtcbiAgICAgIGlmICh2YWx1ZSA9PT0gbnVsbCkge1xuICAgICAgICAvLyBLZXkgZGlkbid0IGV4aXN0LlxuICAgICAgICB0aGlzLnN0b3JlLmRlbChrZXkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gS2V5IGV4aXN0ZWQuIFN0b3JlIG9sZCB2YWx1ZS5cbiAgICAgICAgdGhpcy5zdG9yZS5wdXQoa2V5LCB2YWx1ZSwgdHJ1ZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3luY0tleVZhbHVlRmlsZVN5c3RlbU9wdGlvbnMge1xuICAvKipcbiAgICogVGhlIGFjdHVhbCBrZXktdmFsdWUgc3RvcmUgdG8gcmVhZCBmcm9tL3dyaXRlIHRvLlxuICAgKi9cbiAgc3RvcmU6IFN5bmNLZXlWYWx1ZVN0b3JlO1xuICAvKipcbiAgICogU2hvdWxkIHRoZSBmaWxlIHN5c3RlbSBzdXBwb3J0IHByb3BlcnRpZXMgKG10aW1lL2F0aW1lL2N0aW1lL2NobW9kL2V0Yyk/XG4gICAqIEVuYWJsaW5nIHRoaXMgc2xpZ2h0bHkgaW5jcmVhc2VzIHRoZSBzdG9yYWdlIHNwYWNlIHBlciBmaWxlLCBhbmQgYWRkc1xuICAgKiBhdGltZSB1cGRhdGVzIGV2ZXJ5IHRpbWUgYSBmaWxlIGlzIGFjY2Vzc2VkLCBtdGltZSB1cGRhdGVzIGV2ZXJ5IHRpbWVcbiAgICogYSBmaWxlIGlzIG1vZGlmaWVkLCBhbmQgcGVybWlzc2lvbiBjaGVja3Mgb24gZXZlcnkgb3BlcmF0aW9uLlxuICAgKlxuICAgKiBEZWZhdWx0cyB0byAqZmFsc2UqLlxuICAgKi9cbiAgLy9zdXBwb3J0UHJvcHM/OiBib29sZWFuO1xuICAvKipcbiAgICogU2hvdWxkIHRoZSBmaWxlIHN5c3RlbSBzdXBwb3J0IGxpbmtzP1xuICAgKi9cbiAgLy9zdXBwb3J0TGlua3M/OiBib29sZWFuO1xufVxuXG5leHBvcnQgY2xhc3MgU3luY0tleVZhbHVlRmlsZSBleHRlbmRzIHByZWxvYWRfZmlsZS5QcmVsb2FkRmlsZTxTeW5jS2V5VmFsdWVGaWxlU3lzdGVtPiBpbXBsZW1lbnRzIGZpbGUuRmlsZSB7XG4gIGNvbnN0cnVjdG9yKF9mczogU3luY0tleVZhbHVlRmlsZVN5c3RlbSwgX3BhdGg6IHN0cmluZywgX2ZsYWc6IGZpbGVfZmxhZy5GaWxlRmxhZywgX3N0YXQ6IFN0YXRzLCBjb250ZW50cz86IE5vZGVCdWZmZXIpIHtcbiAgICBzdXBlcihfZnMsIF9wYXRoLCBfZmxhZywgX3N0YXQsIGNvbnRlbnRzKTtcbiAgfVxuXG4gIHB1YmxpYyBzeW5jU3luYygpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5pc0RpcnR5KCkpIHtcbiAgICAgIHRoaXMuX2ZzLl9zeW5jU3luYyh0aGlzLmdldFBhdGgoKSwgdGhpcy5nZXRCdWZmZXIoKSwgdGhpcy5nZXRTdGF0cygpKTtcbiAgICAgIHRoaXMucmVzZXREaXJ0eSgpO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBjbG9zZVN5bmMoKTogdm9pZCB7XG4gICAgdGhpcy5zeW5jU3luYygpO1xuICB9XG59XG5cbi8qKlxuICogQSBcIlN5bmNocm9ub3VzIGtleS12YWx1ZSBmaWxlIHN5c3RlbVwiLiBTdG9yZXMgZGF0YSB0by9yZXRyaWV2ZXMgZGF0YSBmcm9tIGFuXG4gKiB1bmRlcmx5aW5nIGtleS12YWx1ZSBzdG9yZS5cbiAqXG4gKiBXZSB1c2UgYSB1bmlxdWUgSUQgZm9yIGVhY2ggbm9kZSBpbiB0aGUgZmlsZSBzeXN0ZW0uIFRoZSByb290IG5vZGUgaGFzIGFcbiAqIGZpeGVkIElELlxuICogQHRvZG8gSW50cm9kdWNlIE5vZGUgSUQgY2FjaGluZy5cbiAqIEB0b2RvIENoZWNrIG1vZGVzLlxuICovXG5leHBvcnQgY2xhc3MgU3luY0tleVZhbHVlRmlsZVN5c3RlbSBleHRlbmRzIGZpbGVfc3lzdGVtLlN5bmNocm9ub3VzRmlsZVN5c3RlbSB7XG4gIHByaXZhdGUgc3RvcmU6IFN5bmNLZXlWYWx1ZVN0b3JlO1xuICBjb25zdHJ1Y3RvcihvcHRpb25zOiBTeW5jS2V5VmFsdWVGaWxlU3lzdGVtT3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5zdG9yZSA9IG9wdGlvbnMuc3RvcmU7XG4gICAgLy8gSU5WQVJJQU5UOiBFbnN1cmUgdGhhdCB0aGUgcm9vdCBleGlzdHMuXG4gICAgdGhpcy5tYWtlUm9vdERpcmVjdG9yeSgpO1xuICB9XG5cbiAgcHVibGljIHN0YXRpYyBpc0F2YWlsYWJsZSgpOiBib29sZWFuIHsgcmV0dXJuIHRydWU7IH1cbiAgcHVibGljIGdldE5hbWUoKTogc3RyaW5nIHsgcmV0dXJuIHRoaXMuc3RvcmUubmFtZSgpOyB9XG4gIHB1YmxpYyBpc1JlYWRPbmx5KCk6IGJvb2xlYW4geyByZXR1cm4gZmFsc2U7IH1cbiAgcHVibGljIHN1cHBvcnRzU3ltbGlua3MoKTogYm9vbGVhbiB7IHJldHVybiBmYWxzZTsgfVxuICBwdWJsaWMgc3VwcG9ydHNQcm9wcygpOiBib29sZWFuIHsgcmV0dXJuIGZhbHNlOyB9XG4gIHB1YmxpYyBzdXBwb3J0c1N5bmNoKCk6IGJvb2xlYW4geyByZXR1cm4gdHJ1ZTsgfVxuXG4gIC8qKlxuICAgKiBDaGVja3MgaWYgdGhlIHJvb3QgZGlyZWN0b3J5IGV4aXN0cy4gQ3JlYXRlcyBpdCBpZiBpdCBkb2Vzbid0LlxuICAgKi9cbiAgcHJpdmF0ZSBtYWtlUm9vdERpcmVjdG9yeSgpIHtcbiAgICB2YXIgdHggPSB0aGlzLnN0b3JlLmJlZ2luVHJhbnNhY3Rpb24oJ3JlYWR3cml0ZScpO1xuICAgIGlmICh0eC5nZXQoUk9PVF9OT0RFX0lEKSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBDcmVhdGUgbmV3IGlub2RlLlxuICAgICAgdmFyIGN1cnJUaW1lID0gKG5ldyBEYXRlKCkpLmdldFRpbWUoKSxcbiAgICAgICAgLy8gTW9kZSAwNjY2XG4gICAgICAgIGRpcklub2RlID0gbmV3IElub2RlKEdlbmVyYXRlUmFuZG9tSUQoKSwgNDA5NiwgNTExIHwgRmlsZVR5cGUuRElSRUNUT1JZLCBjdXJyVGltZSwgY3VyclRpbWUsIGN1cnJUaW1lKTtcbiAgICAgIC8vIElmIHRoZSByb290IGRvZXNuJ3QgZXhpc3QsIHRoZSBmaXJzdCByYW5kb20gSUQgc2hvdWxkbid0IGV4aXN0LFxuICAgICAgLy8gZWl0aGVyLlxuICAgICAgdHgucHV0KGRpcklub2RlLmlkLCBuZXcgQnVmZmVyKFwie31cIiksIGZhbHNlKTtcbiAgICAgIHR4LnB1dChST09UX05PREVfSUQsIGRpcklub2RlLnRvQnVmZmVyKCksIGZhbHNlKTtcbiAgICAgIHR4LmNvbW1pdCgpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBIZWxwZXIgZnVuY3Rpb24gZm9yIGZpbmRJTm9kZS5cbiAgICogQHBhcmFtIHBhcmVudCBUaGUgcGFyZW50IGRpcmVjdG9yeSBvZiB0aGUgZmlsZSB3ZSBhcmUgYXR0ZW1wdGluZyB0byBmaW5kLlxuICAgKiBAcGFyYW0gZmlsZW5hbWUgVGhlIGZpbGVuYW1lIG9mIHRoZSBpbm9kZSB3ZSBhcmUgYXR0ZW1wdGluZyB0byBmaW5kLCBtaW51c1xuICAgKiAgIHRoZSBwYXJlbnQuXG4gICAqIEByZXR1cm4gc3RyaW5nIFRoZSBJRCBvZiB0aGUgZmlsZSdzIGlub2RlIGluIHRoZSBmaWxlIHN5c3RlbS5cbiAgICovXG4gIHByaXZhdGUgX2ZpbmRJTm9kZSh0eDogU3luY0tleVZhbHVlUk9UcmFuc2FjdGlvbiwgcGFyZW50OiBzdHJpbmcsIGZpbGVuYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHZhciByZWFkX2RpcmVjdG9yeSA9IChpbm9kZTogSW5vZGUpOiBzdHJpbmcgPT4ge1xuICAgICAgLy8gR2V0IHRoZSByb290J3MgZGlyZWN0b3J5IGxpc3RpbmcuXG4gICAgICB2YXIgZGlyTGlzdCA9IHRoaXMuZ2V0RGlyTGlzdGluZyh0eCwgcGFyZW50LCBpbm9kZSk7XG4gICAgICAvLyBHZXQgdGhlIGZpbGUncyBJRC5cbiAgICAgIGlmIChkaXJMaXN0W2ZpbGVuYW1lXSkge1xuICAgICAgICByZXR1cm4gZGlyTGlzdFtmaWxlbmFtZV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBBcGlFcnJvci5FTk9FTlQocGF0aC5yZXNvbHZlKHBhcmVudCwgZmlsZW5hbWUpKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGlmIChwYXJlbnQgPT09ICcvJykge1xuICAgICAgaWYgKGZpbGVuYW1lID09PSAnJykge1xuICAgICAgICAvLyBCQVNFIENBU0UgIzE6IFJldHVybiB0aGUgcm9vdCdzIElELlxuICAgICAgICByZXR1cm4gUk9PVF9OT0RFX0lEO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gQkFTRSBDQVNFICMyOiBGaW5kIHRoZSBpdGVtIGluIHRoZSByb290IG5kb2UuXG4gICAgICAgIHJldHVybiByZWFkX2RpcmVjdG9yeSh0aGlzLmdldElOb2RlKHR4LCBwYXJlbnQsIFJPT1RfTk9ERV9JRCkpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcmVhZF9kaXJlY3RvcnkodGhpcy5nZXRJTm9kZSh0eCwgcGFyZW50ICsgcGF0aC5zZXAgKyBmaWxlbmFtZSxcbiAgICAgICAgdGhpcy5fZmluZElOb2RlKHR4LCBwYXRoLmRpcm5hbWUocGFyZW50KSwgcGF0aC5iYXNlbmFtZShwYXJlbnQpKSkpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBGaW5kcyB0aGUgSW5vZGUgb2YgdGhlIGdpdmVuIHBhdGguXG4gICAqIEBwYXJhbSBwIFRoZSBwYXRoIHRvIGxvb2sgdXAuXG4gICAqIEByZXR1cm4gVGhlIElub2RlIG9mIHRoZSBwYXRoIHAuXG4gICAqIEB0b2RvIG1lbW9pemUvY2FjaGVcbiAgICovXG4gIHByaXZhdGUgZmluZElOb2RlKHR4OiBTeW5jS2V5VmFsdWVST1RyYW5zYWN0aW9uLCBwOiBzdHJpbmcpOiBJbm9kZSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0SU5vZGUodHgsIHAsIHRoaXMuX2ZpbmRJTm9kZSh0eCwgcGF0aC5kaXJuYW1lKHApLCBwYXRoLmJhc2VuYW1lKHApKSk7XG4gIH1cblxuICAvKipcbiAgICogR2l2ZW4gdGhlIElEIG9mIGEgbm9kZSwgcmV0cmlldmVzIHRoZSBjb3JyZXNwb25kaW5nIElub2RlLlxuICAgKiBAcGFyYW0gdHggVGhlIHRyYW5zYWN0aW9uIHRvIHVzZS5cbiAgICogQHBhcmFtIHAgVGhlIGNvcnJlc3BvbmRpbmcgcGF0aCB0byB0aGUgZmlsZSAodXNlZCBmb3IgZXJyb3IgbWVzc2FnZXMpLlxuICAgKiBAcGFyYW0gaWQgVGhlIElEIHRvIGxvb2sgdXAuXG4gICAqL1xuICBwcml2YXRlIGdldElOb2RlKHR4OiBTeW5jS2V5VmFsdWVST1RyYW5zYWN0aW9uLCBwOiBzdHJpbmcsIGlkOiBzdHJpbmcpOiBJbm9kZSB7XG4gICAgdmFyIGlub2RlID0gdHguZ2V0KGlkKTtcbiAgICBpZiAoaW5vZGUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgQXBpRXJyb3IuRU5PRU5UKHApO1xuICAgIH1cbiAgICByZXR1cm4gSW5vZGUuZnJvbUJ1ZmZlcihpbm9kZSk7XG4gIH1cblxuICAvKipcbiAgICogR2l2ZW4gdGhlIElub2RlIG9mIGEgZGlyZWN0b3J5LCByZXRyaWV2ZXMgdGhlIGNvcnJlc3BvbmRpbmcgZGlyZWN0b3J5XG4gICAqIGxpc3RpbmcuXG4gICAqL1xuICBwcml2YXRlIGdldERpckxpc3RpbmcodHg6IFN5bmNLZXlWYWx1ZVJPVHJhbnNhY3Rpb24sIHA6IHN0cmluZywgaW5vZGU6IElub2RlKTogeyBbZmlsZU5hbWU6IHN0cmluZ106IHN0cmluZyB9IHtcbiAgICBpZiAoIWlub2RlLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgIHRocm93IEFwaUVycm9yLkVOT1RESVIocCk7XG4gICAgfVxuICAgIHZhciBkYXRhID0gdHguZ2V0KGlub2RlLmlkKTtcbiAgICBpZiAoZGF0YSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBBcGlFcnJvci5FTk9FTlQocCk7XG4gICAgfVxuICAgIHJldHVybiBKU09OLnBhcnNlKGRhdGEudG9TdHJpbmcoKSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBub2RlIHVuZGVyIGEgcmFuZG9tIElELiBSZXRyaWVzIDUgdGltZXMgYmVmb3JlIGdpdmluZyB1cCBpblxuICAgKiB0aGUgZXhjZWVkaW5nbHkgdW5saWtlbHkgY2hhbmNlIHRoYXQgd2UgdHJ5IHRvIHJldXNlIGEgcmFuZG9tIEdVSUQuXG4gICAqIEByZXR1cm4gVGhlIEdVSUQgdGhhdCB0aGUgZGF0YSB3YXMgc3RvcmVkIHVuZGVyLlxuICAgKi9cbiAgcHJpdmF0ZSBhZGROZXdOb2RlKHR4OiBTeW5jS2V5VmFsdWVSV1RyYW5zYWN0aW9uLCBkYXRhOiBOb2RlQnVmZmVyKTogc3RyaW5nIHtcbiAgICB2YXIgcmV0cmllcyA9IDAsIGN1cnJJZDogc3RyaW5nO1xuICAgIHdoaWxlIChyZXRyaWVzIDwgNSkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY3VycklkID0gR2VuZXJhdGVSYW5kb21JRCgpO1xuICAgICAgICB0eC5wdXQoY3VycklkLCBkYXRhLCBmYWxzZSk7XG4gICAgICAgIHJldHVybiBjdXJySWQ7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIC8vIElnbm9yZSBhbmQgcmVyb2xsLlxuICAgICAgfVxuICAgIH1cbiAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTywgJ1VuYWJsZSB0byBjb21taXQgZGF0YSB0byBrZXktdmFsdWUgc3RvcmUuJyk7XG4gIH1cblxuICAvKipcbiAgICogQ29tbWl0cyBhIG5ldyBmaWxlICh3ZWxsLCBhIEZJTEUgb3IgYSBESVJFQ1RPUlkpIHRvIHRoZSBmaWxlIHN5c3RlbSB3aXRoXG4gICAqIHRoZSBnaXZlbiBtb2RlLlxuICAgKiBOb3RlOiBUaGlzIHdpbGwgY29tbWl0IHRoZSB0cmFuc2FjdGlvbi5cbiAgICogQHBhcmFtIHAgVGhlIHBhdGggdG8gdGhlIG5ldyBmaWxlLlxuICAgKiBAcGFyYW0gdHlwZSBUaGUgdHlwZSBvZiB0aGUgbmV3IGZpbGUuXG4gICAqIEBwYXJhbSBtb2RlIFRoZSBtb2RlIHRvIGNyZWF0ZSB0aGUgbmV3IGZpbGUgd2l0aC5cbiAgICogQHBhcmFtIGRhdGEgVGhlIGRhdGEgdG8gc3RvcmUgYXQgdGhlIGZpbGUncyBkYXRhIG5vZGUuXG4gICAqIEByZXR1cm4gVGhlIElub2RlIGZvciB0aGUgbmV3IGZpbGUuXG4gICAqL1xuICBwcml2YXRlIGNvbW1pdE5ld0ZpbGUodHg6IFN5bmNLZXlWYWx1ZVJXVHJhbnNhY3Rpb24sIHA6IHN0cmluZywgdHlwZTogRmlsZVR5cGUsIG1vZGU6IG51bWJlciwgZGF0YTogTm9kZUJ1ZmZlcik6IElub2RlIHtcbiAgICB2YXIgcGFyZW50RGlyID0gcGF0aC5kaXJuYW1lKHApLFxuICAgICAgZm5hbWUgPSBwYXRoLmJhc2VuYW1lKHApLFxuICAgICAgcGFyZW50Tm9kZSA9IHRoaXMuZmluZElOb2RlKHR4LCBwYXJlbnREaXIpLFxuICAgICAgZGlyTGlzdGluZyA9IHRoaXMuZ2V0RGlyTGlzdGluZyh0eCwgcGFyZW50RGlyLCBwYXJlbnROb2RlKSxcbiAgICAgIGN1cnJUaW1lID0gKG5ldyBEYXRlKCkpLmdldFRpbWUoKTtcblxuICAgIC8vIEludmFyaWFudDogVGhlIHJvb3QgYWx3YXlzIGV4aXN0cy5cbiAgICAvLyBJZiB3ZSBkb24ndCBjaGVjayB0aGlzIHByaW9yIHRvIHRha2luZyBzdGVwcyBiZWxvdywgd2Ugd2lsbCBjcmVhdGUgYVxuICAgIC8vIGZpbGUgd2l0aCBuYW1lICcnIGluIHJvb3Qgc2hvdWxkIHAgPT0gJy8nLlxuICAgIGlmIChwID09PSAnLycpIHtcbiAgICAgIHRocm93IEFwaUVycm9yLkVFWElTVChwKTtcbiAgICB9XG5cbiAgICAvLyBDaGVjayBpZiBmaWxlIGFscmVhZHkgZXhpc3RzLlxuICAgIGlmIChkaXJMaXN0aW5nW2ZuYW1lXSkge1xuICAgICAgdGhyb3cgQXBpRXJyb3IuRUVYSVNUKHApO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICAvLyBDb21taXQgZGF0YS5cbiAgICAgIHZhciBkYXRhSWQgPSB0aGlzLmFkZE5ld05vZGUodHgsIGRhdGEpLFxuICAgICAgICBmaWxlTm9kZSA9IG5ldyBJbm9kZShkYXRhSWQsIGRhdGEubGVuZ3RoLCBtb2RlIHwgdHlwZSwgY3VyclRpbWUsIGN1cnJUaW1lLCBjdXJyVGltZSksXG4gICAgICAgIC8vIENvbW1pdCBmaWxlIG5vZGUuXG4gICAgICAgIGZpbGVOb2RlSWQgPSB0aGlzLmFkZE5ld05vZGUodHgsIGZpbGVOb2RlLnRvQnVmZmVyKCkpO1xuICAgICAgLy8gVXBkYXRlIGFuZCBjb21taXQgcGFyZW50IGRpcmVjdG9yeSBsaXN0aW5nLlxuICAgICAgZGlyTGlzdGluZ1tmbmFtZV0gPSBmaWxlTm9kZUlkO1xuICAgICAgdHgucHV0KHBhcmVudE5vZGUuaWQsIG5ldyBCdWZmZXIoSlNPTi5zdHJpbmdpZnkoZGlyTGlzdGluZykpLCB0cnVlKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0eC5hYm9ydCgpO1xuICAgICAgdGhyb3cgZTtcbiAgICB9XG4gICAgdHguY29tbWl0KCk7XG4gICAgcmV0dXJuIGZpbGVOb2RlO1xuICB9XG5cbiAgLyoqXG4gICAqIERlbGV0ZSBhbGwgY29udGVudHMgc3RvcmVkIGluIHRoZSBmaWxlIHN5c3RlbS5cbiAgICovXG4gIHB1YmxpYyBlbXB0eSgpOiB2b2lkIHtcbiAgICB0aGlzLnN0b3JlLmNsZWFyKCk7XG4gICAgLy8gSU5WQVJJQU5UOiBSb290IGFsd2F5cyBleGlzdHMuXG4gICAgdGhpcy5tYWtlUm9vdERpcmVjdG9yeSgpO1xuICB9XG5cbiAgcHVibGljIHJlbmFtZVN5bmMob2xkUGF0aDogc3RyaW5nLCBuZXdQYXRoOiBzdHJpbmcpOiB2b2lkIHtcbiAgICB2YXIgdHggPSB0aGlzLnN0b3JlLmJlZ2luVHJhbnNhY3Rpb24oJ3JlYWR3cml0ZScpLFxuICAgICAgb2xkUGFyZW50ID0gcGF0aC5kaXJuYW1lKG9sZFBhdGgpLCBvbGROYW1lID0gcGF0aC5iYXNlbmFtZShvbGRQYXRoKSxcbiAgICAgIG5ld1BhcmVudCA9IHBhdGguZGlybmFtZShuZXdQYXRoKSwgbmV3TmFtZSA9IHBhdGguYmFzZW5hbWUobmV3UGF0aCksXG4gICAgICAvLyBSZW1vdmUgb2xkUGF0aCBmcm9tIHBhcmVudCdzIGRpcmVjdG9yeSBsaXN0aW5nLlxuICAgICAgb2xkRGlyTm9kZSA9IHRoaXMuZmluZElOb2RlKHR4LCBvbGRQYXJlbnQpLFxuICAgICAgb2xkRGlyTGlzdCA9IHRoaXMuZ2V0RGlyTGlzdGluZyh0eCwgb2xkUGFyZW50LCBvbGREaXJOb2RlKTtcblxuICAgIGlmICghb2xkRGlyTGlzdFtvbGROYW1lXSkge1xuICAgICAgdGhyb3cgQXBpRXJyb3IuRU5PRU5UKG9sZFBhdGgpO1xuICAgIH1cbiAgICB2YXIgbm9kZUlkOiBzdHJpbmcgPSBvbGREaXJMaXN0W29sZE5hbWVdO1xuICAgIGRlbGV0ZSBvbGREaXJMaXN0W29sZE5hbWVdO1xuXG4gICAgLy8gSW52YXJpYW50OiBDYW4ndCBtb3ZlIGEgZm9sZGVyIGluc2lkZSBpdHNlbGYuXG4gICAgLy8gVGhpcyBmdW5ueSBsaXR0bGUgaGFjayBlbnN1cmVzIHRoYXQgdGhlIGNoZWNrIHBhc3NlcyBvbmx5IGlmIG9sZFBhdGhcbiAgICAvLyBpcyBhIHN1YnBhdGggb2YgbmV3UGFyZW50LiBXZSBhcHBlbmQgJy8nIHRvIGF2b2lkIG1hdGNoaW5nIGZvbGRlcnMgdGhhdFxuICAgIC8vIGFyZSBhIHN1YnN0cmluZyBvZiB0aGUgYm90dG9tLW1vc3QgZm9sZGVyIGluIHRoZSBwYXRoLlxuICAgIGlmICgobmV3UGFyZW50ICsgJy8nKS5pbmRleE9mKG9sZFBhdGggKyAnLycpID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVCVVNZLCBvbGRQYXJlbnQpO1xuICAgIH1cblxuICAgIC8vIEFkZCBuZXdQYXRoIHRvIHBhcmVudCdzIGRpcmVjdG9yeSBsaXN0aW5nLlxuICAgIHZhciBuZXdEaXJOb2RlOiBJbm9kZSwgbmV3RGlyTGlzdDogdHlwZW9mIG9sZERpckxpc3Q7XG4gICAgaWYgKG5ld1BhcmVudCA9PT0gb2xkUGFyZW50KSB7XG4gICAgICAvLyBQcmV2ZW50IHVzIGZyb20gcmUtZ3JhYmJpbmcgdGhlIHNhbWUgZGlyZWN0b3J5IGxpc3RpbmcsIHdoaWNoIHN0aWxsXG4gICAgICAvLyBjb250YWlucyBvbGROYW1lLlxuICAgICAgbmV3RGlyTm9kZSA9IG9sZERpck5vZGU7XG4gICAgICBuZXdEaXJMaXN0ID0gb2xkRGlyTGlzdDtcbiAgICB9IGVsc2Uge1xuICAgICAgbmV3RGlyTm9kZSA9IHRoaXMuZmluZElOb2RlKHR4LCBuZXdQYXJlbnQpO1xuICAgICAgbmV3RGlyTGlzdCA9IHRoaXMuZ2V0RGlyTGlzdGluZyh0eCwgbmV3UGFyZW50LCBuZXdEaXJOb2RlKTtcbiAgICB9XG5cbiAgICBpZiAobmV3RGlyTGlzdFtuZXdOYW1lXSkge1xuICAgICAgLy8gSWYgaXQncyBhIGZpbGUsIGRlbGV0ZSBpdC5cbiAgICAgIHZhciBuZXdOYW1lTm9kZSA9IHRoaXMuZ2V0SU5vZGUodHgsIG5ld1BhdGgsIG5ld0Rpckxpc3RbbmV3TmFtZV0pO1xuICAgICAgaWYgKG5ld05hbWVOb2RlLmlzRmlsZSgpKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdHguZGVsKG5ld05hbWVOb2RlLmlkKTtcbiAgICAgICAgICB0eC5kZWwobmV3RGlyTGlzdFtuZXdOYW1lXSk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICB0eC5hYm9ydCgpO1xuICAgICAgICAgIHRocm93IGU7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIElmIGl0J3MgYSBkaXJlY3RvcnksIHRocm93IGEgcGVybWlzc2lvbnMgZXJyb3IuXG4gICAgICAgIHRocm93IEFwaUVycm9yLkVQRVJNKG5ld1BhdGgpO1xuICAgICAgfVxuICAgIH1cbiAgICBuZXdEaXJMaXN0W25ld05hbWVdID0gbm9kZUlkO1xuXG4gICAgLy8gQ29tbWl0IHRoZSB0d28gY2hhbmdlZCBkaXJlY3RvcnkgbGlzdGluZ3MuXG4gICAgdHJ5IHtcbiAgICAgIHR4LnB1dChvbGREaXJOb2RlLmlkLCBuZXcgQnVmZmVyKEpTT04uc3RyaW5naWZ5KG9sZERpckxpc3QpKSwgdHJ1ZSk7XG4gICAgICB0eC5wdXQobmV3RGlyTm9kZS5pZCwgbmV3IEJ1ZmZlcihKU09OLnN0cmluZ2lmeShuZXdEaXJMaXN0KSksIHRydWUpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHR4LmFib3J0KCk7XG4gICAgICB0aHJvdyBlO1xuICAgIH1cblxuICAgIHR4LmNvbW1pdCgpO1xuICB9XG5cbiAgcHVibGljIHN0YXRTeW5jKHA6IHN0cmluZywgaXNMc3RhdDogYm9vbGVhbik6IFN0YXRzIHtcbiAgICAvLyBHZXQgdGhlIGlub2RlIHRvIHRoZSBpdGVtLCBjb252ZXJ0IGl0IGludG8gYSBTdGF0cyBvYmplY3QuXG4gICAgcmV0dXJuIHRoaXMuZmluZElOb2RlKHRoaXMuc3RvcmUuYmVnaW5UcmFuc2FjdGlvbigncmVhZG9ubHknKSwgcCkudG9TdGF0cygpO1xuICB9XG5cbiAgcHVibGljIGNyZWF0ZUZpbGVTeW5jKHA6IHN0cmluZywgZmxhZzogZmlsZV9mbGFnLkZpbGVGbGFnLCBtb2RlOiBudW1iZXIpOiBmaWxlLkZpbGUge1xuICAgIHZhciB0eCA9IHRoaXMuc3RvcmUuYmVnaW5UcmFuc2FjdGlvbigncmVhZHdyaXRlJyksXG4gICAgICBkYXRhID0gbmV3IEJ1ZmZlcigwKSxcbiAgICAgIG5ld0ZpbGUgPSB0aGlzLmNvbW1pdE5ld0ZpbGUodHgsIHAsIEZpbGVUeXBlLkZJTEUsIG1vZGUsIGRhdGEpO1xuICAgIC8vIE9wZW4gdGhlIGZpbGUuXG4gICAgcmV0dXJuIG5ldyBTeW5jS2V5VmFsdWVGaWxlKHRoaXMsIHAsIGZsYWcsIG5ld0ZpbGUudG9TdGF0cygpLCBkYXRhKTtcbiAgfVxuXG4gIHB1YmxpYyBvcGVuRmlsZVN5bmMocDogc3RyaW5nLCBmbGFnOiBmaWxlX2ZsYWcuRmlsZUZsYWcpOiBmaWxlLkZpbGUge1xuICAgIHZhciB0eCA9IHRoaXMuc3RvcmUuYmVnaW5UcmFuc2FjdGlvbigncmVhZG9ubHknKSxcbiAgICAgIG5vZGUgPSB0aGlzLmZpbmRJTm9kZSh0eCwgcCksXG4gICAgICBkYXRhID0gdHguZ2V0KG5vZGUuaWQpO1xuICAgIGlmIChkYXRhID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IEFwaUVycm9yLkVOT0VOVChwKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBTeW5jS2V5VmFsdWVGaWxlKHRoaXMsIHAsIGZsYWcsIG5vZGUudG9TdGF0cygpLCBkYXRhKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYWxsIHRyYWNlcyBvZiB0aGUgZ2l2ZW4gcGF0aCBmcm9tIHRoZSBmaWxlIHN5c3RlbS5cbiAgICogQHBhcmFtIHAgVGhlIHBhdGggdG8gcmVtb3ZlIGZyb20gdGhlIGZpbGUgc3lzdGVtLlxuICAgKiBAcGFyYW0gaXNEaXIgRG9lcyB0aGUgcGF0aCBiZWxvbmcgdG8gYSBkaXJlY3RvcnksIG9yIGEgZmlsZT9cbiAgICogQHRvZG8gVXBkYXRlIG10aW1lLlxuICAgKi9cbiAgcHJpdmF0ZSByZW1vdmVFbnRyeShwOiBzdHJpbmcsIGlzRGlyOiBib29sZWFuKTogdm9pZCB7XG4gICAgdmFyIHR4ID0gdGhpcy5zdG9yZS5iZWdpblRyYW5zYWN0aW9uKCdyZWFkd3JpdGUnKSxcbiAgICAgIHBhcmVudDogc3RyaW5nID0gcGF0aC5kaXJuYW1lKHApLFxuICAgICAgcGFyZW50Tm9kZSA9IHRoaXMuZmluZElOb2RlKHR4LCBwYXJlbnQpLFxuICAgICAgcGFyZW50TGlzdGluZyA9IHRoaXMuZ2V0RGlyTGlzdGluZyh0eCwgcGFyZW50LCBwYXJlbnROb2RlKSxcbiAgICAgIGZpbGVOYW1lOiBzdHJpbmcgPSBwYXRoLmJhc2VuYW1lKHApO1xuXG4gICAgaWYgKCFwYXJlbnRMaXN0aW5nW2ZpbGVOYW1lXSkge1xuICAgICAgdGhyb3cgQXBpRXJyb3IuRU5PRU5UKHApO1xuICAgIH1cblxuICAgIC8vIFJlbW92ZSBmcm9tIGRpcmVjdG9yeSBsaXN0aW5nIG9mIHBhcmVudC5cbiAgICB2YXIgZmlsZU5vZGVJZCA9IHBhcmVudExpc3RpbmdbZmlsZU5hbWVdO1xuICAgIGRlbGV0ZSBwYXJlbnRMaXN0aW5nW2ZpbGVOYW1lXTtcblxuICAgIC8vIEdldCBmaWxlIGlub2RlLlxuICAgIHZhciBmaWxlTm9kZSA9IHRoaXMuZ2V0SU5vZGUodHgsIHAsIGZpbGVOb2RlSWQpO1xuICAgIGlmICghaXNEaXIgJiYgZmlsZU5vZGUuaXNEaXJlY3RvcnkoKSkge1xuICAgICAgdGhyb3cgQXBpRXJyb3IuRUlTRElSKHApO1xuICAgIH0gZWxzZSBpZiAoaXNEaXIgJiYgIWZpbGVOb2RlLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgIHRocm93IEFwaUVycm9yLkVOT1RESVIocCk7XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIC8vIERlbGV0ZSBkYXRhLlxuICAgICAgdHguZGVsKGZpbGVOb2RlLmlkKTtcbiAgICAgIC8vIERlbGV0ZSBub2RlLlxuICAgICAgdHguZGVsKGZpbGVOb2RlSWQpO1xuICAgICAgLy8gVXBkYXRlIGRpcmVjdG9yeSBsaXN0aW5nLlxuICAgICAgdHgucHV0KHBhcmVudE5vZGUuaWQsIG5ldyBCdWZmZXIoSlNPTi5zdHJpbmdpZnkocGFyZW50TGlzdGluZykpLCB0cnVlKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0eC5hYm9ydCgpO1xuICAgICAgdGhyb3cgZTtcbiAgICB9XG4gICAgLy8gU3VjY2Vzcy5cbiAgICB0eC5jb21taXQoKTtcbiAgfVxuXG4gIHB1YmxpYyB1bmxpbmtTeW5jKHA6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMucmVtb3ZlRW50cnkocCwgZmFsc2UpO1xuICB9XG5cbiAgcHVibGljIHJtZGlyU3luYyhwOiBzdHJpbmcpOiB2b2lkIHtcbiAgICAvLyBDaGVjayBmaXJzdCBpZiBkaXJlY3RvcnkgaXMgZW1wdHkuXG4gICAgaWYgKHRoaXMucmVhZGRpclN5bmMocCkubGVuZ3RoID4gMCkge1xuICAgICAgdGhyb3cgQXBpRXJyb3IuRU5PVEVNUFRZKHApO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnJlbW92ZUVudHJ5KHAsIHRydWUpO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBta2RpclN5bmMocDogc3RyaW5nLCBtb2RlOiBudW1iZXIpOiB2b2lkIHtcbiAgICB2YXIgdHggPSB0aGlzLnN0b3JlLmJlZ2luVHJhbnNhY3Rpb24oJ3JlYWR3cml0ZScpLFxuICAgICAgZGF0YSA9IG5ldyBCdWZmZXIoJ3t9Jyk7XG4gICAgdGhpcy5jb21taXROZXdGaWxlKHR4LCBwLCBGaWxlVHlwZS5ESVJFQ1RPUlksIG1vZGUsIGRhdGEpO1xuICB9XG5cbiAgcHVibGljIHJlYWRkaXJTeW5jKHA6IHN0cmluZyk6IHN0cmluZ1tde1xuICAgIHZhciB0eCA9IHRoaXMuc3RvcmUuYmVnaW5UcmFuc2FjdGlvbigncmVhZG9ubHknKTtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5nZXREaXJMaXN0aW5nKHR4LCBwLCB0aGlzLmZpbmRJTm9kZSh0eCwgcCkpKTtcbiAgfVxuXG4gIHB1YmxpYyBfc3luY1N5bmMocDogc3RyaW5nLCBkYXRhOiBOb2RlQnVmZmVyLCBzdGF0czogU3RhdHMpOiB2b2lkIHtcbiAgICAvLyBAdG9kbyBFbnN1cmUgbXRpbWUgdXBkYXRlcyBwcm9wZXJseSwgYW5kIHVzZSB0aGF0IHRvIGRldGVybWluZSBpZiBhIGRhdGFcbiAgICAvLyAgICAgICB1cGRhdGUgaXMgcmVxdWlyZWQuXG4gICAgdmFyIHR4ID0gdGhpcy5zdG9yZS5iZWdpblRyYW5zYWN0aW9uKCdyZWFkd3JpdGUnKSxcbiAgICAgIC8vIFdlIHVzZSB0aGUgX2ZpbmRJbm9kZSBoZWxwZXIgYmVjYXVzZSB3ZSBhY3R1YWxseSBuZWVkIHRoZSBJTm9kZSBpZC5cbiAgICAgIGZpbGVJbm9kZUlkID0gdGhpcy5fZmluZElOb2RlKHR4LCBwYXRoLmRpcm5hbWUocCksIHBhdGguYmFzZW5hbWUocCkpLFxuICAgICAgZmlsZUlub2RlID0gdGhpcy5nZXRJTm9kZSh0eCwgcCwgZmlsZUlub2RlSWQpLFxuICAgICAgaW5vZGVDaGFuZ2VkID0gZmlsZUlub2RlLnVwZGF0ZShzdGF0cyk7XG5cbiAgICB0cnkge1xuICAgICAgLy8gU3luYyBkYXRhLlxuICAgICAgdHgucHV0KGZpbGVJbm9kZS5pZCwgZGF0YSwgdHJ1ZSk7XG4gICAgICAvLyBTeW5jIG1ldGFkYXRhLlxuICAgICAgaWYgKGlub2RlQ2hhbmdlZCkge1xuICAgICAgICB0eC5wdXQoZmlsZUlub2RlSWQsIGZpbGVJbm9kZS50b0J1ZmZlcigpLCB0cnVlKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0eC5hYm9ydCgpO1xuICAgICAgdGhyb3cgZTtcbiAgICB9XG4gICAgdHguY29tbWl0KCk7XG4gIH1cbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIGFuICphc3luY2hyb25vdXMqIGtleS12YWx1ZSBzdG9yZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBBc3luY0tleVZhbHVlU3RvcmUge1xuICAvKipcbiAgICogVGhlIG5hbWUgb2YgdGhlIGtleS12YWx1ZSBzdG9yZS5cbiAgICovXG4gIG5hbWUoKTogc3RyaW5nO1xuICAvKipcbiAgICogRW1wdGllcyB0aGUga2V5LXZhbHVlIHN0b3JlIGNvbXBsZXRlbHkuXG4gICAqL1xuICBjbGVhcihjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQ7XG4gIC8qKlxuICAgKiBCZWdpbnMgYSByZWFkLXdyaXRlIHRyYW5zYWN0aW9uLlxuICAgKi9cbiAgYmVnaW5UcmFuc2FjdGlvbih0eXBlOiAncmVhZHdyaXRlJyk6IEFzeW5jS2V5VmFsdWVSV1RyYW5zYWN0aW9uO1xuICAvKipcbiAgICogQmVnaW5zIGEgcmVhZC1vbmx5IHRyYW5zYWN0aW9uLlxuICAgKi9cbiAgYmVnaW5UcmFuc2FjdGlvbih0eXBlOiAncmVhZG9ubHknKTogQXN5bmNLZXlWYWx1ZVJPVHJhbnNhY3Rpb247XG4gIGJlZ2luVHJhbnNhY3Rpb24odHlwZTogc3RyaW5nKTogQXN5bmNLZXlWYWx1ZVJPVHJhbnNhY3Rpb247XG59XG5cbi8qKlxuICogUmVwcmVzZW50cyBhbiBhc3luY2hyb25vdXMgcmVhZC1vbmx5IHRyYW5zYWN0aW9uLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEFzeW5jS2V5VmFsdWVST1RyYW5zYWN0aW9uIHtcbiAgLyoqXG4gICAqIFJldHJpZXZlcyB0aGUgZGF0YSBhdCB0aGUgZ2l2ZW4ga2V5LlxuICAgKiBAcGFyYW0ga2V5IFRoZSBrZXkgdG8gbG9vayB1bmRlciBmb3IgZGF0YS5cbiAgICovXG4gIGdldChrZXk6IHN0cmluZywgY2I6IChlOiBBcGlFcnJvciwgZGF0YT86IE5vZGVCdWZmZXIpID0+IHZvaWQpOiB2b2lkO1xufVxuXG4vKipcbiAqIFJlcHJlc2VudHMgYW4gYXN5bmNocm9ub3VzIHJlYWQtd3JpdGUgdHJhbnNhY3Rpb24uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQXN5bmNLZXlWYWx1ZVJXVHJhbnNhY3Rpb24gZXh0ZW5kcyBBc3luY0tleVZhbHVlUk9UcmFuc2FjdGlvbiB7XG4gIC8qKlxuICAgKiBBZGRzIHRoZSBkYXRhIHRvIHRoZSBzdG9yZSB1bmRlciB0aGUgZ2l2ZW4ga2V5LiBPdmVyd3JpdGVzIGFueSBleGlzdGluZ1xuICAgKiBkYXRhLlxuICAgKiBAcGFyYW0ga2V5IFRoZSBrZXkgdG8gYWRkIHRoZSBkYXRhIHVuZGVyLlxuICAgKiBAcGFyYW0gZGF0YSBUaGUgZGF0YSB0byBhZGQgdG8gdGhlIHN0b3JlLlxuICAgKiBAcGFyYW0gb3ZlcndyaXRlIElmICd0cnVlJywgb3ZlcndyaXRlIGFueSBleGlzdGluZyBkYXRhLiBJZiAnZmFsc2UnLFxuICAgKiAgIGF2b2lkcyB3cml0aW5nIHRoZSBkYXRhIGlmIHRoZSBrZXkgZXhpc3RzLlxuICAgKiBAcGFyYW0gY2IgVHJpZ2dlcmVkIHdpdGggYW4gZXJyb3IgYW5kIHdoZXRoZXIgb3Igbm90IHRoZSB2YWx1ZSB3YXNcbiAgICogICBjb21taXR0ZWQuXG4gICAqL1xuICBwdXQoa2V5OiBzdHJpbmcsIGRhdGE6IE5vZGVCdWZmZXIsIG92ZXJ3cml0ZTogYm9vbGVhbiwgY2I6IChlOiBBcGlFcnJvcixcbiAgICBjb21taXR0ZWQ/OiBib29sZWFuKSA9PiB2b2lkKTogdm9pZDtcbiAgLyoqXG4gICAqIERlbGV0ZXMgdGhlIGRhdGEgYXQgdGhlIGdpdmVuIGtleS5cbiAgICogQHBhcmFtIGtleSBUaGUga2V5IHRvIGRlbGV0ZSBmcm9tIHRoZSBzdG9yZS5cbiAgICovXG4gIGRlbChrZXk6IHN0cmluZywgY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkO1xuICAvKipcbiAgICogQ29tbWl0cyB0aGUgdHJhbnNhY3Rpb24uXG4gICAqL1xuICBjb21taXQoY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkO1xuICAvKipcbiAgICogQWJvcnRzIGFuZCByb2xscyBiYWNrIHRoZSB0cmFuc2FjdGlvbi5cbiAgICovXG4gIGFib3J0KGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZDtcbn1cblxuZXhwb3J0IGNsYXNzIEFzeW5jS2V5VmFsdWVGaWxlIGV4dGVuZHMgcHJlbG9hZF9maWxlLlByZWxvYWRGaWxlPEFzeW5jS2V5VmFsdWVGaWxlU3lzdGVtPiBpbXBsZW1lbnRzIGZpbGUuRmlsZSB7XG4gIGNvbnN0cnVjdG9yKF9mczogQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0sIF9wYXRoOiBzdHJpbmcsIF9mbGFnOiBmaWxlX2ZsYWcuRmlsZUZsYWcsIF9zdGF0OiBTdGF0cywgY29udGVudHM/OiBOb2RlQnVmZmVyKSB7XG4gICAgc3VwZXIoX2ZzLCBfcGF0aCwgX2ZsYWcsIF9zdGF0LCBjb250ZW50cyk7XG4gIH1cblxuICBwdWJsaWMgc3luYyhjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmlzRGlydHkoKSkge1xuICAgICAgdGhpcy5fZnMuX3N5bmModGhpcy5nZXRQYXRoKCksIHRoaXMuZ2V0QnVmZmVyKCksIHRoaXMuZ2V0U3RhdHMoKSwgKGU/OiBBcGlFcnJvcikgPT4ge1xuICAgICAgICBpZiAoIWUpIHtcbiAgICAgICAgICB0aGlzLnJlc2V0RGlydHkoKTtcbiAgICAgICAgfVxuICAgICAgICBjYihlKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBjYigpO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBjbG9zZShjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuc3luYyhjYik7XG4gIH1cbn1cblxuLyoqXG4gKiBBbiBcIkFzeW5jaHJvbm91cyBrZXktdmFsdWUgZmlsZSBzeXN0ZW1cIi4gU3RvcmVzIGRhdGEgdG8vcmV0cmlldmVzIGRhdGEgZnJvbVxuICogYW4gdW5kZXJseWluZyBhc3luY2hyb25vdXMga2V5LXZhbHVlIHN0b3JlLlxuICovXG5leHBvcnQgY2xhc3MgQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0gZXh0ZW5kcyBmaWxlX3N5c3RlbS5CYXNlRmlsZVN5c3RlbSB7XG4gIHByaXZhdGUgc3RvcmU6IEFzeW5jS2V5VmFsdWVTdG9yZTtcblxuICAvKipcbiAgICogSW5pdGlhbGl6ZXMgdGhlIGZpbGUgc3lzdGVtLiBUeXBpY2FsbHkgY2FsbGVkIGJ5IHN1YmNsYXNzZXMnIGFzeW5jXG4gICAqIGNvbnN0cnVjdG9ycy5cbiAgICovXG4gIHB1YmxpYyBpbml0KHN0b3JlOiBBc3luY0tleVZhbHVlU3RvcmUsIGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKSB7XG4gICAgdGhpcy5zdG9yZSA9IHN0b3JlO1xuICAgIC8vIElOVkFSSUFOVDogRW5zdXJlIHRoYXQgdGhlIHJvb3QgZXhpc3RzLlxuICAgIHRoaXMubWFrZVJvb3REaXJlY3RvcnkoY2IpO1xuICB9XG5cbiAgcHVibGljIHN0YXRpYyBpc0F2YWlsYWJsZSgpOiBib29sZWFuIHsgcmV0dXJuIHRydWU7IH1cbiAgcHVibGljIGdldE5hbWUoKTogc3RyaW5nIHsgcmV0dXJuIHRoaXMuc3RvcmUubmFtZSgpOyB9XG4gIHB1YmxpYyBpc1JlYWRPbmx5KCk6IGJvb2xlYW4geyByZXR1cm4gZmFsc2U7IH1cbiAgcHVibGljIHN1cHBvcnRzU3ltbGlua3MoKTogYm9vbGVhbiB7IHJldHVybiBmYWxzZTsgfVxuICBwdWJsaWMgc3VwcG9ydHNQcm9wcygpOiBib29sZWFuIHsgcmV0dXJuIGZhbHNlOyB9XG4gIHB1YmxpYyBzdXBwb3J0c1N5bmNoKCk6IGJvb2xlYW4geyByZXR1cm4gZmFsc2U7IH1cblxuICAvKipcbiAgICogQ2hlY2tzIGlmIHRoZSByb290IGRpcmVjdG9yeSBleGlzdHMuIENyZWF0ZXMgaXQgaWYgaXQgZG9lc24ndC5cbiAgICovXG4gIHByaXZhdGUgbWFrZVJvb3REaXJlY3RvcnkoY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQpIHtcbiAgICB2YXIgdHggPSB0aGlzLnN0b3JlLmJlZ2luVHJhbnNhY3Rpb24oJ3JlYWR3cml0ZScpO1xuICAgIHR4LmdldChST09UX05PREVfSUQsIChlOiBBcGlFcnJvciwgZGF0YT86IE5vZGVCdWZmZXIpID0+IHtcbiAgICAgIGlmIChlIHx8IGRhdGEgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAvLyBDcmVhdGUgbmV3IGlub2RlLlxuICAgICAgICB2YXIgY3VyclRpbWUgPSAobmV3IERhdGUoKSkuZ2V0VGltZSgpLFxuICAgICAgICAgIC8vIE1vZGUgMDY2NlxuICAgICAgICAgIGRpcklub2RlID0gbmV3IElub2RlKEdlbmVyYXRlUmFuZG9tSUQoKSwgNDA5NiwgNTExIHwgRmlsZVR5cGUuRElSRUNUT1JZLCBjdXJyVGltZSwgY3VyclRpbWUsIGN1cnJUaW1lKTtcbiAgICAgICAgLy8gSWYgdGhlIHJvb3QgZG9lc24ndCBleGlzdCwgdGhlIGZpcnN0IHJhbmRvbSBJRCBzaG91bGRuJ3QgZXhpc3QsXG4gICAgICAgIC8vIGVpdGhlci5cbiAgICAgICAgdHgucHV0KGRpcklub2RlLmlkLCBuZXcgQnVmZmVyKFwie31cIiksIGZhbHNlLCAoZT86IEFwaUVycm9yKSA9PiB7XG4gICAgICAgICAgaWYgKG5vRXJyb3JUeChlLCB0eCwgY2IpKSB7XG4gICAgICAgICAgICB0eC5wdXQoUk9PVF9OT0RFX0lELCBkaXJJbm9kZS50b0J1ZmZlcigpLCBmYWxzZSwgKGU/OiBBcGlFcnJvcikgPT4ge1xuICAgICAgICAgICAgICBpZiAoZSkge1xuICAgICAgICAgICAgICAgIHR4LmFib3J0KCgpID0+IHsgY2IoZSk7IH0pO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHR4LmNvbW1pdChjYik7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBXZSdyZSBnb29kLlxuICAgICAgICB0eC5jb21taXQoY2IpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEhlbHBlciBmdW5jdGlvbiBmb3IgZmluZElOb2RlLlxuICAgKiBAcGFyYW0gcGFyZW50IFRoZSBwYXJlbnQgZGlyZWN0b3J5IG9mIHRoZSBmaWxlIHdlIGFyZSBhdHRlbXB0aW5nIHRvIGZpbmQuXG4gICAqIEBwYXJhbSBmaWxlbmFtZSBUaGUgZmlsZW5hbWUgb2YgdGhlIGlub2RlIHdlIGFyZSBhdHRlbXB0aW5nIHRvIGZpbmQsIG1pbnVzXG4gICAqICAgdGhlIHBhcmVudC5cbiAgICogQHBhcmFtIGNiIFBhc3NlZCBhbiBlcnJvciBvciB0aGUgSUQgb2YgdGhlIGZpbGUncyBpbm9kZSBpbiB0aGUgZmlsZSBzeXN0ZW0uXG4gICAqL1xuICBwcml2YXRlIF9maW5kSU5vZGUodHg6IEFzeW5jS2V5VmFsdWVST1RyYW5zYWN0aW9uLCBwYXJlbnQ6IHN0cmluZywgZmlsZW5hbWU6IHN0cmluZywgY2I6IChlOiBBcGlFcnJvciwgaWQ/OiBzdHJpbmcpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB2YXIgaGFuZGxlX2RpcmVjdG9yeV9saXN0aW5ncyA9IChlOiBBcGlFcnJvciwgaW5vZGU/OiBJbm9kZSwgZGlyTGlzdD86IHtbbmFtZTogc3RyaW5nXTogc3RyaW5nfSk6IHZvaWQgPT4ge1xuICAgICAgaWYgKGUpIHtcbiAgICAgICAgY2IoZSlcbiAgICAgIH0gZWxzZSBpZiAoZGlyTGlzdFtmaWxlbmFtZV0pIHtcbiAgICAgICAgY2IobnVsbCwgZGlyTGlzdFtmaWxlbmFtZV0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2IoQXBpRXJyb3IuRU5PRU5UKHBhdGgucmVzb2x2ZShwYXJlbnQsIGZpbGVuYW1lKSkpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBpZiAocGFyZW50ID09PSAnLycpIHtcbiAgICAgIGlmIChmaWxlbmFtZSA9PT0gJycpIHtcbiAgICAgICAgLy8gQkFTRSBDQVNFICMxOiBSZXR1cm4gdGhlIHJvb3QncyBJRC5cbiAgICAgICAgY2IobnVsbCwgUk9PVF9OT0RFX0lEKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEJBU0UgQ0FTRSAjMjogRmluZCB0aGUgaXRlbSBpbiB0aGUgcm9vdCBub2RlLlxuICAgICAgICB0aGlzLmdldElOb2RlKHR4LCBwYXJlbnQsIFJPT1RfTk9ERV9JRCwgKGU6IEFwaUVycm9yLCBpbm9kZT86IElub2RlKTogdm9pZCA9PiB7XG4gICAgICAgICAgaWYgKG5vRXJyb3IoZSwgY2IpKSB7XG4gICAgICAgICAgICB0aGlzLmdldERpckxpc3RpbmcodHgsIHBhcmVudCwgaW5vZGUsIChlOiBBcGlFcnJvciwgZGlyTGlzdD86IHtbbmFtZTogc3RyaW5nXTogc3RyaW5nfSk6IHZvaWQgPT4ge1xuICAgICAgICAgICAgICAvLyBoYW5kbGVfZGlyZWN0b3J5X2xpc3RpbmdzIHdpbGwgaGFuZGxlIGUgZm9yIHVzLlxuICAgICAgICAgICAgICBoYW5kbGVfZGlyZWN0b3J5X2xpc3RpbmdzKGUsIGlub2RlLCBkaXJMaXN0KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEdldCB0aGUgcGFyZW50IGRpcmVjdG9yeSdzIElOb2RlLCBhbmQgZmluZCB0aGUgZmlsZSBpbiBpdHMgZGlyZWN0b3J5XG4gICAgICAvLyBsaXN0aW5nLlxuICAgICAgdGhpcy5maW5kSU5vZGVBbmREaXJMaXN0aW5nKHR4LCBwYXJlbnQsIGhhbmRsZV9kaXJlY3RvcnlfbGlzdGluZ3MpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBGaW5kcyB0aGUgSW5vZGUgb2YgdGhlIGdpdmVuIHBhdGguXG4gICAqIEBwYXJhbSBwIFRoZSBwYXRoIHRvIGxvb2sgdXAuXG4gICAqIEBwYXJhbSBjYiBQYXNzZWQgYW4gZXJyb3Igb3IgdGhlIElub2RlIG9mIHRoZSBwYXRoIHAuXG4gICAqIEB0b2RvIG1lbW9pemUvY2FjaGVcbiAgICovXG4gIHByaXZhdGUgZmluZElOb2RlKHR4OiBBc3luY0tleVZhbHVlUk9UcmFuc2FjdGlvbiwgcDogc3RyaW5nLCBjYjogKGU6IEFwaUVycm9yLCBpbm9kZT86IElub2RlKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5fZmluZElOb2RlKHR4LCBwYXRoLmRpcm5hbWUocCksIHBhdGguYmFzZW5hbWUocCksIChlOiBBcGlFcnJvciwgaWQ/OiBzdHJpbmcpOiB2b2lkID0+IHtcbiAgICAgIGlmIChub0Vycm9yKGUsIGNiKSkge1xuICAgICAgICB0aGlzLmdldElOb2RlKHR4LCBwLCBpZCwgY2IpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEdpdmVuIHRoZSBJRCBvZiBhIG5vZGUsIHJldHJpZXZlcyB0aGUgY29ycmVzcG9uZGluZyBJbm9kZS5cbiAgICogQHBhcmFtIHR4IFRoZSB0cmFuc2FjdGlvbiB0byB1c2UuXG4gICAqIEBwYXJhbSBwIFRoZSBjb3JyZXNwb25kaW5nIHBhdGggdG8gdGhlIGZpbGUgKHVzZWQgZm9yIGVycm9yIG1lc3NhZ2VzKS5cbiAgICogQHBhcmFtIGlkIFRoZSBJRCB0byBsb29rIHVwLlxuICAgKiBAcGFyYW0gY2IgUGFzc2VkIGFuIGVycm9yIG9yIHRoZSBpbm9kZSB1bmRlciB0aGUgZ2l2ZW4gaWQuXG4gICAqL1xuICBwcml2YXRlIGdldElOb2RlKHR4OiBBc3luY0tleVZhbHVlUk9UcmFuc2FjdGlvbiwgcDogc3RyaW5nLCBpZDogc3RyaW5nLCBjYjogKGU6IEFwaUVycm9yLCBpbm9kZT86IElub2RlKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdHguZ2V0KGlkLCAoZTogQXBpRXJyb3IsIGRhdGE/OiBOb2RlQnVmZmVyKTogdm9pZCA9PiB7XG4gICAgICBpZiAobm9FcnJvcihlLCBjYikpIHtcbiAgICAgICAgaWYgKGRhdGEgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGNiKEFwaUVycm9yLkVOT0VOVChwKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY2IobnVsbCwgSW5vZGUuZnJvbUJ1ZmZlcihkYXRhKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHaXZlbiB0aGUgSW5vZGUgb2YgYSBkaXJlY3RvcnksIHJldHJpZXZlcyB0aGUgY29ycmVzcG9uZGluZyBkaXJlY3RvcnlcbiAgICogbGlzdGluZy5cbiAgICovXG4gIHByaXZhdGUgZ2V0RGlyTGlzdGluZyh0eDogQXN5bmNLZXlWYWx1ZVJPVHJhbnNhY3Rpb24sIHA6IHN0cmluZywgaW5vZGU6IElub2RlLCBjYjogKGU6IEFwaUVycm9yLCBsaXN0aW5nPzogeyBbZmlsZU5hbWU6IHN0cmluZ106IHN0cmluZyB9KSA9PiB2b2lkKTogdm9pZCB7XG4gICAgaWYgKCFpbm9kZS5pc0RpcmVjdG9yeSgpKSB7XG4gICAgICBjYihBcGlFcnJvci5FTk9URElSKHApKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdHguZ2V0KGlub2RlLmlkLCAoZTogQXBpRXJyb3IsIGRhdGE/OiBOb2RlQnVmZmVyKTogdm9pZCA9PiB7XG4gICAgICAgIGlmIChub0Vycm9yKGUsIGNiKSkge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjYihudWxsLCBKU09OLnBhcnNlKGRhdGEudG9TdHJpbmcoKSkpO1xuICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIC8vIE9jY3VycyB3aGVuIGRhdGEgaXMgdW5kZWZpbmVkLCBvciBjb3JyZXNwb25kcyB0byBzb21ldGhpbmcgb3RoZXJcbiAgICAgICAgICAgIC8vIHRoYW4gYSBkaXJlY3RvcnkgbGlzdGluZy4gVGhlIGxhdHRlciBzaG91bGQgbmV2ZXIgb2NjdXIgdW5sZXNzXG4gICAgICAgICAgICAvLyB0aGUgZmlsZSBzeXN0ZW0gaXMgY29ycnVwdGVkLlxuICAgICAgICAgICAgY2IoQXBpRXJyb3IuRU5PRU5UKHApKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHaXZlbiBhIHBhdGggdG8gYSBkaXJlY3RvcnksIHJldHJpZXZlcyB0aGUgY29ycmVzcG9uZGluZyBJTm9kZSBhbmRcbiAgICogZGlyZWN0b3J5IGxpc3RpbmcuXG4gICAqL1xuICBwcml2YXRlIGZpbmRJTm9kZUFuZERpckxpc3RpbmcodHg6IEFzeW5jS2V5VmFsdWVST1RyYW5zYWN0aW9uLCBwOiBzdHJpbmcsIGNiOiAoZTogQXBpRXJyb3IsIGlub2RlPzogSW5vZGUsIGxpc3Rpbmc/OiB7IFtmaWxlTmFtZTogc3RyaW5nXTogc3RyaW5nIH0pID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLmZpbmRJTm9kZSh0eCwgcCwgKGU6IEFwaUVycm9yLCBpbm9kZT86IElub2RlKTogdm9pZCA9PiB7XG4gICAgICBpZiAobm9FcnJvcihlLCBjYikpIHtcbiAgICAgICAgdGhpcy5nZXREaXJMaXN0aW5nKHR4LCBwLCBpbm9kZSwgKGUsIGxpc3Rpbmc/KSA9PiB7XG4gICAgICAgICAgaWYgKG5vRXJyb3IoZSwgY2IpKSB7XG4gICAgICAgICAgICBjYihudWxsLCBpbm9kZSwgbGlzdGluZyk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGRzIGEgbmV3IG5vZGUgdW5kZXIgYSByYW5kb20gSUQuIFJldHJpZXMgNSB0aW1lcyBiZWZvcmUgZ2l2aW5nIHVwIGluXG4gICAqIHRoZSBleGNlZWRpbmdseSB1bmxpa2VseSBjaGFuY2UgdGhhdCB3ZSB0cnkgdG8gcmV1c2UgYSByYW5kb20gR1VJRC5cbiAgICogQHBhcmFtIGNiIFBhc3NlZCBhbiBlcnJvciBvciB0aGUgR1VJRCB0aGF0IHRoZSBkYXRhIHdhcyBzdG9yZWQgdW5kZXIuXG4gICAqL1xuICBwcml2YXRlIGFkZE5ld05vZGUodHg6IEFzeW5jS2V5VmFsdWVSV1RyYW5zYWN0aW9uLCBkYXRhOiBOb2RlQnVmZmVyLCBjYjogKGU6IEFwaUVycm9yLCBndWlkPzogc3RyaW5nKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdmFyIHJldHJpZXMgPSAwLCBjdXJySWQ6IHN0cmluZyxcbiAgICAgIHJlcm9sbCA9ICgpID0+IHtcbiAgICAgICAgaWYgKCsrcmV0cmllcyA9PT0gNSkge1xuICAgICAgICAgIC8vIE1heCByZXRyaWVzIGhpdC4gUmV0dXJuIHdpdGggYW4gZXJyb3IuXG4gICAgICAgICAgY2IobmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU8sICdVbmFibGUgdG8gY29tbWl0IGRhdGEgdG8ga2V5LXZhbHVlIHN0b3JlLicpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBUcnkgYWdhaW4uXG4gICAgICAgICAgY3VycklkID0gR2VuZXJhdGVSYW5kb21JRCgpO1xuICAgICAgICAgIHR4LnB1dChjdXJySWQsIGRhdGEsIGZhbHNlLCAoZTogQXBpRXJyb3IsIGNvbW1pdHRlZD86IGJvb2xlYW4pID0+IHtcbiAgICAgICAgICAgIGlmIChlIHx8ICFjb21taXR0ZWQpIHtcbiAgICAgICAgICAgICAgcmVyb2xsKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBTdWNjZXNzZnVsbHkgc3RvcmVkIHVuZGVyICdjdXJySWQnLlxuICAgICAgICAgICAgICBjYihudWxsLCBjdXJySWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIHJlcm9sbCgpO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbW1pdHMgYSBuZXcgZmlsZSAod2VsbCwgYSBGSUxFIG9yIGEgRElSRUNUT1JZKSB0byB0aGUgZmlsZSBzeXN0ZW0gd2l0aFxuICAgKiB0aGUgZ2l2ZW4gbW9kZS5cbiAgICogTm90ZTogVGhpcyB3aWxsIGNvbW1pdCB0aGUgdHJhbnNhY3Rpb24uXG4gICAqIEBwYXJhbSBwIFRoZSBwYXRoIHRvIHRoZSBuZXcgZmlsZS5cbiAgICogQHBhcmFtIHR5cGUgVGhlIHR5cGUgb2YgdGhlIG5ldyBmaWxlLlxuICAgKiBAcGFyYW0gbW9kZSBUaGUgbW9kZSB0byBjcmVhdGUgdGhlIG5ldyBmaWxlIHdpdGguXG4gICAqIEBwYXJhbSBkYXRhIFRoZSBkYXRhIHRvIHN0b3JlIGF0IHRoZSBmaWxlJ3MgZGF0YSBub2RlLlxuICAgKiBAcGFyYW0gY2IgUGFzc2VkIGFuIGVycm9yIG9yIHRoZSBJbm9kZSBmb3IgdGhlIG5ldyBmaWxlLlxuICAgKi9cbiAgcHJpdmF0ZSBjb21taXROZXdGaWxlKHR4OiBBc3luY0tleVZhbHVlUldUcmFuc2FjdGlvbiwgcDogc3RyaW5nLCB0eXBlOiBGaWxlVHlwZSwgbW9kZTogbnVtYmVyLCBkYXRhOiBOb2RlQnVmZmVyLCBjYjogKGU6IEFwaUVycm9yLCBpbm9kZT86IElub2RlKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdmFyIHBhcmVudERpciA9IHBhdGguZGlybmFtZShwKSxcbiAgICAgIGZuYW1lID0gcGF0aC5iYXNlbmFtZShwKSxcbiAgICAgIGN1cnJUaW1lID0gKG5ldyBEYXRlKCkpLmdldFRpbWUoKTtcblxuICAgIC8vIEludmFyaWFudDogVGhlIHJvb3QgYWx3YXlzIGV4aXN0cy5cbiAgICAvLyBJZiB3ZSBkb24ndCBjaGVjayB0aGlzIHByaW9yIHRvIHRha2luZyBzdGVwcyBiZWxvdywgd2Ugd2lsbCBjcmVhdGUgYVxuICAgIC8vIGZpbGUgd2l0aCBuYW1lICcnIGluIHJvb3Qgc2hvdWxkIHAgPT0gJy8nLlxuICAgIGlmIChwID09PSAnLycpIHtcbiAgICAgIHJldHVybiBjYihBcGlFcnJvci5FRVhJU1QocCkpO1xuICAgIH1cblxuICAgIC8vIExldCdzIGJ1aWxkIGEgcHlyYW1pZCBvZiBjb2RlIVxuXG4gICAgLy8gU3RlcCAxOiBHZXQgdGhlIHBhcmVudCBkaXJlY3RvcnkncyBpbm9kZSBhbmQgZGlyZWN0b3J5IGxpc3RpbmdcbiAgICB0aGlzLmZpbmRJTm9kZUFuZERpckxpc3RpbmcodHgsIHBhcmVudERpciwgKGU6IEFwaUVycm9yLCBwYXJlbnROb2RlPzogSW5vZGUsIGRpckxpc3Rpbmc/OiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30pOiB2b2lkID0+IHtcbiAgICAgIGlmIChub0Vycm9yVHgoZSwgdHgsIGNiKSkge1xuICAgICAgICBpZiAoZGlyTGlzdGluZ1tmbmFtZV0pIHtcbiAgICAgICAgICAvLyBGaWxlIGFscmVhZHkgZXhpc3RzLlxuICAgICAgICAgIHR4LmFib3J0KCgpID0+IHtcbiAgICAgICAgICAgIGNiKEFwaUVycm9yLkVFWElTVChwKSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gU3RlcCAyOiBDb21taXQgZGF0YSB0byBzdG9yZS5cbiAgICAgICAgICB0aGlzLmFkZE5ld05vZGUodHgsIGRhdGEsIChlOiBBcGlFcnJvciwgZGF0YUlkPzogc3RyaW5nKTogdm9pZCA9PiB7XG4gICAgICAgICAgICBpZiAobm9FcnJvclR4KGUsIHR4LCBjYikpIHtcbiAgICAgICAgICAgICAgLy8gU3RlcCAzOiBDb21taXQgdGhlIGZpbGUncyBpbm9kZSB0byB0aGUgc3RvcmUuXG4gICAgICAgICAgICAgIHZhciBmaWxlSW5vZGUgPSBuZXcgSW5vZGUoZGF0YUlkLCBkYXRhLmxlbmd0aCwgbW9kZSB8IHR5cGUsIGN1cnJUaW1lLCBjdXJyVGltZSwgY3VyclRpbWUpO1xuICAgICAgICAgICAgICB0aGlzLmFkZE5ld05vZGUodHgsIGZpbGVJbm9kZS50b0J1ZmZlcigpLCAoZTogQXBpRXJyb3IsIGZpbGVJbm9kZUlkPzogc3RyaW5nKTogdm9pZCA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKG5vRXJyb3JUeChlLCB0eCwgY2IpKSB7XG4gICAgICAgICAgICAgICAgICAvLyBTdGVwIDQ6IFVwZGF0ZSBwYXJlbnQgZGlyZWN0b3J5J3MgbGlzdGluZy5cbiAgICAgICAgICAgICAgICAgIGRpckxpc3RpbmdbZm5hbWVdID0gZmlsZUlub2RlSWQ7XG4gICAgICAgICAgICAgICAgICB0eC5wdXQocGFyZW50Tm9kZS5pZCwgbmV3IEJ1ZmZlcihKU09OLnN0cmluZ2lmeShkaXJMaXN0aW5nKSksIHRydWUsIChlOiBBcGlFcnJvcik6IHZvaWQgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAobm9FcnJvclR4KGUsIHR4LCBjYikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAvLyBTdGVwIDU6IENvbW1pdCBhbmQgcmV0dXJuIHRoZSBuZXcgaW5vZGUuXG4gICAgICAgICAgICAgICAgICAgICAgdHguY29tbWl0KChlPzogQXBpRXJyb3IpOiB2b2lkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChub0Vycm9yVHgoZSwgdHgsIGNiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBjYihudWxsLCBmaWxlSW5vZGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogRGVsZXRlIGFsbCBjb250ZW50cyBzdG9yZWQgaW4gdGhlIGZpbGUgc3lzdGVtLlxuICAgKi9cbiAgcHVibGljIGVtcHR5KGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5zdG9yZS5jbGVhcigoZT8pID0+IHtcbiAgICAgIGlmIChub0Vycm9yKGUsIGNiKSkge1xuICAgICAgICAvLyBJTlZBUklBTlQ6IFJvb3QgYWx3YXlzIGV4aXN0cy5cbiAgICAgICAgdGhpcy5tYWtlUm9vdERpcmVjdG9yeShjYik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBwdWJsaWMgcmVuYW1lKG9sZFBhdGg6IHN0cmluZywgbmV3UGF0aDogc3RyaW5nLCBjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIHZhciB0eCA9IHRoaXMuc3RvcmUuYmVnaW5UcmFuc2FjdGlvbigncmVhZHdyaXRlJyksXG4gICAgICBvbGRQYXJlbnQgPSBwYXRoLmRpcm5hbWUob2xkUGF0aCksIG9sZE5hbWUgPSBwYXRoLmJhc2VuYW1lKG9sZFBhdGgpLFxuICAgICAgbmV3UGFyZW50ID0gcGF0aC5kaXJuYW1lKG5ld1BhdGgpLCBuZXdOYW1lID0gcGF0aC5iYXNlbmFtZShuZXdQYXRoKSxcbiAgICAgIGlub2RlczogeyBbcGF0aDogc3RyaW5nXTogSW5vZGUgfSA9IHt9LFxuICAgICAgbGlzdHM6IHtcbiAgICAgICAgW3BhdGg6IHN0cmluZ106IHsgW2ZpbGU6IHN0cmluZ106IHN0cmluZyB9XG4gICAgICB9ID0ge30sXG4gICAgICBlcnJvck9jY3VycmVkOiBib29sZWFuID0gZmFsc2U7XG5cbiAgICAvLyBJbnZhcmlhbnQ6IENhbid0IG1vdmUgYSBmb2xkZXIgaW5zaWRlIGl0c2VsZi5cbiAgICAvLyBUaGlzIGZ1bm55IGxpdHRsZSBoYWNrIGVuc3VyZXMgdGhhdCB0aGUgY2hlY2sgcGFzc2VzIG9ubHkgaWYgb2xkUGF0aFxuICAgIC8vIGlzIGEgc3VicGF0aCBvZiBuZXdQYXJlbnQuIFdlIGFwcGVuZCAnLycgdG8gYXZvaWQgbWF0Y2hpbmcgZm9sZGVycyB0aGF0XG4gICAgLy8gYXJlIGEgc3Vic3RyaW5nIG9mIHRoZSBib3R0b20tbW9zdCBmb2xkZXIgaW4gdGhlIHBhdGguXG4gICAgaWYgKChuZXdQYXJlbnQgKyAnLycpLmluZGV4T2Yob2xkUGF0aCArICcvJykgPT09IDApIHtcbiAgICAgIHJldHVybiBjYihuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVCVVNZLCBvbGRQYXJlbnQpKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXNwb25zaWJsZSBmb3IgUGhhc2UgMiBvZiB0aGUgcmVuYW1lIG9wZXJhdGlvbjogTW9kaWZ5aW5nIGFuZFxuICAgICAqIGNvbW1pdHRpbmcgdGhlIGRpcmVjdG9yeSBsaXN0aW5ncy4gQ2FsbGVkIG9uY2Ugd2UgaGF2ZSBzdWNjZXNzZnVsbHlcbiAgICAgKiByZXRyaWV2ZWQgYm90aCB0aGUgb2xkIGFuZCBuZXcgcGFyZW50J3MgaW5vZGVzIGFuZCBsaXN0aW5ncy5cbiAgICAgKi9cbiAgICB2YXIgdGhlT2xlU3dpdGNoYXJvbyA9ICgpOiB2b2lkID0+IHtcbiAgICAgIC8vIFNhbml0eSBjaGVjazogRW5zdXJlIGJvdGggcGF0aHMgYXJlIHByZXNlbnQsIGFuZCBubyBlcnJvciBoYXMgb2NjdXJyZWQuXG4gICAgICBpZiAoZXJyb3JPY2N1cnJlZCB8fCAhbGlzdHMuaGFzT3duUHJvcGVydHkob2xkUGFyZW50KSB8fCAhbGlzdHMuaGFzT3duUHJvcGVydHkobmV3UGFyZW50KSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB2YXIgb2xkUGFyZW50TGlzdCA9IGxpc3RzW29sZFBhcmVudF0sIG9sZFBhcmVudElOb2RlID0gaW5vZGVzW29sZFBhcmVudF0sXG4gICAgICAgIG5ld1BhcmVudExpc3QgPSBsaXN0c1tuZXdQYXJlbnRdLCBuZXdQYXJlbnRJTm9kZSA9IGlub2Rlc1tuZXdQYXJlbnRdO1xuXG4gICAgICAvLyBEZWxldGUgZmlsZSBmcm9tIG9sZCBwYXJlbnQuXG4gICAgICBpZiAoIW9sZFBhcmVudExpc3Rbb2xkTmFtZV0pIHtcbiAgICAgICAgY2IoQXBpRXJyb3IuRU5PRU5UKG9sZFBhdGgpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBmaWxlSWQgPSBvbGRQYXJlbnRMaXN0W29sZE5hbWVdO1xuICAgICAgICBkZWxldGUgb2xkUGFyZW50TGlzdFtvbGROYW1lXTtcblxuICAgICAgICAvLyBGaW5pc2hlcyBvZmYgdGhlIHJlbmFtaW5nIHByb2Nlc3MgYnkgYWRkaW5nIHRoZSBmaWxlIHRvIHRoZSBuZXdcbiAgICAgICAgLy8gcGFyZW50LlxuICAgICAgICB2YXIgY29tcGxldGVSZW5hbWUgPSAoKSA9PiB7XG4gICAgICAgICAgbmV3UGFyZW50TGlzdFtuZXdOYW1lXSA9IGZpbGVJZDtcbiAgICAgICAgICAvLyBDb21taXQgb2xkIHBhcmVudCdzIGxpc3QuXG4gICAgICAgICAgdHgucHV0KG9sZFBhcmVudElOb2RlLmlkLCBuZXcgQnVmZmVyKEpTT04uc3RyaW5naWZ5KG9sZFBhcmVudExpc3QpKSwgdHJ1ZSwgKGU6IEFwaUVycm9yKSA9PiB7XG4gICAgICAgICAgICBpZiAobm9FcnJvclR4KGUsIHR4LCBjYikpIHtcbiAgICAgICAgICAgICAgaWYgKG9sZFBhcmVudCA9PT0gbmV3UGFyZW50KSB7XG4gICAgICAgICAgICAgICAgLy8gRE9ORSFcbiAgICAgICAgICAgICAgICB0eC5jb21taXQoY2IpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIENvbW1pdCBuZXcgcGFyZW50J3MgbGlzdC5cbiAgICAgICAgICAgICAgICB0eC5wdXQobmV3UGFyZW50SU5vZGUuaWQsIG5ldyBCdWZmZXIoSlNPTi5zdHJpbmdpZnkobmV3UGFyZW50TGlzdCkpLCB0cnVlLCAoZTogQXBpRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAgIGlmIChub0Vycm9yVHgoZSwgdHgsIGNiKSkge1xuICAgICAgICAgICAgICAgICAgICB0eC5jb21taXQoY2IpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKG5ld1BhcmVudExpc3RbbmV3TmFtZV0pIHtcbiAgICAgICAgICAvLyAnbmV3UGF0aCcgYWxyZWFkeSBleGlzdHMuIENoZWNrIGlmIGl0J3MgYSBmaWxlIG9yIGEgZGlyZWN0b3J5LCBhbmRcbiAgICAgICAgICAvLyBhY3QgYWNjb3JkaW5nbHkuXG4gICAgICAgICAgdGhpcy5nZXRJTm9kZSh0eCwgbmV3UGF0aCwgbmV3UGFyZW50TGlzdFtuZXdOYW1lXSwgKGU6IEFwaUVycm9yLCBpbm9kZT86IElub2RlKSA9PiB7XG4gICAgICAgICAgICBpZiAobm9FcnJvclR4KGUsIHR4LCBjYikpIHtcbiAgICAgICAgICAgICAgaWYgKGlub2RlLmlzRmlsZSgpKSB7XG4gICAgICAgICAgICAgICAgLy8gRGVsZXRlIHRoZSBmaWxlIGFuZCBjb250aW51ZS5cbiAgICAgICAgICAgICAgICB0eC5kZWwoaW5vZGUuaWQsIChlPzogQXBpRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAgIGlmIChub0Vycm9yVHgoZSwgdHgsIGNiKSkge1xuICAgICAgICAgICAgICAgICAgICB0eC5kZWwobmV3UGFyZW50TGlzdFtuZXdOYW1lXSwgKGU/OiBBcGlFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChub0Vycm9yVHgoZSwgdHgsIGNiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29tcGxldGVSZW5hbWUoKTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIENhbid0IG92ZXJ3cml0ZSBhIGRpcmVjdG9yeSB1c2luZyByZW5hbWUuXG4gICAgICAgICAgICAgICAgdHguYWJvcnQoKGU/KSA9PiB7XG4gICAgICAgICAgICAgICAgICBjYihBcGlFcnJvci5FUEVSTShuZXdQYXRoKSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb21wbGV0ZVJlbmFtZSgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEdyYWJzIGEgcGF0aCdzIGlub2RlIGFuZCBkaXJlY3RvcnkgbGlzdGluZywgYW5kIHNob3ZlcyBpdCBpbnRvIHRoZVxuICAgICAqIGlub2RlcyBhbmQgbGlzdHMgaGFzaGVzLlxuICAgICAqL1xuICAgIHZhciBwcm9jZXNzSW5vZGVBbmRMaXN0aW5ncyA9IChwOiBzdHJpbmcpOiB2b2lkID0+IHtcbiAgICAgIHRoaXMuZmluZElOb2RlQW5kRGlyTGlzdGluZyh0eCwgcCwgKGU6IEFwaUVycm9yLCBub2RlPzogSW5vZGUsIGRpckxpc3Q/OiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30pOiB2b2lkID0+IHtcbiAgICAgICAgaWYgKGUpIHtcbiAgICAgICAgICBpZiAoIWVycm9yT2NjdXJyZWQpIHtcbiAgICAgICAgICAgIGVycm9yT2NjdXJyZWQgPSB0cnVlO1xuICAgICAgICAgICAgdHguYWJvcnQoKCkgPT4ge1xuICAgICAgICAgICAgICBjYihlKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBJZiBlcnJvciBoYXMgb2NjdXJyZWQgYWxyZWFkeSwganVzdCBzdG9wIGhlcmUuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaW5vZGVzW3BdID0gbm9kZTtcbiAgICAgICAgICBsaXN0c1twXSA9IGRpckxpc3Q7XG4gICAgICAgICAgdGhlT2xlU3dpdGNoYXJvbygpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgcHJvY2Vzc0lub2RlQW5kTGlzdGluZ3Mob2xkUGFyZW50KTtcbiAgICBpZiAob2xkUGFyZW50ICE9PSBuZXdQYXJlbnQpIHtcbiAgICAgIHByb2Nlc3NJbm9kZUFuZExpc3RpbmdzKG5ld1BhcmVudCk7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIHN0YXQocDogc3RyaW5nLCBpc0xzdGF0OiBib29sZWFuLCBjYjogKGVycjogQXBpRXJyb3IsIHN0YXQ/OiBTdGF0cykgPT4gdm9pZCk6IHZvaWQge1xuICAgIHZhciB0eCA9IHRoaXMuc3RvcmUuYmVnaW5UcmFuc2FjdGlvbigncmVhZG9ubHknKTtcbiAgICB0aGlzLmZpbmRJTm9kZSh0eCwgcCwgKGU6IEFwaUVycm9yLCBpbm9kZT86IElub2RlKTogdm9pZCA9PiB7XG4gICAgICBpZiAobm9FcnJvcihlLCBjYikpIHtcbiAgICAgICAgY2IobnVsbCwgaW5vZGUudG9TdGF0cygpKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyBjcmVhdGVGaWxlKHA6IHN0cmluZywgZmxhZzogZmlsZV9mbGFnLkZpbGVGbGFnLCBtb2RlOiBudW1iZXIsIGNiOiAoZTogQXBpRXJyb3IsIGZpbGU/OiBmaWxlLkZpbGUpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB2YXIgdHggPSB0aGlzLnN0b3JlLmJlZ2luVHJhbnNhY3Rpb24oJ3JlYWR3cml0ZScpLFxuICAgICAgZGF0YSA9IG5ldyBCdWZmZXIoMCk7XG5cbiAgICB0aGlzLmNvbW1pdE5ld0ZpbGUodHgsIHAsIEZpbGVUeXBlLkZJTEUsIG1vZGUsIGRhdGEsIChlOiBBcGlFcnJvciwgbmV3RmlsZT86IElub2RlKTogdm9pZCA9PiB7XG4gICAgICBpZiAobm9FcnJvcihlLCBjYikpIHtcbiAgICAgICAgY2IobnVsbCwgbmV3IEFzeW5jS2V5VmFsdWVGaWxlKHRoaXMsIHAsIGZsYWcsIG5ld0ZpbGUudG9TdGF0cygpLCBkYXRhKSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBwdWJsaWMgb3BlbkZpbGUocDogc3RyaW5nLCBmbGFnOiBmaWxlX2ZsYWcuRmlsZUZsYWcsIGNiOiAoZTogQXBpRXJyb3IsIGZpbGU/OiBmaWxlLkZpbGUpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB2YXIgdHggPSB0aGlzLnN0b3JlLmJlZ2luVHJhbnNhY3Rpb24oJ3JlYWRvbmx5Jyk7XG4gICAgLy8gU3RlcCAxOiBHcmFiIHRoZSBmaWxlJ3MgaW5vZGUuXG4gICAgdGhpcy5maW5kSU5vZGUodHgsIHAsIChlOiBBcGlFcnJvciwgaW5vZGU/OiBJbm9kZSkgPT4ge1xuICAgICAgaWYgKG5vRXJyb3IoZSwgY2IpKSB7XG4gICAgICAgIC8vIFN0ZXAgMjogR3JhYiB0aGUgZmlsZSdzIGRhdGEuXG4gICAgICAgIHR4LmdldChpbm9kZS5pZCwgKGU6IEFwaUVycm9yLCBkYXRhPzogTm9kZUJ1ZmZlcik6IHZvaWQgPT4ge1xuICAgICAgICAgIGlmIChub0Vycm9yKGUsIGNiKSkge1xuICAgICAgICAgICAgaWYgKGRhdGEgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICBjYihBcGlFcnJvci5FTk9FTlQocCkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgY2IobnVsbCwgbmV3IEFzeW5jS2V5VmFsdWVGaWxlKHRoaXMsIHAsIGZsYWcsIGlub2RlLnRvU3RhdHMoKSwgZGF0YSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGFsbCB0cmFjZXMgb2YgdGhlIGdpdmVuIHBhdGggZnJvbSB0aGUgZmlsZSBzeXN0ZW0uXG4gICAqIEBwYXJhbSBwIFRoZSBwYXRoIHRvIHJlbW92ZSBmcm9tIHRoZSBmaWxlIHN5c3RlbS5cbiAgICogQHBhcmFtIGlzRGlyIERvZXMgdGhlIHBhdGggYmVsb25nIHRvIGEgZGlyZWN0b3J5LCBvciBhIGZpbGU/XG4gICAqIEB0b2RvIFVwZGF0ZSBtdGltZS5cbiAgICovXG4gIHByaXZhdGUgcmVtb3ZlRW50cnkocDogc3RyaW5nLCBpc0RpcjogYm9vbGVhbiwgY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB2YXIgdHggPSB0aGlzLnN0b3JlLmJlZ2luVHJhbnNhY3Rpb24oJ3JlYWR3cml0ZScpLFxuICAgICAgcGFyZW50OiBzdHJpbmcgPSBwYXRoLmRpcm5hbWUocCksIGZpbGVOYW1lOiBzdHJpbmcgPSBwYXRoLmJhc2VuYW1lKHApO1xuICAgIC8vIFN0ZXAgMTogR2V0IHBhcmVudCBkaXJlY3RvcnkncyBub2RlIGFuZCBkaXJlY3RvcnkgbGlzdGluZy5cbiAgICB0aGlzLmZpbmRJTm9kZUFuZERpckxpc3RpbmcodHgsIHBhcmVudCwgKGU6IEFwaUVycm9yLCBwYXJlbnROb2RlPzogSW5vZGUsIHBhcmVudExpc3Rpbmc/OiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30pOiB2b2lkID0+IHtcbiAgICAgIGlmIChub0Vycm9yVHgoZSwgdHgsIGNiKSkge1xuICAgICAgICBpZiAoIXBhcmVudExpc3RpbmdbZmlsZU5hbWVdKSB7XG4gICAgICAgICAgdHguYWJvcnQoKCkgPT4ge1xuICAgICAgICAgICAgY2IoQXBpRXJyb3IuRU5PRU5UKHApKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBSZW1vdmUgZnJvbSBkaXJlY3RvcnkgbGlzdGluZyBvZiBwYXJlbnQuXG4gICAgICAgICAgdmFyIGZpbGVOb2RlSWQgPSBwYXJlbnRMaXN0aW5nW2ZpbGVOYW1lXTtcbiAgICAgICAgICBkZWxldGUgcGFyZW50TGlzdGluZ1tmaWxlTmFtZV07XG4gICAgICAgICAgLy8gU3RlcCAyOiBHZXQgZmlsZSBpbm9kZS5cbiAgICAgICAgICB0aGlzLmdldElOb2RlKHR4LCBwLCBmaWxlTm9kZUlkLCAoZTogQXBpRXJyb3IsIGZpbGVOb2RlPzogSW5vZGUpOiB2b2lkID0+IHtcbiAgICAgICAgICAgIGlmIChub0Vycm9yVHgoZSwgdHgsIGNiKSkge1xuICAgICAgICAgICAgICBpZiAoIWlzRGlyICYmIGZpbGVOb2RlLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgICAgICAgICB0eC5hYm9ydCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICBjYihBcGlFcnJvci5FSVNESVIocCkpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKGlzRGlyICYmICFmaWxlTm9kZS5pc0RpcmVjdG9yeSgpKSB7XG4gICAgICAgICAgICAgICAgdHguYWJvcnQoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgY2IoQXBpRXJyb3IuRU5PVERJUihwKSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gU3RlcCAzOiBEZWxldGUgZGF0YS5cbiAgICAgICAgICAgICAgICB0eC5kZWwoZmlsZU5vZGUuaWQsIChlPzogQXBpRXJyb3IpOiB2b2lkID0+IHtcbiAgICAgICAgICAgICAgICAgIGlmIChub0Vycm9yVHgoZSwgdHgsIGNiKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBTdGVwIDQ6IERlbGV0ZSBub2RlLlxuICAgICAgICAgICAgICAgICAgICB0eC5kZWwoZmlsZU5vZGVJZCwgKGU/OiBBcGlFcnJvcik6IHZvaWQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChub0Vycm9yVHgoZSwgdHgsIGNiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gU3RlcCA1OiBVcGRhdGUgZGlyZWN0b3J5IGxpc3RpbmcuXG4gICAgICAgICAgICAgICAgICAgICAgICB0eC5wdXQocGFyZW50Tm9kZS5pZCwgbmV3IEJ1ZmZlcihKU09OLnN0cmluZ2lmeShwYXJlbnRMaXN0aW5nKSksIHRydWUsIChlOiBBcGlFcnJvcik6IHZvaWQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobm9FcnJvclR4KGUsIHR4LCBjYikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eC5jb21taXQoY2IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyB1bmxpbmsocDogc3RyaW5nLCBjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMucmVtb3ZlRW50cnkocCwgZmFsc2UsIGNiKTtcbiAgfVxuXG4gIHB1YmxpYyBybWRpcihwOiBzdHJpbmcsIGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgLy8gQ2hlY2sgZmlyc3QgaWYgZGlyZWN0b3J5IGlzIGVtcHR5LlxuICAgIHRoaXMucmVhZGRpcihwLCAoZXJyLCBmaWxlcz8pID0+IHtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgY2IoZXJyKTtcbiAgICAgIH0gZWxzZSBpZiAoZmlsZXMubGVuZ3RoID4gMCkge1xuICAgICAgICBjYihBcGlFcnJvci5FTk9URU1QVFkocCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5yZW1vdmVFbnRyeShwLCB0cnVlLCBjYik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBwdWJsaWMgbWtkaXIocDogc3RyaW5nLCBtb2RlOiBudW1iZXIsIGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdmFyIHR4ID0gdGhpcy5zdG9yZS5iZWdpblRyYW5zYWN0aW9uKCdyZWFkd3JpdGUnKSxcbiAgICAgIGRhdGEgPSBuZXcgQnVmZmVyKCd7fScpO1xuICAgIHRoaXMuY29tbWl0TmV3RmlsZSh0eCwgcCwgRmlsZVR5cGUuRElSRUNUT1JZLCBtb2RlLCBkYXRhLCBjYik7XG4gIH1cblxuICBwdWJsaWMgcmVhZGRpcihwOiBzdHJpbmcsIGNiOiAoZXJyOiBBcGlFcnJvciwgZmlsZXM/OiBzdHJpbmdbXSkgPT4gdm9pZCk6IHZvaWQge1xuICAgIHZhciB0eCA9IHRoaXMuc3RvcmUuYmVnaW5UcmFuc2FjdGlvbigncmVhZG9ubHknKTtcbiAgICB0aGlzLmZpbmRJTm9kZSh0eCwgcCwgKGU6IEFwaUVycm9yLCBpbm9kZT86IElub2RlKSA9PiB7XG4gICAgICBpZiAobm9FcnJvcihlLCBjYikpIHtcbiAgICAgICAgdGhpcy5nZXREaXJMaXN0aW5nKHR4LCBwLCBpbm9kZSwgKGU6IEFwaUVycm9yLCBkaXJMaXN0aW5nPzoge1tuYW1lOiBzdHJpbmddOiBzdHJpbmd9KSA9PiB7XG4gICAgICAgICAgaWYgKG5vRXJyb3IoZSwgY2IpKSB7XG4gICAgICAgICAgICBjYihudWxsLCBPYmplY3Qua2V5cyhkaXJMaXN0aW5nKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyBfc3luYyhwOiBzdHJpbmcsIGRhdGE6IE5vZGVCdWZmZXIsIHN0YXRzOiBTdGF0cywgY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkIHtcbiAgICAvLyBAdG9kbyBFbnN1cmUgbXRpbWUgdXBkYXRlcyBwcm9wZXJseSwgYW5kIHVzZSB0aGF0IHRvIGRldGVybWluZSBpZiBhIGRhdGFcbiAgICAvLyAgICAgICB1cGRhdGUgaXMgcmVxdWlyZWQuXG4gICAgdmFyIHR4ID0gdGhpcy5zdG9yZS5iZWdpblRyYW5zYWN0aW9uKCdyZWFkd3JpdGUnKTtcbiAgICAvLyBTdGVwIDE6IEdldCB0aGUgZmlsZSBub2RlJ3MgSUQuXG4gICAgdGhpcy5fZmluZElOb2RlKHR4LCBwYXRoLmRpcm5hbWUocCksIHBhdGguYmFzZW5hbWUocCksIChlOiBBcGlFcnJvciwgZmlsZUlub2RlSWQ/OiBzdHJpbmcpOiB2b2lkID0+IHtcbiAgICAgIGlmIChub0Vycm9yVHgoZSwgdHgsIGNiKSkge1xuICAgICAgICAvLyBTdGVwIDI6IEdldCB0aGUgZmlsZSBpbm9kZS5cbiAgICAgICAgdGhpcy5nZXRJTm9kZSh0eCwgcCwgZmlsZUlub2RlSWQsIChlOiBBcGlFcnJvciwgZmlsZUlub2RlPzogSW5vZGUpOiB2b2lkID0+IHtcbiAgICAgICAgICBpZiAobm9FcnJvclR4KGUsIHR4LCBjYikpIHtcbiAgICAgICAgICAgIHZhciBpbm9kZUNoYW5nZWQ6IGJvb2xlYW4gPSBmaWxlSW5vZGUudXBkYXRlKHN0YXRzKTtcbiAgICAgICAgICAgIC8vIFN0ZXAgMzogU3luYyB0aGUgZGF0YS5cbiAgICAgICAgICAgIHR4LnB1dChmaWxlSW5vZGUuaWQsIGRhdGEsIHRydWUsIChlOiBBcGlFcnJvcik6IHZvaWQgPT4ge1xuICAgICAgICAgICAgICBpZiAobm9FcnJvclR4KGUsIHR4LCBjYikpIHtcbiAgICAgICAgICAgICAgICAvLyBTdGVwIDQ6IFN5bmMgdGhlIG1ldGFkYXRhIChpZiBpdCBjaGFuZ2VkKSFcbiAgICAgICAgICAgICAgICBpZiAoaW5vZGVDaGFuZ2VkKSB7XG4gICAgICAgICAgICAgICAgICB0eC5wdXQoZmlsZUlub2RlSWQsIGZpbGVJbm9kZS50b0J1ZmZlcigpLCB0cnVlLCAoZTogQXBpRXJyb3IpOiB2b2lkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5vRXJyb3JUeChlLCB0eCwgY2IpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgdHguY29tbWl0KGNiKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIC8vIE5vIG5lZWQgdG8gc3luYyBtZXRhZGF0YTsgcmV0dXJuLlxuICAgICAgICAgICAgICAgICAgdHguY29tbWl0KGNiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==