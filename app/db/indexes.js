/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

var events = require('../events')
var kventity = require('./types/index');
var config = require('../../config');
var util = require('util');

var obj = null;
var blockindexes = function () {
    this.name = 'blockindexes';
    this.options = { inmemory: config.blockchain.persistenindex };
    this.init();
}

util.inherits(blockindexes, kventity);

blockindexes.prototype.updateTop = function (data) {
    const oldtop = this.get('top');
    this.set('top', data);
    var t = this.get('top');
    if (config.debug.blockchain.sync)
        debug("new top: " + t.hash + ", height: " + t.height);

    events.emit("chain.top.update", t, oldtop);
};

blockindexes.prototype.haveblock = function (hash) {
    const { chain, orphan } = require('./blockchain')
    try {
        var block = chain.getBlock(hash);

        if (block.hash)
            return true;
    } catch (e) {
    }


    if (orphan.have(hash)) {

        return true;
    }

    //todo memory add for invalid blocks
    return false;
}

module.exports = obj ? obj : obj = new blockindexes;
