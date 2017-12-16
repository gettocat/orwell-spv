/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

var Tx = require("./tx")
var merkle = require('./merkle');
var util = require('./util');
var hash = require('../../crypto');
var protocol = require('../../network/protocol')
var blockvalidator = require('./blockvalidator')
var bitPony = require('bitpony')
require('./bitpony_extends');

var block = function (header, txList) {
    if (header)
        this.header = header;
    if (txList instanceof Array)
        this.vtx = txList;
    else
        this.vtx = [];

    if (this.header)
        this.setBlockHeader();
}

block.prototype = {
    vtx: [],
    validation_erros: [],
    header: null,
    merkle: null,
    hash: null,
    nonce: 0,
    setBlockHeader: function () {
        this.version = this.header.version;
        this.hashPrevBlock = this.header.hashPrevBlock;
        this.hashMerkleRoot = this.merkle = this.header.hashMerkleRoot;
        this.time = this.header.time;
        this.bits = this.header.bits;
        this.nonce = this.header.nonce;
        this.index = this.height = this.header.height;
        if (this.header.hash)
            this.hash = this.header.hash;
    },
    getBlockHeader: function () {
        var h = {};
        h.version = this.version;
        h.hashPrevBlock = this.hashPrevBlock;
        h.hashMerkleRoot = this.hashMerkleRoot || this.merkle;
        h.time = this.time;
        h.bits = this.bits;
        h.nonce = this.nonce;
        h.index = h.height = this.height
        return h;
    },
    addTx: function (hex) {
        var t = new Tx();
        t.fromHex(hex);
        this.vtx.push(t);
        return this;
    },
    addTxList: function (hexArr) {
        for (var i in hexArr) {
            if (hexArr[i])
                this.vtx.push(hexArr[i])
        }
        return this;
    },
    generate: function () {

        var ids = [];
        for (var i in this.vtx) {
            if (this.vtx[i])
                ids.push(this.vtx[i].getId())
        }



        var hash = merkle.tree(ids);
        return this.merkle = hash;
    },
    getHash: function (format) {
        //new block
        if (!this.hash || format == 'raw') {

            var header =
                util.littleEndian(this.version).toString('hex')
                + util.reverseBuffer(new Buffer(this.hashPrevBlock, 'hex')).toString('hex')
                + util.reverseBuffer(new Buffer(this.merkle, 'hex')).toString('hex')
                + util.littleEndian(this.time).toString('hex')
                + util.littleEndian(this.bits).toString('hex')
                + util.littleEndian(this.nonce).toString('hex'),
                h = util.reverseBuffer(hash.sha256(hash.sha256(new Buffer(header, 'hex'))));


            if (format == 'hex')
                return this.hash = h.toString('hex');
            else
                return h;
        } else {
            return this.hash;
        }
    },
    hashBytes: function () {
        var header =
            util.littleEndian(this.version).toString('hex')
            + util.reverseBuffer(new Buffer(this.hashPrevBlock, 'hex')).toString('hex')
            + util.reverseBuffer(new Buffer(this.merkle, 'hex')).toString('hex')
            + util.littleEndian(this.time).toString('hex')
            + util.littleEndian(this.bits).toString('hex')
            + util.littleEndian(this.nonce).toString('hex')

        return util.reverseBuffer(hash.sha256(hash.sha256(new Buffer(header, 'hex'))));
    },
    getFee: function () {
        //for all tx.getFee() ++
    },
    getHex: function () {
        if (this.hex)
            return this.hex;

        var header =
            util.littleEndian(this.version).toString('hex')
            + util.reverseBuffer(new Buffer(this.hashPrevBlock, 'hex')).toString('hex')
            + util.reverseBuffer(new Buffer(this.merkle, 'hex')).toString('hex')
            + util.littleEndian(this.time).toString('hex')
            + util.littleEndian(this.bits).toString('hex')
            + util.littleEndian(this.nonce).toString('hex');

        var hexstr = util.numHex(this.vtx.length);
        for (var i in this.vtx) {
            if (this.vtx[i])
                hexstr += this.vtx[i].toHex()
        }

        return this.hex = header + hexstr;
    },
    toJSON: function () {

        var obj1 = {
            "hash": this.hash || this.getHash(),
            "ver": this.version,
            "prev_block": this.hashPrevBlock,
            "mrkl_root": this.merkle ? this.merkle : this.generate(),
            "time": this.time,
            "bits": this.bits,
            "fee": this.getFee(),
            "nonce": this.nonce,
            "n_tx": this.vtx.length,
            "size": new Buffer(this.getHex(), 'hex').length,
            "block_index": this.index,
            "height": this.height,
            "tx": [
            ]
        }

        for (var i in this.vtx) {
            if (this.vtx[i])
                obj1.tx.push(this.vtx[i].toJSON());
        }

        return obj1;
    },
    fromHex: function (hex) {

        var block = bitPony.orwell_block.read(hex, true);
        this.header = {
            version: block.header.version,
            hashPrevBlock: block.header.prev_block,
            prev_block: block.header.prev_block,
            hashMerkleRoot: block.header.merkle_root,
            merkle: block.header.merkle_root,
            time: block.header.timestamp,
            bits: block.header.bits,
            nonce: block.header.nonce,
        }

        this.setBlockHeader();
        this.getHash('hex');
        for (var i in block.txns) {
            var t = (function (txbody) {
                var t = new Tx();
                return t.fromHex(txbody)
            })(block.txns[i])
            this.vtx.push(t);

        }

        return this;
    },
    fromJSON: function (json) {

        if (typeof json.bits == 'string')
            json.bits = parseInt(json.bits, 16);

        this.header = {
            index: json.index,
            version: json.ver,
            hashPrevBlock: json.prev_block,
            prev_block: json.prev_block,
            hashMerkleRoot: json.mrkl_root,
            merkle: json.mrkl_root,
            time: json.time,
            bits: json.bits,
            nonce: json.nonce,
            height: json.height,
            hash: json.hash,
        }

        this.setBlockHeader();
        for (var i in json.tx) {
            var t = new Tx();
            t.fromJSON(json.tx[i])
            this.vtx.push(t);

        }

        return this;

    },
    isValid: function () {
        //todo check block
        var val = new blockvalidator(this);
        var res = val.isValidBlock();
        if (!res)
            this.validation_erros = val.getErrors();

        return res;
    }
}


module.exports = block;