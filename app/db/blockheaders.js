/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/
let obj = null;
const util = require('util');
const entity = require('./types/entry');
const config = require('../../config')

var pool = function () {
    this.dbname = config.net == 'mainnet' ? 'blockchain.dat' : 'blockchain.testnet.dat';
    this.name = 'headers';
    this.init();
}

util.inherits(pool, entity);

pool.prototype.getLastBlocks = function (limit, offset) {

    if (!limit)
        limit = 1;
    if (!offset)
        offset = 0

    var arr = this.getDB().gc(this.name).chain().find().simplesort('time', true).offset(offset).limit(limit).data();
    return arr;

}

pool.prototype.findBlocks = function (fields) {
    var arr = this.getDB().gc(this.name).chain().find(fields).data();
    return arr;

}

pool.prototype.getLastBlock = function () {

    var arr = this.getDB().gc(this.name).chain().find().simplesort('time', true).limit(1).offset(0).data();
    return arr[0];

}

pool.prototype.loadBlocks = function (cnt, offset) {
    return this.load(cnt, offset, ['time', false]) || false;

}

pool.prototype.blockCount = function () {
    return this.count() || 0;

}

pool.prototype.getBlock = function (hash) {
    var block = this.get(hash);
    if (!block)
        throw new Error('can not find block ' + hash);
    return block
}

pool.prototype.removeBlock = function (block) {
    this.remove(block.hash);
}

module.exports = obj?obj:obj = new pool;