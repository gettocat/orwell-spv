/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

var hash = require('../../crypto');
var addrParser = require('./script_parse');
var util = require('./util')

function script(stack) {
    if (stack instanceof Buffer) {
        this.buffer = stack;
    } else
        this.stack = stack;
}

script.op = {
    'OP_DUP': '76',
    'OP_HASH160': 'a9',
    'PUSHDATA': function (data, len) {
        var hex = new Buffer(data).toString('hex');
        return (len ? len : data.length) + hex
    },
    'OP_EQUALVERIFY': '88',
    'OP_CHECKSIG': 'ac',
    'SIGHASH_ALL': '01',
}


script.prototype = {
    stack: [],
    buffer: null,
    result: "",
    makeFromStack: function () {
        var res = "";
        for (var i in this.stack) {

            if (this.stack[i] instanceof Array) {
                var func = this.stack[i].shift();
                res += script.op[func].apply(this, this.stack[i]);
            } else {
                res += script.op[this.stack[i]];
            }

        }

        return this.result = res;
    },
    create: function () {
        if (!this.result)
            this.makeFromStack();
        return this.result;
    },
    parseAddr: function () {
        adr = new addrParser(this.buffer);
        adr.run();
        return new Buffer(adr.getBytes('addr'));
    },
}

script.addrToScript = function (addr) {
    return new script([
        'OP_DUP',
        'OP_HASH160',
        ['PUSHDATA', hash.getPublicKeyHashByAddr(addr), 14],
        'OP_EQUALVERIFY',
        'OP_CHECKSIG'
    ]).create();
}

script.isP2PKH = function (buffer) {
    var res = true;
    for (var i = 0; i < buffer.length; i++) {
        if (i == 0)
            res = (util.numHex(buffer[i]) == script.op['OP_DUP']);
        if (i == 1)
            res = (util.numHex(buffer[i]) == script.op['OP_HASH160']);
        if (i == 2)
            res = (util.numHex(buffer[i]) == 14);
        if (i == 23)
            res = (util.numHex(buffer[i]) == script.op['OP_EQUALVERIFY']);
        if (i == 24)
            res = (util.numHex(buffer[i]) == script.op['OP_CHECKSIG']);

    }
    return res;
}

script.addrHashToScript = function (buffer) {
    return new script([
        'OP_DUP',
        'OP_HASH160',
        ['PUSHDATA', buffer, 14],
        'OP_EQUALVERIFY',
        'OP_CHECKSIG'
    ]).create();
}

script.scriptToAddrHash = function (scriptBuffer) {
    if (typeof scriptBuffer == 'string')
        scriptBuffer = new Buffer(scriptBuffer, 'hex');
    return new script(scriptBuffer).parseAddr();
}

script.scriptToAddr = function (scriptBuffer) {
    if (typeof scriptBuffer == 'string')
        scriptBuffer = new Buffer(scriptBuffer, 'hex');
    var adrhash = new script(scriptBuffer).parseAddr();
    return hash.generateAddresFromAddrHash(adrhash.toString('hex'));
}

script.scriptSig = function (der, pubkey) {
    return new script([
        ['PUSHDATA', der, 47],
        'SIGHASH_ALL',
        ['PUSHDATA', pubkey, 41]
    ]).create();
}

script.sigToArray = function (sc) {
    var res = script.parseScriptSig(sc);

    var der = Buffer.concat([
        new Buffer(res['seq']),
        new Buffer(res['derlen']),
        new Buffer(res['intX']),
        new Buffer(res['derXlen']),
        new Buffer(res['derX']),
        new Buffer(res['intY']),
        new Buffer(res['derYlen']),
        new Buffer(res['derY']),
    ]).toString('hex')

    var pub = Buffer.concat([
        new Buffer(res['pubtype']),
        new Buffer(res['pubkeyX']),
        new Buffer(res['pubkeyY']),
    ]).toString('hex')

    return [der, pub];
}

script.parseScriptSig = function (raw) {
    //todo: multisig
    if (!raw)
        return {};

    if (typeof raw == 'string')
        raw = new Buffer(raw, 'hex')

    var arr = {
        0: 'pushdata47',
        1: 'seq',
        2: 'derlen',
        3: 'intX',
        4: 'derXlen'
    }
    var sel = '', out = {};
    for (var i = 0; i < raw.length; i++) {
        if (arr[i])
            sel = arr[i];

        if (arr[i] == 'derXlen') {
            arr[i + 1] = 'derX';
            arr[i + raw[i] + 1] = 'intY';
            arr[i + raw[i] + 2] = 'derYlen';
        }

        if (arr[i] == 'derYlen') {
            arr[i + 1] = 'derY';
            arr[i + raw[i] + 1] = 'sighash_all';
        }

        if (arr[i] == 'sighash_all') {
            arr[i + 1] = 'pushdata41';
        }

        if (arr[i] == 'pushdata41') {
            arr[i + 1] = 'pubtype';
        }

        if (arr[i] == 'pubtype') {
            arr[i + 1] = 'pubkeyX';
            var len = out['pushdata41'] - 1;
            arr[i + 1 + len / 2] = 'pubkeyY';
        }

        if (!out[sel])
            out[sel] = [];
        out[sel].push(raw[i]);
    }


    return out;
}

module.exports = script;
