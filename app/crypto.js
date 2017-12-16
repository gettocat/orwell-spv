/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

var crypto = function (privk, public) {
    this.ec = new EC('secp256k1');
    if (privk)
        this.private = this.ec.keyFromPrivate(privk, 16);

    if (!public && this.private)
        this.public = this.private.getPublic(null, 'hex');
    else if (public && this.private)
        this.public = public;
}

crypto.prototype = {
    ec: null,
    init: function () {


        if (!this.private) {
            this.private = this.ec.genKeyPair();
            this.public = this.private.getPublic();
            return 1;
        }


    },
    ecdsa: function () {
        return this.ec;
    }

}

var EC = require('elliptic').ec;
var ec = new EC('secp256k1')
var cr = require('crypto');
var hash = require('hash.js');
var base58 = require('base-58');

module.exports = {
    createKeyPair: function () {
        var privateKey, publicKey;
        var cf = new crypto();
        if (status = cf.init()) {
            privateKey = cf.private.priv.toJSON();
            publicKey = cf.private.getPublic(null, 'hex');
        }

        return {
            status: status,
            public: publicKey,
            private: privateKey
        }
    },
    getPublicByPrivate: function (priv) {
        var cf = new crypto(priv);
        return cf.private.getPublic(null, 'hex');
    },
    sign: function (priv, messageBinary) {
        var cf = new crypto(priv),
            sig = cf.ecdsa().sign(messageBinary, new Buffer(priv, 'hex'))

        return new Buffer(sig.toDER())
    },
    verify: function (public, sign, messageBinary) {
        var key = ec.keyFromPublic(public, 'hex')
        return key.verify(messageBinary, sign, 'hex')
    },
    sha256: function (message, output) {
        if (!output)
            output = '';
        return cr.createHash('sha256').update(message).digest(output);
    },
    ripemd160: function (message, output) {
        if (!output)
            output = '';
        return hash.ripemd160().update(message).digest(output)
    },
    generatePrivateWIF: function (priv) {
        var privateKeyAndVersion = "80" + priv.toUpperCase();
        var firstSHA = module.exports.sha256(new Buffer(privateKeyAndVersion, 'hex'))
        var secondSHA = module.exports.sha256(firstSHA, 'hex')
        var checksum = secondSHA.substr(0, 8).toUpperCase()
        var keyWithChecksum = new Buffer(privateKeyAndVersion + checksum, 'hex');
        var privateKeyWIF = base58.encode(keyWithChecksum)
        return privateKeyWIF;
    },
    generateAddress: function (pubHex) {
        var key = (115).toString(16) + module.exports.generateAddressHash(pubHex);
        var f = module.exports.sha256(module.exports.sha256(new Buffer(key, 'hex')));

        var a = [];
        var buffer = f;
        for (var i = 0; i < 4; i++) {
            a.push(buffer[i]);
        }

        var dig = new Buffer(a).toString('hex');
        var res = key + dig;

        return base58.encode(new Buffer(res, 'hex'));
    },
    generateAddressHash: function (pubHex) {
        return module.exports.ripemd160(module.exports.sha256(new Buffer(pubHex, 'hex')), 'hex');
    },
    generateAddresFromAddrHash: function (hash) {

        var key = (115).toString(16) + hash;
        var f = module.exports.sha256(module.exports.sha256(new Buffer(key, 'hex')));

        var a = [];
        var buffer = f;
        for (var i = 0; i < 4; i++) {
            a.push(buffer[i]);
        }

        var dig = new Buffer(a).toString('hex');
        var res = key + dig;

        return base58.encode(new Buffer(res, 'hex'));
    },
    getPrivateKeyFromWIF: function (wif) {
        var key = new Buffer(base58.decode(wif));
        var buff = Buffer.alloc(key.length - 5);
        for (var i = 0, k = 0; i < key.length; i++) {
            if (i == 0)
                continue;
            if (key.length - i <= 4)
                continue;

            buff[k++] = key[i];
        }
        return buff
    },
    getPublicKeyHashByAddr: function (addr) {
        var key = new Buffer(base58.decode(addr));
        var buff = Buffer.alloc(20);
        for (var i = 0, k = 0; i < key.length; i++) {
            if (i == 0)
                continue;
            if (key.length - i <= 4)
                continue;

            buff[k++] = key[i];
        }

        return buff;
    },
    isValidAddress: function (address) {

        if (!address)
            return false;

        if (address.length <= 0)
            return false;

        var buff = base58.decode(address);
        var dig = [];
        for (var i = buff.length - 1, k = 0; k < 4; k++ , i--) {
            dig[3 - k] = (buff[i]);
        }


        var dig_hex = new Buffer(dig).toString('hex');

        var key = Buffer.alloc(buff.length - 4);
        for (var i = 0; i < buff.length; i++) {
            if (i <= buff.length - 5)
                key[i] = buff[i];
        }

        var f = module.exports.sha256(module.exports.sha256(key));


        var a = [];
        var buffer = f;
        for (var i = 0; i < 4; i++) {
            a.push(buffer[i]);
        }

        var dig_f = new Buffer(a).toString('hex');

        return dig_f === dig_hex;

    },
}