/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

var txParser = require('./tx_parse');
var txBuilder = require('./tx_build');
var hash = require('../../crypto');
var bitPony = require('bitpony');
var Script = require('./script')

var transaction = function (hex) {
    if (hex)
        this.hex = hex;
}

transaction.prototype = {
    hex: '',
    json: null,
    inputs: [],
    outputs: [],
    coinbase: 0,
    isValidTransaction: 1,
    datascript: null,
    fromCoinBase: function (data, addr, amount, sequence) {
        this.coinbase = 1;
        var tx = new txBuilder();
        var out = [];
        out.push({
            amount: amount,
            scriptPubKey: Script.addrToScript(addr)
        });

        var inp = { scriptSig: new Buffer(data).toString('hex') };

        if (sequence)
            inp.sequence = sequence;
        tx.setCoinbase(inp, out).generate();
        this.hex = tx.getCoinBase();
        this.fromHex();
        return this;
    },
    fromCoinBaseWithManyOut: function (data, out, sequence) {
        this.coinbase = 1;
        var tx = new txBuilder();
        var inp = { scriptSig: data };
        if (sequence)
            inp.sequence = sequence;
        tx.setCoinbase(inp, out).generate();
        this.hex = tx.getCoinBase();
        this.fromHex();
        return this;
    },
    setHex: function (hex) {
        this.hex = hex;
        return this;
    },
    setVersion: function (val) {
        this.version = val
        return this
    },
    setDataScript: function (val) {
        this.datascript = (val)
        return this
    },
    setLockTime: function (val) {
        this.lock_time = val;
        return this;
    },
    setInputs: function (arr) {
        this.inputs = arr;
        return this;
    },
    setOutputs: function (arr) {
        this.outputs = arr;
        return this;
    },
    fromJSON: function (jsonobj) {
        var t = new txBuilder();

        if (jsonobj.coinbase || (jsonobj.in[0].index == 0xffffffff && jsonobj.in[0].hash == '0000000000000000000000000000000000000000000000000000000000000000')) {
            t.setCoinbase(jsonobj.in[0], jsonobj.out).generate()
            this.hex = t.getCoinBase();
        } else {
            t.isRaw(0)//not raw tx
            t.setVersion(jsonobj.version);
            t.setInputs(jsonobj.in);
            this.inputs = jsonobj.in;
            t.setOutputs(jsonobj.out);
            this.outputs = jsonobj.out;
            t.setLockTime(jsonobj.lock_time);

            if (jsonobj.datascript) {//hex
                t.setDatascript(jsonobj.datascript)
            }

            t.generate();
            t.verify();

            this.hex = t.getSigned();

        }

        return this;
    },
    fromHex: function (hex) {
        if (hex)
            this.hex = hex;
        else
            hex = this.hex;
        var h = new txParser(hex);
        this.json = h.toJSON();
        this.inputs = this.json.in;
        this.outputs = this.json.out;
        return this;
    },
    setPrivateKey: function (pk) {
        this.private = pk;
        return this;
    },
    setWIF: function (pk) {
        this.private = hash.getPrivateKeyFromWIF(pk).toString('hex');
        return this;
    },
    toJSON: function () {
        if (!this.json && this.hex) {
            var t = new txParser(this.hex);
            this.json = t.toJSON()
        }

        return this.json;
    },
    build: function (in_addresses) {
        if (this.hex)
            return this.hex;

        if ((this.inputs.length <= 0 || this.outputs.length <= 0))
            throw new Error('input and out of tx must exist');

        var t = new txBuilder();
        t
            .isRaw(0)
            .setVersion(this.version)
            .setInputs(this.inputs, in_addresses)
            .setOutputs(this.outputs)
            .setLockTime(this.lock_time);

        if (this.datascript)
            t.setDatascript(this.datascript)

        t.generate();
        t.verify();
        this.hex = t.getSigned();

    },
    sign: function (privkey) {
        if (this.hex)
            return this.hex;

        if ((this.inputs.length <= 0 || this.outputs.length <= 0))
            throw new Error('input and out of tx must exist');

        var t = new txBuilder();
        t
            .setVersion(this.version)
            .setInputs(this.inputs)
            .setOutputs(this.outputs)
            .setLockTime(this.lock_time);

        if (this.datascript)
            t.setDatascript(this.datascript)

        t.sign(privkey);
        var res = t.verify();

        this.hex = t.getSigned();
        return res;
    },
    toHex: function () {

        if (this.hex)
            return this.hex;

        if ((this.inputs.length <= 0 || this.outputs.length <= 0))
            throw new Error('input and out of tx must exist');

        var t = new transactionBuilder();
        var jsonobj = this.json;
        if (jsonobj.coinbase) {
            throw new Error('can not sign coinbase transaction');
        } else {

            t.setVersion(jsonobj.version);
            t.setInputs(jsonobj.in);
            this.inputs = jsonobj.in;
            t.setOutputs(jsonobj.outs);
            this.outputs = jsonobj.out;
            t.setLockTime(jsonobj.lock_time);

            if (jsonobj.datascript) {
                t.setDatascript(jsonobj.datascript)
            }

            t.sign();
            t.verify();

            this.hex = t.getSigned();

        }

        return this.hex

    },
    getId: function () {
        if (!this.id) {

            if (!this.hex)
                this.toHex();

            this.id = bitPony.tool.reverseBuffer(bitPony.tool.sha256(bitPony.tool.sha256(new Buffer(this.hex, 'hex')))).toString('hex');
        }

        return this.id;
    },
    getHash: function () {
        return this.getId();
    },
    getFee: function () {
        return this.toJSON().fee;
    },
    getSize: function () {
        return this.toJSON().length;
    },
    getOuts: function () {
        return this.outputs
    },
    getIns: function () {
        return this.inputs
    },
    send: function () {

        var protocol = require('../../network/protocol')
        var inv = require('./inventory');
        var txdata = this.toJSON();
        if (!txdata.time)
            txdata.time = new Date().getTime() / 1000;
        var inventory = new inv('newtx', this.getHash(), txdata);
        var obj = inventory.getList();
        protocol.sendAll('inv', obj);
        return this.getHash();

    }

}

module.exports = transaction;