/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

var hash = require('../../crypto')
var util = require('./util')
var script = require('./script')
var bitPony = require('bitpony')
var config = require('../../../config')
var dscript = require('orwelldb').datascript

module.exports = builder;
function builder() {

    this.version = config.blockchain.txversion;
    this.lock_time = 0;
    this.inputs = [];
    this.outputs = [];
    this.datascripts = [];
    this.signatures = [];
    this.scriptSigRaw = [];

}

builder.prototype = {
    version: 1,
    lock_time: 0,
    gensigned: 0,
    signatures: [],
    isCoinbase: 0,
    coinbaseData: '',
    coinbaseAddr: '',
    coinbaseAmount: 0,
    scriptSigRaw: [],
    datascripts: [],
}

builder.prototype.setInputs = function (arr, addresses) {//if have addresses array - we can proof signatures!

    if (!addresses)
        addresses = [];

    for (var i in arr) {
        if (arr[i].hash) {
            if (arr[i].scriptSig) {
                this.signatures[i] = arr[i].scriptSig;
                this.scriptSigRaw[i] = script.sigToArray(arr[i].scriptSig);
            }

            if (!arr[i].prevAddress) {
                arr[i].prevAddress = hash.generateAddres(this.scriptSigRaw[i][1]);
            }

            this.inputs[i] = [arr[i].hash, arr[i].index, arr[i].prevAddress || addresses[i], arr[i].sequence];
        } else
            this.inputs[i] = arr[i];
    }

    return this;

}

builder.prototype.setOutputs = function (arr) {

    for (var i in arr) {
        if (arr[i].scriptPubKey) {
            this.outputs[i] = [arr[i].amount, arr[i].scriptPubKey, 1];
        } else {
            this.outputs[i] = arr[i];
        }
    }

    return this;

}

builder.prototype.setVersion = function (ver) {

    this.version = ver;
    return this;

}

builder.prototype.setLockTime = function (lock) {

    this.lock_time = lock;
    return this;

}

builder.prototype.setCoinbase = function (inp, out) {
    this.isCoinbase = 1;
    this.coinBaseData = inp.scriptSig;
    this.coinBaseSequence = typeof inp.sequence == 'undefined' ? 0 : inp.sequence;
    this.coinbaseOuts = out;
    return this;
}

builder.prototype.attachData = function (data, pem) {
    if (this.isCoinbase)
        throw new Error('cant attach datascript into coinbase transaction');

    //may thrown error
    this.datascripts.push(new dscript(data, pem))
    return this;
}

builder.prototype.setDatascript = function (script) {

    //may thrown error
    this.datascripts = script
    return this;

}

builder.prototype.generate = function () {

    if (this.isCoinbase) {
        if (!this.result) {

            var write = new bitPony.writer(new Buffer(""));
            write.uint32(config.blockchain.txversion, true);
            write.var_int(this.version, true);//input cnt

            var databuff
            if (this.coinBaseData) {
                databuff = this.coinBaseData;
                if (!(this.coinBaseData instanceof Buffer) && !(typeof this.coinBaseData == 'string'))
                    throw new Error("only byteorder or string allowed in coinbase data");
                databuff = new Buffer(this.coinBaseData, 'hex');
            }


            write.tx_in("0000000000000000000000000000000000000000000000000000000000000000", 0xffffffff, databuff, this.coinBaseSequence, true);
            write.var_int(this.coinbaseOuts.length, true)//output cnt
            for (var i in this.coinbaseOuts) {
                write.tx_out(this.coinbaseOuts[i].amount, this.coinbaseOuts[i].scriptPubKey, true);
            }
            write.uint32(this.lock_time, true);

            this.result = write.getBuffer().toString('hex')
        }
        return this.result;
    } else {
        var write = new bitPony.writer(new Buffer(""));
        write.uint32(this.version, true);
        write.var_int(this.inputs.length, true);

        for (var i in this.inputs) {
            var inp = this.inputs[i], index = inp[1], txhash = inp[0], addr = inp[2], sec = inp[3] || 0xffffffff, sgs;

            if (this.signatures[i] == -1)
                sgs = "";
            else if (this.signatures[i] === 1) {
                sgs = script.addrToScript(addr);
            } else
                sgs = this.signatures[i];

            write.tx_in(txhash, index, sgs, sec, true);
        }

        write.var_int(this.outputs.length, true);
        for (var o in this.outputs) {
            var s = this.outputs[o],
                addr = s[1], amount = s[0], frm = s[2],
                sigo = (frm === 1 ? addr : script.addrToScript(addr));

            write.tx_out(amount, sigo, true);
        }


        write.uint32(this.lock_time, true);

        var dsc = "";
        if (this.datascripts instanceof Array && this.datascripts.length > 0) {
            var scriptslist = [];
            for (var i in this.datascripts) {
                if (this.datascripts[i] instanceof dscript)
                    scriptslist.push(this.datascripts[i].toHEX())
            }

            dsc = dscript.writeArray(scriptslist);
        } else
            dsc = this.datascripts;

        this[this.gensigned ? 'signed' : 'rawunsigned'] = write.getBuffer().toString('hex') + dsc;


    }

}

builder.prototype.sign = function (private_keys) {

    var siglist = [];
    for (var i in this.inputs) {
        this.signatures[i] = -1;
    }

    for (var i in this.inputs) {
        this.signatures[i] = 1;
        this.generate();
        var tx = this.rawunsigned + "01000000",
            txb = new Buffer(tx, 'hex'),
            sig256 = hash.sha256(hash.sha256(txb)),
            sig = hash.sign(new Buffer(private_keys[i], 'hex'), sig256),
            scriptSig = script.scriptSig(sig, new Buffer(hash.getPublicByPrivate(private_keys[i]), 'hex'));

        this.scriptSigRaw[i] = [
            sig.toString('hex'),
            hash.getPublicByPrivate(private_keys[i])
        ];

        this.signatures[i] = -1;
        siglist[i] = scriptSig;
    }

    this.signatures = siglist;
    this.gensigned = 1;

    this.generate();
    return this;
}

builder.prototype.isRaw = function (israw) {
    if (!israw) {
        this.gensigned = 1;
    }

    return this;
}

builder.prototype.verify = function () {

    var res = []
    for (var i in this.inputs) {
        var pubkey = this.scriptSigRaw[i][1];
        var sign = this.scriptSigRaw[i][0];
        var signable = this.getSignableTransaction(i, this.inputs[i][2]) + "01000000";
        var hash2sign = hash.sha256(hash.sha256(new Buffer(signable, 'hex')));
        res[i] = hash.verify(pubkey, sign, hash2sign);
    }

    var result = true;
    for (var i in res) {
        if (!res[i])
            result = false;
    }

    if (!result)
        throw new Error('can not verify signature of transaction');
    return result;

}

builder.prototype.getSignableTransaction = function (k, addr) {
    var b = new Buffer(this.signed, 'hex');
    var datascripts = [];
    var read = new bitPony.reader(b);
    var res = read.tx(0);
    var tx = res.result;

    if (b[res.offset] == 0xef || b[res.offset] == 0xee) {
        var scripts = dscript.readArray(b.slice(res.offset))
        for (var i in scripts) {
            datascripts[i] = new dscript(scripts[i]);
        }

    }

    var write = new bitPony.writer(new Buffer(""));
    write.uint32(tx.version, true);
    write.var_int(tx.in.length, true);

    for (var i in tx.in) {
        var inp = tx.in[i], index = inp.index, txhash = inp.hash, sgs;

        if (i == k)
            sgs = script.addrToScript(addr);
        else
            sgs = "";

        write.tx_in(txhash, index, sgs, inp.sequence || 0xffffffff, true);
    }

    write.var_int(tx.out.length, true);
    for (var o in tx.out) {

        var s = tx.out[o], sigo = s.scriptPubKey, amount = s.amount
        write.tx_out(amount, sigo, true);

    }

    write.uint32(tx.lock_time, true);
    var dsc = "";
    if (datascripts.length > 0) {
        var arr = [];
        for (var i in datascripts) {
            if (datascripts[i] instanceof dscript)
                arr.push(datascripts[i].toHEX())
        }

        dsc = dscript.writeArray(arr);
    }

    return write.getBuffer().toString('hex') + dsc;
}

builder.prototype.getId = function () {

    var tx = this.signed;
    var hash2 = hash.sha256(hash.sha256(new Buffer(tx, 'hex')));
    var buf = util.reverseBuffer(hash2).toString('hex');
    return buf;


}

builder.prototype.getRaw = function () {
    return this.rawunsigned
}

builder.prototype.getSigned = function () {
    return this.signed
}

builder.prototype.getCoinBase = function () {
    if (!this.result)
        this.generate();
    return this.result;
}