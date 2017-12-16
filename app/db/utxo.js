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
var utxo = function () {
    this.name = 'utxo';
    this.options = {};
    this.options.inmemory = false;
    this.init();
}

util.inherits(utxo, kventity);

utxo.prototype.getList = function () {
    var arr = this.get('utxolist');
    if (!arr || !(arr instanceof Array))
        arr = [];
    return arr;
}

utxo.prototype.setList = function (arr) {
    this.set('utxolist', arr || []);
    return arr || [];
}
utxo.prototype.getCount = function () {
    return this.getList().length;
}

utxo.prototype.clear = function() {
    this.set('indexed', []);
    this.set('utxolist', []);
}


utxo.prototype.addTx = function (tx, cb) {
    if (config.debug.blockchain.utxo)
        debug('info', "UTXO tx: " + tx.hash)

    if (this.isIndexed(tx.hash))
        return false;

    var outs = tx.out;
    for (var o in outs) {
        var out = outs[o];
        this.addOutIndex(tx.hash, o, out.addr, out.amount, tx.time, tx.coinbase);
    }

    for (var inp in tx.in) {
        var inpt = tx.in[inp];

        if (inpt.hash == '0000000000000000000000000000000000000000000000000000000000000000')//coinbase
            continue;

        var prevout;
        try {
            prevout = this.getOut(inpt.hash, inpt.index);
            debug('debug', 'prev out for tx ', tx.hash + ' input ' + inp, prevout)
            this.removeOutIndex(tx.hash, prevout.addr, inpt.hash, inpt.index, tx.time);
        } catch (e) {

        }
    }

    this.setIndexed(tx.hash);
    if (cb instanceof Function)
        cb(tx);

}

utxo.prototype.setIndexed = function (hash) {
    var list = this.get('indexed');
    if (!list || !(list instanceof Array))
        list = [];

    if (list.indexOf(hash) == -1) {
        list.push(hash)
        this.set('indexed', list)
    }

    return true;
}

utxo.prototype.isIndexed = function (hash) {
    var list = this.get('indexed');
    if (!list || !(list instanceof Array))
        list = [];

    return list.indexOf(hash) >= 0
}

utxo.prototype.getUnIndexed = function (list) {

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

utxo.prototype.getOut = function (hash, index) {

    const { txlist } = require('./blockchain')
    return txlist.getOut(hash, index);

}

utxo.prototype.addOutIndex = function (tx, index, addr, amount, time, isCoinbase) {
    if (config.debug.blockchain.utxo)
        debug('info', "add UTXO index " + addr, tx + ":" + index, amount)

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
            added: time,
            coinbase: isCoinbase,
        };

        var o = obj;
        o.address = addr;
        chainEvents.emit("chain.utxo.unspent", o)
        addrind.push(obj);

        var list = this.getList();
        list.push(tx + ":" + index);
        this.setList(list);

        this.set("address/" + addr, addrind)
    }

    return addrind
}

utxo.prototype.removeOutIndex = function (txhash, addr, tx, index, time) {
    if (config.debug.blockchain.utxo)
        debug('info', "update spent UTXO index " + txhash + " " + addr, tx + ":" + index)

    var addrind = this.get("address/" + addr);
    if (!addrind || !(addrind instanceof Array))
        addrind = [];

    for (var i in addrind) {
        if (addrind[i].tx == tx && addrind[i].index == index) {
            var o = addrind[i];
            o.address = addr;
            o.spent = true;
            o.spentHash = txhash;
            o.spentTime = time;
            chainEvents.emit("chain.utxo.spent", o)
            //addrind[i].splice(i, 1);
            addrind[i] = o;
            var list = this.getList();
            list.splice(list.indexOf(tx + ":" + index), 1);
            this.setList(list);
            break;
        }
    }

    this.set("address/" + addr, addrind)
    return addrind

}

utxo.prototype.have = function (addr, hash, index, txid) {
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

utxo.prototype.getAmount = function (addr, hash, index) {
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

utxo.prototype.getUTXOList = function (addr, limit, offset) {
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

utxo.prototype.lock = function (addr, hash, index) {
    if (config.debug.blockchain.utxo)
        debug('info', "lock UTXO index " + addr, hash + ":" + index)

    var addrind = this.get("address/" + addr);
    if (!addrind || !(addrind instanceof Array))
        addrind = [];

    for (var i in addrind) {
        if (addrind[i].tx == hash && addrind[i].index == index) {
            addrind[i].locked = 1;
            debug("info", addrind[i]);
            break;
        }
    }

    this.set("address/" + addr, addrind);
}

utxo.prototype.unlock = function (addr, hash, index) {
    if (config.debug.blockchain.utxo)
        debug('info', "unlock UTXO index " + addr, hash + ":" + index)

    var addrind = this.get("address/" + addr);
    if (!addrind || !(addrind instanceof Array))
        addrind = [];

    for (var i in addrind) {
        if (addrind[i].tx == hash && addrind[i].index == index) {
            delete addrind[i].locked;
            break;
        }
    }

    this.set("address/" + addr, addrind);
}

module.exports = obj ? obj : obj = new utxo;