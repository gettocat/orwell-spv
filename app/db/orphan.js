/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

var kventity = require('./types/index');
var util = require('util');
var config = require('../../config');
var chainEvents = require('../events')

var _cache = {};
var obj = null;

var orphan = function () {
    this.name = 'orphan';
    this.options = {};
    this.options.inmemory = false;
    this.init();
}

util.inherits(orphan, kventity);

orphan.prototype.setAndCache = function (key, val) {
    _cache[key] = val
    this.set(key, val);
}

orphan.prototype.getAndCache = function (key) {
    return _cache[key] || this.get(key)
}

orphan.prototype.getList = function () {
    var arr = this.getAndCache('orphanlist');
    if (!arr || !(arr instanceof Array))
        arr = [];
    return arr;
}

orphan.prototype.setList = function (arr) {
    this.setAndCache('orphanlist', arr || []);
    return arr || [];
}

orphan.prototype.getCount = function () {
    return this.getList().length;
}

orphan.prototype.add = function (blockjson) {
    if (config.debug.blockchain.orphanblock)
        debug("add block to orphan: " + blockjson.hash)
    var obj = this.getAndCache(blockjson.hash);
    if (!obj || !obj.hash) {

        var list = this.getList();
        if (!list || !(list instanceof Array))
            list = [];

        if (list.indexOf(blockjson.hash) < 0)
            list.push(blockjson.hash);

        this.setList(list);
        this.setAndCache(blockjson.hash, blockjson);
        return true;
    }

    return false;
}

orphan.prototype.del = function (hash) {

    var list = this.getList();
    if (!list || !(list instanceof Array))
        list = [];

    list.splice(list.indexOf(hash), 1);
    this.setList(list);
    delete _cache[hash];
    this.remove(hash);
}

orphan.prototype.seekHash = function (hash) {
    chainEvents.emit("chain.block.seek", { hash: hash })
}

orphan.prototype.checkBlock = function (block) {
    var arr = [block];
    do {
        var b = block.prev_block;
        block = this.getAndCache(block.prev_block);
        if (config.debug.blockchain.orphanblock)
            debug("find prev in orphan " + b, !!block.hash)
        if (block.hash)
            arr.push(block);
    } while (block.hash);


    var blockchain = require("./blockchain");
    var indexes = require("./indexes");
    var _block = {};
    try {
        _block = blockchain.getBlock(arr[arr.length - 1].prev_block);
    } catch (e) {

    }

    if (config.debug.blockchain.orphanblock)
        debug("find prev in mainchain " + arr[arr.length - 1].prev_block, !!_block.hash)
    if (_block && _block.hash) {
        if (config.debug.blockchain.orphanblock)
            debug("have block " + arr[arr.length - 1].prev_block + " in main chain")
        var height = indexes.get("block/" + _block.hash).height;
        if (height + arr.length > indexes.get('top').height) {
            if (config.debug.blockchain.orphanblock)
                debug("height of block in mainchain " + height + ", common length " + (height + arr.length) + ",  top height: " + indexes.get('top').height + ", merge main chain!");
            //replace mainchain with this chain
            if (config.debug.blockchain.orphanblock)
                debug("*** START MERGE BRANCH: ***")

            var startheight = height + 1;
            for (var i = arr.length - 1; i >= 0; i-- , startheight++) {

                var binfo = indexes.get("index/" + startheight);
                //this height is bigger, so can be situation, when this index is not exist
                if (typeof binfo == 'string') {
                    if (config.debug.blockchain.orphanblock)
                        debug("find hash in mainchain ", binfo, "height", startheight)
                    var b = blockchain.getBlock(binfo);
                    blockchain.replaceBlock(startheight, b.hash, arr[i]);
                    if (config.debug.blockchain.orphanblock)
                        debug("replace blocks", b.hash, "->", arr[i].hash);
                    this.del(arr[i].hash);
                    if (config.debug.blockchain.orphanblock)
                        debug("remove From Orphan", arr[i].hash);
                    this.add(b);
                } else {
                    if (config.debug.blockchain.orphanblock)
                        debug("not finded hash in mainchain ", binfo, "height", startheight, "add as new")
                    var f = this;
                    blockchain.appendBlockFromJSON(arr[i], function (block, isExist, iMainChain) {
                        if (config.debug.blockchain.orphanblock)
                            debug("remove From Orphan", block.hash);
                        f.del(block.hash);
                    });
                }

            }

            blockchain.hardReIndexing();

            if (config.debug.blockchain.orphanblock)
                debug("*** STOP MERGE BRANCH: ***")
        } else {
            if (config.debug.blockchain.orphanblock)
                debug("height of block in mainchain " + height + ", common length " + (height + arr.length) + ",  top height: " + indexes.get('top').height + ", dont merge main chain!");
            if (indexes.get('top').height - height + arr.length > 100) {//do not save orphan block more that 100 height over
                if (config.debug.blockchain.orphanblock)
                    debug("height-range of blocks is more than 100, remove from orphan");
                for (var i in arr) {
                    this.del(arr[i].hash);
                }
            }
        }
    } else {
        if (config.debug.blockchain.orphanblock)
            debug("havent block " + arr[arr.length - 1].prev_block + " in main chain, send getblock")
        //send inv with this block
        this.seekHash(arr[arr.length - 1].prev_block)
    }


}

orphan.prototype.findChilds = function (hash) {
    var list = this.getList();
    var childs = [];
    for (var i in list) {
        var block = this.getAndCache(list[i]);
        if (block && block.hash) {
            if (block.prev_block == hash || block.hashPrevBlock == hash) {
                childs.push(block);
            }
        }
    }

    return childs;
}

orphan.prototype.findChildsRecursive = function (hash, data, level) {
    if (!Number.isFinite(level))
        data = {};
    if (!Number.isFinite(level))
        level = 0;

    var arr = this.findChilds(hash);
    if (data[level] && data[level].childs && arr.length) {
        data[level].childs = data[level].childs.concat(arr);
    } else if (arr.length)
        data[level] = { level: level, childs: arr };
    for (var i in arr) {
        if (arr[i] && arr[i].hash)
            data = this.findChildsRecursive(arr[i].hash, data, level + 1)
    }

    return data;

}

orphan.prototype.getMaxPath = function (childs) {

    var arr = Object.keys(childs);
    var maxKey = Math.max.apply(null, arr);
    var maxData = childs[maxKey];
    if (!maxData || !maxData.childs || maxData.childs.length != 1)//do nothing if we have more then one childs (wait for next orphan)
        return false;

    return maxKey;

}

orphan.prototype.tryLongest = function (hash) {
    //find all childs on all levels, choose longest chain and send event.
    var childsByLevel = this.findChildsRecursive(hash, {}, 0)
    //if (config.debug.blockchain.orphanblock)
    //debug('childs by level', JSON.stringify(childsByLevel))
    var biggestPath = this.getMaxPath(childsByLevel);
    if (config.debug.blockchain.orphanblock && biggestPath)
        debug("orphan db contain longest for hash " + hash, biggestPath);
    if (biggestPath) {
        var maxValue = childsByLevel[biggestPath];
        var orphanTop = maxValue.childs[0];
        if (orphanTop && orphanTop.hash) {
            if (config.debug.blockchain.orphanblock)
                debug("we have longest path for " + hash + ", try to use as mainchain")
            //now we have chain, where head in orphan db, and tail in main chain. Now we need check - can we use this chain as main chain
            return this.checkBlock(orphanTop);
        }
    }

    return false;
}

orphan.prototype.check = function (hash) {

    var block = this.getAndCache(hash);
    if (config.debug.blockchain.orphanblock)
        debug("get block " + hash, block.prev_block, !!block.hash)
    if (!block || !block.hash)
        return false;

    return this.checkBlock(block);

}

orphan.prototype.have = function (hash) {
    var block = this.getAndCache(hash);
    if (!block || !block.hash)
        return false;

    return true;
}

module.exports = obj ? obj : obj = new orphan;