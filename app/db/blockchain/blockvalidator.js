/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

var config = require('../../../config')
var CP = require('./checkpoints')
var merkle = require('./merkle')
var dif = require('./difficulty')
var indexes = null;
var txVal = require('./txvalidator');

var validate = function (block) {
    this.block = block;
    indexes = require('../blockchain').indexes;
    this.result = this.run();
}

validate.isValid = function (block) {
    var val = new validate(block);
    return val.isValidBlock();
}

validate.isValidBlockTime = function (block) {
    var blockchain = require('../blockchain').chain;
    var i = 0, times = [], prevblock = block;
    do {
        var prevblocktime = indexes.get("time/" + (prevblock.hashPrevBlock || prevblock.prev_block));
        if (Number.isFinite(prevblocktime))
            times.push(prevblocktime);
        i++;
        try {
            prevblock = blockchain.getBlock(prevblock.hashPrevBlock || prevblock.prev_block);
        } catch (e) {
            prevblock = null;
        }
    } while (prevblock && i < 12);


    var prevTime = 0;
    for (var i in times) {
        prevTime += times[i];
    }

    var maxBlockTime = Math.max.apply(null, times);
    prevTime /= times.length;

    //var nettime = netTime.getLast();
    if (Number.isFinite(block.height) && block.height < 50)
        return true;

    return block.time > prevTime && block.time <= (maxBlockTime + 7 * 24 * 60 * 60)

}

validate.prototype = {
    block: null,
    prevblock: null,
    result: false,
    debug: [],
    run: function () {

        this.debug = [];
        this.errors = [];

        if (!this.block)
            return false;


        if (this.block.hash == "0000d0a06360b172acd5a24be85de5c62958b0553b11d812de67e52f2c1e113a" && this.block.height == 0)
            return true;//genesis block fix
                        
        /*
         The block data structure is syntactically valid
         The block header hash is less than the target difficulty (enforces the proof of work)
         The block timestamp is less than two hours in the future (allowing for time errors)
         The block size is within acceptable limits
         The first transaction (and only the first) is a coinbase generation transaction
         */
        var f1 = this.checkStructure();

        this.result = f1;
        if (config.debug['blockchain'].blockvalidate)
            debug('info', 'block.verify', this.block.hash, this.result, this.debug);

        return this.result;
    },
    checkStructure: function () {

        var arr = {
            'previousblockexists': function (validator) {

                if (validator.block.genesis == 1 && validator.block.hashPrevBlock == '0000000000000000000000000000000000000000000000000000000000000000')
                    return true;


                var blockchain = require('../blockchain').chain;
                var block = {};
                try {
                    block = blockchain.getBlock(validator.block.hashPrevBlock || validator.block.prev_block);
                } catch (e) {
                    console.log(e);
                }

                var childs = blockchain.getChilds(validator.block.hashPrevBlock || validator.block.prev_block);
                if (block.hash && (childs.length == 0 || (childs.length == 1 && childs[0].hash == validator.block.hash)))
                    return true;
                else {
                    var orphan = require('../orphan');
                    var newAdding = orphan.add(validator.block.toJSON());
                    validator.debug.push("block is have parent (if not add to orphan): false");
                    var chainEvents = require('../../events')
                    //if (newAdding && (childs.length == 0 || (childs.length == 1 && childs[0].hash == validator.block.hash)))
                    chainEvents.emit("chain.block.seek", { hash: validator.block.hashPrevBlock });

                    if (childs.length != 0 && childs[0].hash != validator.block.hash) {

                        validator.debug.push("block have expected childs: false (" + childs.length + ")");
                        orphan.tryLongest(validator.block.hash);

                    }

                    //if (newAdding)                    
                    //orphan.checkBlock(validator.block.toJSON());
                    return false;
                }
            },
            'merklerootisvalid': function (validator) {
                //spv
                return true;
            },
            'hashvalid': function (validator) {
                var hashraw = validator.block.getHash('raw');
                return (hashraw.toString('hex') == validator.block.hash)
            },
            'hashhightthentarget': function (validator) {
                var hashraw = validator.block.hashBytes();

                var t = validator.block.bits;
                if (typeof t == 'string')
                    t = parseInt(t, 16);

                var target = dif.bits2target(t);
                return dif.less(hashraw, target);
            },
            'targetisfromconsensus': function (validator) {

                var t = validator.block.bits;
                if (typeof t == 'string')
                    t = parseInt(t, 16)
                var json = validator.block.toJSON();
                var need = dif.checkBits(json), have = t;
                if (!need)
                    return false;
                return dif.compare(need, have)
            },
            'blocktimeisvalid': validate.isValidBlockTime(this.block),
            'blockversionisvalid': function (validator) {
                if (validator.block.height == 0)
                    return true;
                return validator.block.version >= config.blockchain.version
            },
            'isvalidtx': function (validator) {
                //spv
                return true
            },
            'checkpoints': function (validator) {

                if (validator.block.height) {

                    var checkpoints = CP[config.net];
                    if (checkpoints[validator.block.height]) {
                        if (checkpoints[validator.block.height] != validator.block.hash) {
                            validator.debug.push("block checkpoints height " + validator.block.height + " exists and passed: false");
                            return false;
                        }
                    }

                }

                return true;

            },
            'doublespent': function (validator) {
                //spv
                return true
            },
            'coinbasevaluefromconsensus': function (validator) {
                //spv
                return true;

            }
        }
        return this._execute(arr);

    },
    _execute: function (rules) {
        var it = true;
        for (var i in rules) {
            var res = (rules[i] instanceof Function ? rules[i](this) : rules[i]);

            if (rules[i] == 'targetisfromconsensus' && !res)
                this.errors.push('bad-diffbits');

            if (rules[i] == 'isvalidtx' && !res)
                this.errors.push('bad-txns');

            if (rules[i] == 'blockversionisvalid' && !res)
                this.errors.push('bad-version');

            if (rules[i] == 'hashhightthentarget' && !res)
                this.errors.push('high-hash');

            if (rules[i] == 'hashhightthentarget' && !res)
                this.errors.push('high-hash');

            if (rules[i] == 'previousblockexists' && !res)
                this.errors.push('stale-prevblk');

            if (rules[i] == 'blocktimeisvalid' && !res)
                this.errors.push('time-invalid');

            if (!res && !this.errors.length)
                this.errors.push('rejected');

            this.debug.push(i + ": " + !!res);
            if (!res)
                it = false;
        }

        return it;
    }
    ,
    isValidBlock: function () {
        return this.result;
    },
    getDebug: function () {
        return this.debug;
    },
    getErrors: function () {
        return this.errors;
    },
}

module.exports = validate;