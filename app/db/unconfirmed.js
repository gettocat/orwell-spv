/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

var kventity = require('./types/index');
var util = require('util');
var config = require('../../config');
var chainEvents = require('../events')

var obj = null;
var unconfirmed = function () {
    this.name = 'utxo/unconfirmed';
    this.options = {};
    this.options.inmemory = false;
    this.init();
}

util.inherits(unconfirmed, kventity);

unconfirmed.prototype.getList = function () {
    var arr = this.get('utxolist');
    if (!arr || !(arr instanceof Array))
        arr = [];
    return arr;
}

unconfirmed.prototype.setList = function (arr) {
    this.set('utxolist', arr || []);
    return arr || [];
}
unconfirmed.prototype.getCount = function () {
    return this.getList().length;
}

unconfirmed.prototype.addTx = function (tx, cb) {

    if (this.isIndexed(tx.hash))
        return false;

    if (config.debug.blockchain.utxo)
        debug('info', "unconfirmed UTXO tx: " + tx.hash)

    var res = [];
    var outs = tx.out;
    for (var o in outs) {
        var out = outs[o];
        if (this.addUnspent(tx.hash, o, out.addr, out.amount, tx.time, tx.coinbase)) {
            res.push({ address: out.addr, unspent: true, amount: out.amount });
        }
    }

    for (var inp in tx.in) {
        var inpt = tx.in[inp];

        if (inpt.hash == '0000000000000000000000000000000000000000000000000000000000000000')//coinbase
            continue;

        var prevout;
        try {
            prevout = this.getOut(inpt.hash, inpt.index);
            debug('debug', 'unconfirmed prev out for tx ', tx.hash + ' input ' + inp, prevout)
            if (this.addSpent(tx.hash, prevout.addr, prevout.amount, inpt.hash, inpt.index, tx.time)) {
                res.push({ address: prevout.addr, spent: true, amount: prevout.amount });
                let { utxo } = require('./blockchain')
                utxo.lock(prevout.addr, inpt.hash, inpt.index);
            }
        } catch (e) {

        }
    }

    this.set("tx/" + tx.hash, tx);
    this.setIndexed(tx.hash);
    if (cb instanceof Function)
        cb(tx, res);

}

unconfirmed.prototype.getTx = function (hash) {
    let tx = this.get("tx/" + hash);
    if (!tx.hash)
        throw new Error('can not find tx in mempool ' + hash);
    return tx;
}

unconfirmed.prototype.addUnspent = function (tx, index, addr, amount, time, isCoinbase) {
    if (config.debug.blockchain.utxo)
        debug('info', "unconfirmed add UTXO index " + addr, tx + ":" + index, amount)

    var addrind = this.get("address/" + addr);
    if (!addrind || !(addrind instanceof Array))
        addrind = [];

    var finded = 0;
    for (var i in addrind) {
        if (addrind[i].tx == tx && addrind[i].index == index) {
            finded = 1;
            break;
        }
    }

    if (!finded) {
        var obj = {
            tx: tx,
            index: index,
            amount: amount,
            spent: false,
            unconfirmed: true,
            added: time,
            coinbase: isCoinbase,
        };

        var o = obj;
        o.address = addr;
        chainEvents.emit("chain.unconfirmed.utxo.unspent", o)
        addrind.push(obj);

        var list = this.getList();
        list.push(tx + ":" + index);
        this.setList(list);

        this.set("address/" + addr, addrind)
    }

    return addrind
}

unconfirmed.prototype.addSpent = function (tx, addr, amount, inputHash, inputIndex, time) {
    if (config.debug.blockchain.utxo)
        debug('info', "unconfirmed add UTXO index " + addr, inputHash + ":" + inputIndex, amount)

    var addrind = this.get("address/" + addr);
    if (!addrind || !(addrind instanceof Array))
        addrind = [];

    var finded = 0;
    for (var i in addrind) {
        if (addrind[i].tx == inputHash && addrind[i].index == inputIndex) {
            finded = 1;
            break;
        }
    }


    if (!finded) {

        var obj = {
            tx: inputHash,
            index: inputIndex,
            amount: amount,
            spent: true,
            spentHash: tx,
            unconfirmed: true,
            added: time,
            spentTime: time,
        };

        var o = obj;
        o.address = addr;
        chainEvents.emit("chain.unconfirmed.utxo.unspent", o)
        addrind.push(obj);

        var list = this.getList();
        list.push(inputHash + ":" + inputIndex);
        this.setList(list);

        this.set("address/" + addr, addrind)
    }

    return addrind
}

unconfirmed.prototype.removeTx = function (tx, isRejected) {

    if (!this.isIndexed(tx.hash))
        return false;

    if (config.debug.blockchain.utxo)
        debug('info', "remove unconfirmed UTXO tx: " + tx.hash)


    var outs = tx.out;
    for (var o in outs) {
        var out = outs[o];
        this.removeUnspent(tx.hash, o, out.addr);
    }

    for (var inp in tx.in) {
        var inpt = tx.in[inp];

        if (inpt.hash == '0000000000000000000000000000000000000000000000000000000000000000')//coinbase
            continue;

        var prevout;
        try {
            prevout = this.getOut(inpt.hash, inpt.index);
            debug('debug', 'remove unconfirmed prev out for tx ', tx.hash + ' input ' + inp, prevout)
            this.removeSpent(tx.hash, prevout.addr, inpt.hash, inpt.index);
            if (isRejected) {
                let { utxo } = require('./blockchain')
                utxo.unlock(prevout.addr, inpt.hash, inpt.index);
            }
        } catch (e) {

        }
    }

    this.unsetIndexed(tx.hash);
}

unconfirmed.prototype.removeUnspent = function (hash, index, addr) {
    if (config.debug.blockchain.utxo)
        debug('info', "remove unconfirmed UTXO index " + addr, hash + ":" + index)

    var addrind = this.get("address/" + addr);
    if (!addrind || !(addrind instanceof Array))
        addrind = [];

    var finded = -1;
    for (var i in addrind) {
        if (addrind[i].tx == hash && addrind[i].index == index) {
            finded = i;
            break;
        }
    }

    if (finded >= 0) {

        addrind.splice(finded, 1);
        var list = this.getList();
        if (list.indexOf(hash + ":" + index) != -1)
            list.splice(list.indexOf(hash + ":" + index), 1);
        this.setList(list);
        this.set("address/" + addr, addrind)
    }

    return addrind
}

unconfirmed.prototype.removeSpent = function (tx, addr, inputHash, inputIndex) {
    if (config.debug.blockchain.utxo)
        debug('info', "remove unconfirmed UTXO index " + addr, inputHash + ":" + inputIndex)

    var addrind = this.get("address/" + addr);
    if (!addrind || !(addrind instanceof Array))
        addrind = [];

    var finded = -1;
    for (var i in addrind) {
        if (addrind[i].tx == inputHash && addrind[i].index == inputIndex && addrind[i].spentHash == tx) {
            finded = i;
            break;
        }
    }


    if (finded >= 0) {

        addrind.splice(finded, 1);
        var list = this.getList();
        if (list.indexOf(inputHash + ":" + inputIndex) != -1)
            list.splice(list.indexOf(inputHash + ":" + inputIndex), 1);
        this.setList(list);

        this.set("address/" + addr, addrind)
    }

    return addrind
}

unconfirmed.prototype.setIndexed = function (hash) {
    var list = this.get('indexed');
    if (!list || !(list instanceof Array))
        list = [];

    if (list.indexOf(hash) == -1) {
        list.push(hash)
        this.set('indexed', list)
    }

    return true;
}

unconfirmed.prototype.unsetIndexed = function (hash) {
    var list = this.get('indexed');
    if (!list || !(list instanceof Array))
        list = [];

    if (list.indexOf(hash) !== -1) {
        list.splice(list.indexOf(hash), 1);
        this.set('indexed', list)
    }

    return true;
}

unconfirmed.prototype.isIndexed = function (hash) {
    var list = this.get('indexed');
    if (!list || !(list instanceof Array))
        list = [];

    return list.indexOf(hash) >= 0
}

unconfirmed.prototype.getUnIndexed = function (list) {

    var arr = [];
    var indexed = this.get('indexed');
    if (!indexed || !(indexed instanceof Array))
        indexed = [];

    for (var i in list) {
        if (indexed.indexOf(list[i]) == -1)
            arr.push(list[i]);
    }

    return arr;

}

unconfirmed.prototype.getOut = function (hash, index) {

    const { txlist } = require('./blockchain')
    return txlist.getOut(hash, index);

}

unconfirmed.prototype.have = function (addr, hash, index, txid) {
    var addrind = this.get("address/" + addr);
    if (!addrind || !(addrind instanceof Array))
        addrind = [];

    for (var i in addrind) {
        if (addrind[i].tx == hash && addrind[i].index == index) {
            var o = addrind[i];
            if (!o.spent || o.spentHash == txid)
                return true;
        }
    }

    return false;
}

unconfirmed.prototype.getAmount = function (addr, hash, index) {
    var addrind = this.get("address/" + addr);
    if (!addrind || !(addrind instanceof Array))
        addrind = [];

    for (var i in addrind) {
        if (addrind[i].tx == hash && addrind[i].index == index) {
            var o = addrind[i];
            return o.amount
        }
    }

    return false;
}

unconfirmed.prototype.getUTXOList = function (addr, limit, offset) {
    var addrind = this.get("address/" + addr);
    if (!addrind || !(addrind instanceof Array))
        addrind = [];
    var spent = 0, unspent = 0, spent_in = 0, unspent_in = 0;

    for (var i in addrind) {
        if (addrind[i].spent && addrind[i].spentHash) {
            spent += addrind[i].amount;
            spent_in++;
        } else {
            unspent += addrind[i].amount;
            unspent_in++;
        }
    }

    var items = [];
    if (limit == -1)
        items = addrind;
    else
        items = addrind.slice(offset, offset + limit);

    return {
        stats: {
            spent_inputs: spent_in,
            spent_amount: spent,
            unspent_inputs: unspent_in,
            unspent_amount: unspent
        },
        limit: limit,
        offset: offset,
        count: addrind.length,
        items: items.length,
        list: items
    }
}

unconfirmed.prototype.clear = function () {
    this.clearCollection();
}

module.exports = obj ? obj : obj = new unconfirmed;