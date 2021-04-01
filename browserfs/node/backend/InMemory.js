"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var kvfs = require('../generic/key_value_filesystem');
var InMemoryStore = (function () {
    function InMemoryStore() {
        this.store = {};
    }
    InMemoryStore.prototype.name = function () { return 'In-memory'; };
    InMemoryStore.prototype.clear = function () { this.store = {}; };
    InMemoryStore.prototype.beginTransaction = function (type) {
        return new kvfs.SimpleSyncRWTransaction(this);
    };
    InMemoryStore.prototype.get = function (key) {
        return this.store[key];
    };
    InMemoryStore.prototype.put = function (key, data, overwrite) {
        if (!overwrite && this.store.hasOwnProperty(key)) {
            return false;
        }
        this.store[key] = data;
        return true;
    };
    InMemoryStore.prototype.del = function (key) {
        delete this.store[key];
    };
    return InMemoryStore;
}());
exports.InMemoryStore = InMemoryStore;
var InMemoryFileSystem = (function (_super) {
    __extends(InMemoryFileSystem, _super);
    function InMemoryFileSystem() {
        _super.call(this, { store: new InMemoryStore() });
    }
    return InMemoryFileSystem;
}(kvfs.SyncKeyValueFileSystem));
exports.__esModule = true;
exports["default"] = InMemoryFileSystem;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSW5NZW1vcnkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvYmFja2VuZC9Jbk1lbW9yeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxJQUFPLElBQUksV0FBVyxpQ0FBaUMsQ0FBQyxDQUFDO0FBS3pEO0lBQUE7UUFDVSxVQUFLLEdBQWtDLEVBQUUsQ0FBQztJQXdCcEQsQ0FBQztJQXRCUSw0QkFBSSxHQUFYLGNBQWdCLE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO0lBQzlCLDZCQUFLLEdBQVosY0FBaUIsSUFBSSxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBRTVCLHdDQUFnQixHQUF2QixVQUF3QixJQUFZO1FBQ2xDLE1BQU0sQ0FBQyxJQUFJLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNoRCxDQUFDO0lBRU0sMkJBQUcsR0FBVixVQUFXLEdBQVc7UUFDcEIsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDekIsQ0FBQztJQUVNLDJCQUFHLEdBQVYsVUFBVyxHQUFXLEVBQUUsSUFBZ0IsRUFBRSxTQUFrQjtRQUMxRCxFQUFFLENBQUMsQ0FBQyxDQUFDLFNBQVMsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDakQsTUFBTSxDQUFDLEtBQUssQ0FBQztRQUNmLENBQUM7UUFDRCxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQztRQUN2QixNQUFNLENBQUMsSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVNLDJCQUFHLEdBQVYsVUFBVyxHQUFXO1FBQ3BCLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUN6QixDQUFDO0lBQ0gsb0JBQUM7QUFBRCxDQUFDLEFBekJELElBeUJDO0FBekJZLHFCQUFhLGdCQXlCekIsQ0FBQTtBQUtEO0lBQWdELHNDQUEyQjtJQUN6RTtRQUNFLGtCQUFNLEVBQUUsS0FBSyxFQUFFLElBQUksYUFBYSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQ3hDLENBQUM7SUFDSCx5QkFBQztBQUFELENBQUMsQUFKRCxDQUFnRCxJQUFJLENBQUMsc0JBQXNCLEdBSTFFO0FBSkQ7dUNBSUMsQ0FBQSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBrdmZzID0gcmVxdWlyZSgnLi4vZ2VuZXJpYy9rZXlfdmFsdWVfZmlsZXN5c3RlbScpO1xuXG4vKipcbiAqIEEgc2ltcGxlIGluLW1lbW9yeSBrZXktdmFsdWUgc3RvcmUgYmFja2VkIGJ5IGEgSmF2YVNjcmlwdCBvYmplY3QuXG4gKi9cbmV4cG9ydCBjbGFzcyBJbk1lbW9yeVN0b3JlIGltcGxlbWVudHMga3Zmcy5TeW5jS2V5VmFsdWVTdG9yZSwga3Zmcy5TaW1wbGVTeW5jU3RvcmUge1xuICBwcml2YXRlIHN0b3JlOiB7IFtrZXk6IHN0cmluZ106IE5vZGVCdWZmZXIgfSA9IHt9O1xuXG4gIHB1YmxpYyBuYW1lKCkgeyByZXR1cm4gJ0luLW1lbW9yeSc7IH1cbiAgcHVibGljIGNsZWFyKCkgeyB0aGlzLnN0b3JlID0ge307IH1cblxuICBwdWJsaWMgYmVnaW5UcmFuc2FjdGlvbih0eXBlOiBzdHJpbmcpOiBrdmZzLlN5bmNLZXlWYWx1ZVJXVHJhbnNhY3Rpb24ge1xuICAgIHJldHVybiBuZXcga3Zmcy5TaW1wbGVTeW5jUldUcmFuc2FjdGlvbih0aGlzKTtcbiAgfVxuXG4gIHB1YmxpYyBnZXQoa2V5OiBzdHJpbmcpOiBOb2RlQnVmZmVyIHtcbiAgICByZXR1cm4gdGhpcy5zdG9yZVtrZXldO1xuICB9XG5cbiAgcHVibGljIHB1dChrZXk6IHN0cmluZywgZGF0YTogTm9kZUJ1ZmZlciwgb3ZlcndyaXRlOiBib29sZWFuKTogYm9vbGVhbiB7XG4gICAgaWYgKCFvdmVyd3JpdGUgJiYgdGhpcy5zdG9yZS5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHRoaXMuc3RvcmVba2V5XSA9IGRhdGE7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBwdWJsaWMgZGVsKGtleTogc3RyaW5nKTogdm9pZCB7XG4gICAgZGVsZXRlIHRoaXMuc3RvcmVba2V5XTtcbiAgfVxufVxuXG4vKipcbiAqIEEgc2ltcGxlIGluLW1lbW9yeSBmaWxlIHN5c3RlbSBiYWNrZWQgYnkgYW4gSW5NZW1vcnlTdG9yZS5cbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgSW5NZW1vcnlGaWxlU3lzdGVtIGV4dGVuZHMga3Zmcy5TeW5jS2V5VmFsdWVGaWxlU3lzdGVtIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoeyBzdG9yZTogbmV3IEluTWVtb3J5U3RvcmUoKSB9KTtcbiAgfVxufVxuIl19