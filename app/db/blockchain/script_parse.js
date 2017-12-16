/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

var addrParser = function (hex) {

    this.raw = hex;

}

addrParser.prototype = {
    bytesBody: null,
    prettyBody: null,
    run: function () {
        if (!this.prettyBody) {
            var tx = (this.raw instanceof Buffer ? this.raw : new Buffer(this.raw, 'hex'));
            var vars = this._first(tx);
            this.bytesBody = vars;
            return this.prettyBody = this.pretty(vars);
        } else
            return this.prettyBody;
    },
    _first: function (tx) {

        var arr = {
            0: 'OP_DUP',
            1: 'OP_HASH160',
            2: 'PUSHDATA14',
            3: 'addr',
            23: 'OP_EQUALVERIFY',
            24: 'OP_CHECKSIG',
        }, sel = '', out = {};
        for (var i = 0; i < tx.length; i++) {

            if (arr[i])
                sel = arr[i];

            if (!out[sel])
                out[sel] = [];
            out[sel].push(tx[i]);

        }

        return out;
    },
    pretty: function (vars) {
        var buffs = [];
        for (var i in vars) {
            buffs[i] = new Buffer(vars[i]).toString('hex');
        }

        return buffs;
    },
    getBytes: function (name) {
        return this.bytesBody[name];
    }
}

module.exports = addrParser;