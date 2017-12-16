/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/
//simple validator for tx in spv wallet.

var config = require('../../../config');
var util = require('./util');
var hash = require('../../crypto')
var script = require('./script')
var dscript = require('orwelldb').datascript

var validate = function (tx) {
    this.hex = tx.toHex();
    this.data = tx.toJSON();
    this.result = this.run();
}

validate.isValid = function (tx) {
    var val = new validate(tx);
    return val.isValidTx();
};

validate.prototype = {
    raw: null,
    tx: null,
    prevtx: null,
    result: false,
    debug: [],
    run: function () {

        this.debug = [];

        if (!this.data)
            return false;
        /*
         The transaction’s syntax and data structure must be correct.
         Neither lists of inputs or outputs are empty.
         The transaction size in bytes is less than MAX_BLOCK_SIZE.
         Each output value, as well as the total, must be within the allowed range of values (less than 21m coins, more than 0).
         nLockTime is less than or equal to INT_MAX.
         The transaction size in bytes is greater than or equal to 100.
         */
        var f1 = this.checkStructure();
        /*
         !!! Using the referenced output transactions to get input values, check that each input value, as well as the sum, are in the allowed range of values (less than 21m coins, more than 0).
         Reject if the sum of input values is less than sum of output values.
         */
        var f2 = this.checkOuts();
        /*
         The unlocking scripts (scriptSig) for each input must validate against the corresponding output locking scripts (scriptPubKey).
         None of the inputs have hash=0, N=–1 (coinbase transactions should not be relayed). 
         [The unlocking script (scriptSig) can only push numbers on the stack, |checked on testsign], and the locking script (scriptPubkey) must match isStandard forms (this rejects "nonstandard" transactions).
         
         **/
        var f3 = true;
        /**
         For each input, look in the main branch and the transaction pool to find the referenced output transaction. 
         If the output transaction is missing for any input, this will be an orphan transaction. Add to the orphan transactions pool, if a matching transaction is not already in the pool.
         For each input, if the referenced output exists in any other transaction in the pool, the transaction must be rejected.
         A matching transaction in the pool, or in a block in the main branch, must exist.
         For each input, if the referenced output transaction is a coinbase output, it must have at least COINBASE_MATURITY (100) confirmations.
         For each input, the referenced output must exist and cannot already be spent.
         */
        var f4 = true;
        var f5 = true;

        this.result = f1 && f2 && f3 && f4 && f5;
        if (config.debug['blockchain'].txvalidate)
            debug('info','tx.verify', this.data.hash, this.result, this.debug);

        return this.result;

    },
    checkStructure: function () {
        var items = this.data;
        var arr = {
            'version == config.blockchain.txversion': items.version >= config.blockchain.txversion,
            'inputcnt > 0': items.in.length > 0,
            'outputscnt > 0': items.out.length > 0,
            'checkinputs': function (validator) {

                var res = true;
                if (!items['coinbase'])
                    for (var i in items['in']) {
                        var sc = script.sigToArray(items['in'][i].scriptSig);
                        if (!sc[0] || !sc[1]) {
                            res = false;
                            validator.debug.push("in[" + i + "] signature does not exist: false");
                        }

                        if (!sc[1]) {
                            res = false;
                            validator.debug.push("in[" + i + "] pubkey does not exist: false");
                        }
                    }

                return res;

            }
        }
        return this._execute(arr);

    },
    checkOuts: function () {
        var items = this.data;
        var l = new Buffer(this.hex, 'hex').length;

        var arr = {
            'tx.size > 70 && tx.size < block_size': l > 70 && l < config.blockchain.block_size,
            'outputs': function (validator) {
                var l = items.out;
                var le = true;
                for (var i in l) {
                    if ((l[i].amount > 0 || (l[i].amount == 0 && items.datascript)) && l[i].amount / config.blockchain.satoshicoin <= config.blockchain.max_coins) {
                        validator.debug.push("out[" + i + "] amount " + l[i].amount + " > 0 && < config.blockchain.max_coins: true");
                    } else {
                        le = false;
                        validator.debug.push("out[" + i + "] amount " + l[i].amount + " > 0 && < config.blockchain.max_coins: false");
                    }
                }

                return le;
            }
        }

        var res = this._execute(arr);
        return res;
    },
    _execute: function (rules) {
        var it = true;
        for (var i in rules) {
            var res = (rules[i] instanceof Function ? rules[i](this) : rules[i]);
            this.debug.push(i + ": " + !!res);
            if (!res)
                it = false;
        }

        return it;
    },
    isValidTx: function () {
        return this.result;
    },
    getDebug: function () {
        return this.debug;
    },
}

module.exports = validate;