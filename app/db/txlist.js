/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/
let obj = null;
const util = require('util');
const entity = require('./types/entry');
const utl = require('./blockchain/util')
const config = require('../../config');

var txlist = function () {
    this.dbname = config.net == 'mainnet' ? 'blockchain.dat' : 'blockchain.testnet.dat';
    this.name = 'txlist';
    this.init();
}

util.inherits(txlist, entity);

txlist.prototype.setFilter = function (hexfilter) {
    this.filter = hexfilter || 'none';
}

txlist.prototype.getFilter = function () {
    return this.filter;
}

txlist.prototype.appendTx = function (hashlist) {

    var arr = this.getKey(this.filter);
    if (!arr || !(arr instanceof Array))
        arr = [];

    if (!(hashlist instanceof Array))
        hashlist = [hashlist]

    arr = arr.concat(hashlist);
    arr = utl.uniquely(arr);
    this.setKey(this.filter, arr);
    return arr;

}

txlist.prototype.clear = function () {
    this.removeKey(this.filter);
}

txlist.prototype.getList = function () {
    var arr = this.getKey(this.filter);
    if (!arr || !(arr instanceof Array))
        arr = [];

    return arr;
}

txlist.prototype.count = function () {
    return this.getList().length;
}

txlist.prototype.findNoBody = function (offset, count) {
    //find all tx in txlist, that no have body.
    var empty = [];
    var list = this.getKey(this.filter);
    for (var i in list) {
        var tx = this.getKey(list[i]);
        if (!tx || !tx.hash)
            empty.push(list[i])
    }

    return empty.slice(offset, offset + count);
}

txlist.prototype.saveBody = function (json) {

    var empty = [];
    var list = this.getKey(this.filter);
    if (list.indexOf(json.hash) == -1)
        throw new Error('txbody ' + json.hash + ' is not called');

    var info = this.getKey(json.hash);
    if (info.hash)
        return false;//already exist

    this.setKey("tx/block/" + json.hash, json.fromBlock);
    this.setKey(json.hash, json);
    return true;
}

txlist.prototype.getTx = function (hash) {
    var info = this.getKey(hash);
    if (!info || !info.hash)
        return false;

    return info
}

txlist.prototype.getOut = function (hash, index) {
    var tx = this.getTx(hash);
    if (!tx)
        throw new Error('can not find tx ' + hash);

    return tx.out[index];
}

txlist.prototype.getHeight = function (hash) {
    const { indexes } = require("./blockchain")
    return indexes.get("block/" + this.getKey("tx/block/" + hash)).height;
}

txlist.prototype.UTXOupdgrateList = function (list) {
    for (var i in list) {
        var height = -1;
        if (list[i].spentHash) {
            height = this.getHeight(list[i].spentHash) || -1
        } else {
            height = this.getHeight(list[i].tx) || -1
        }

        list[i].height = height;
    }

    return list;
}

module.exports = obj ? obj : obj = new txlist;