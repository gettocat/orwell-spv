/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

var util = require('util');
var entity = require('./types/entry');
var crypto = require('../crypto')
const config = require('../../config');

var obj = null;
var wallet = function () {
    this.dbname = config.net == 'mainnet' ? 'wallet.dat' : 'wallet.testnet.dat';
    this.name = 'addresses';
    this.init();
}

util.inherits(wallet, entity);

wallet.prototype.getAddressUnspent = function (addr) {
    let { utxo } = require('./blockchain')
    var arr = utxo.get("address/" + addr);
    if (!arr) {
        arr = [];
    }

    var a = [];
    for (var i in arr) {
        if (!arr[i].spent && !arr[i].spentHash && !arr[i].locked)
            a.push(arr[i]);
    }

    /**
     {
     tx: tx,
     index: index,
     amount: amount,
     spent: false
     }
     */
    return a;

}

wallet.prototype.getAddressessUnspent = function (arr) {
    var res = [];
    for (var i in arr) {
        res = res.concat(this.getAddressUnspent(arr[i]));
    }

    return res;
}

wallet.prototype.bestUnspent = function (unspentList, target) {

    if (!unspentList.length)
        return false;

    var lessers = [], greaters = [];

    for (var i in unspentList) {
        if (unspentList[i].amount > target) {
            greaters.push(unspentList[i]);
        } else
            lessers.push(unspentList[i])
    }

    if (greaters.length > 0) {
        var min = null;
        for (var i in greaters) {

            if (!min || greaters[i].amount < min.amount) {
                min = greaters[i];
            }

        }

        if (min) {
            var change = min.amount - target;
            return {
                outs: [min],
                change: change
            }
        }
    }

    lessers = lessers.sort(function (a, b) {
        return b.amount - a.amount;
    });

    var result = []
    accum = 0
    for (var a in lessers) {
        result.push(lessers[a])
        accum += lessers[a].amount
        if (accum >= target) {
            change = accum - target
            return {
                outs: result,
                change: change
            }
        }
    }
    return false;
}

wallet.prototype.createTransaction = function (address, address_destination, amount, fee) {
    if (!fee)
        fee = 0;

    if (address) {
        var unspent = this.getAddressUnspent(address);
        var res = this.bestUnspent(unspent, amount + fee);
    } else {
        var addr_list = this.find({}), addressess = [];
        for (var i in addr_list) {
            addressess.push(addr_list[i].address);
        }
        var unspent = this.getAddressessUnspent(addressess);
        var res = this.bestUnspent(unspent, amount + fee);
    }

    if (!res)
        return {
            status: false,
            code: -1,
            error: 'can not send ' + (amount + fee) + ' satoshi to address ' + address_destination + ' not have unspent coins',
        }



    //make tx with out1 - address_destination, address2 - change out to new address of account_id
    let { txlist, Script } = require('./blockchain');
    let Tx = require('./blockchain/tx')
    let tx = new Tx();

    var inputs = [], privates = [];
    for (var i in res.outs) {
        var prevout = txlist.getOut(res.outs[i].tx, res.outs[i].index);
        var addrinfo = this.findAddress(prevout.addr);

        if (!addrinfo || !addrinfo.privateKey)
            return {
                status: false,
                code: -2,
                error: 'can not find in wallet.dat info about address  ' + prevout.addr,
                address: prevout.addr,
            }

        privates.push(addrinfo.privateKey);

        inputs.push({
            hash: res.outs[i].tx,
            index: res.outs[i].index,
            sequence: 0xffffffff,
            prevAddress: prevout.addr,
        })
    }

    tx.setInputs(inputs);

    var outputs = [];
    outputs.push({
        amount: amount,
        scriptPubKey: Script.addrToScript(address_destination)
    })

    let changeaddress = this.findAddress(address);
    if (config.wallet.changeAddress) {
        changeaddress = this.findEmptyAddress();
        if (!changeaddress || !changeaddress.address)
            changeaddress = this.createNewAddress();
    }

    if (!changeaddress.address)
        throw new Error('cant create new address');

    outputs.push({
        amount: res.change,
        scriptPubKey: Script.addrToScript(changeaddress.address)
    })

    tx.setOutputs(outputs)
    tx.setVersion(config.blockchain.txversion)
    tx.setLockTime(0);
    tx.sign(privates)

    return tx;

}

wallet.prototype.setFee = function (amount) {
    this.fee = amount;
}

wallet.prototype.calculateFee = function (tx) {
    var bytes = new Buffer(tx.toHex(), 'hex').length + 10;//10 bytes just because second tx in bytes can be bigger than first on 1-2 byte. Need that second tx be bigger fee, because it can be not validated
    var operationFee = 0;

    return bytes * this.fee + operationFee;
}

wallet.prototype.createTx = function (addr, address_destination, amount) {
    if (addr == '0')
        addr = null;

    let tx = this.createTransaction(addr, address_destination, amount, 0);

    if (tx.status == false)
        return tx;

    //create transaction with new amount (with fee)
    let fee = this.calculateFee(tx);
    tx = this.createTransaction(addr, address_destination, amount, fee);

    if (tx.status == false)
        return tx;

    let txValid = require('./blockchain/txvalidator')
    let val = (txValid.isValid(tx));

    if (!val) {
        return {
            status: false,
            code: 'notvalid'
        }
    }


    return {
        fee: fee,
        status: true,
        code: 1,
        tx: tx
    }
}

wallet.prototype.findAddress = function (addr) {
    var obj = this.findAndSort({ address: addr }, 'added', 'desc', 1);
    return obj[0];
}

wallet.prototype.createNewAddress = function (label) {
    var addr = crypto.createKeyPair();
    privateKey = addr.private;
    publicKey = addr.public;

    var addr = crypto.generateAddress(publicKey);
    var obj = {
        //id: this.count() + 1,
        label: label,
        added: new Date().getTime() / 1000,
        address: addr,
        publicKey: publicKey,
        privateKey: privateKey,
        wif: crypto.generatePrivateWIF(privateKey),
        hash160: crypto.generateAddressHash(publicKey)
    };
    return this.insert(obj);
}

wallet.prototype.importPrivateKey = function (WIForHex, label) {
    var privateKeyHex;
    //try base58 decode, if not - its hex
    try {
        var buffer = crypto.getPrivateKeyFromWIF(WIForHex);
        privateKeyHex = buffer.toString('hex');
        debug('info', 'privateKey importWIF')
    } catch (e) {
        try {
            var buffer = new Buffer(WIForHex, 'hex');
            privateKeyHex = buffer.toString('hex');
            debug('info', 'privateKey import hex')
        } catch (e) {
            debug('error', 'privateKey import undefined format')
        }
    }

    if (!privateKeyHex)
        return -1;

    var publicKey = crypto.getPublicByPrivate(privateKeyHex);
    var data = this.find({ privateKey: privateKeyHex });
    if (!data.length) {

        var addr = crypto.generateAddress(publicKey);
        var obj = {
            //id: this.count() + 1,
            label: label,
            added: new Date().getTime() / 1000,
            address: addr,
            publicKey: publicKey,
            privateKey: privateKeyHex,
            wif: crypto.generatePrivateWIF(privateKeyHex),
            hash160: crypto.generateAddressHash(publicKey)
        };
        return this.insert(obj);

    }

    return -2;

}

wallet.prototype.findEmptyAddress = function () {

    let list = this.find({});
    let utxo = this.getUTXO(list);
    for (let addr in utxo) {
        if (!utxo[addr].stats.unspent_amount) {
            for (let k in list) {
                if (list[k].address == addr)
                    return list[k];
            }
        }
    }

    return false;

}

wallet.prototype.getUTXO = function (addrlist) {


    var list = {};
    const { utxo } = require('./blockchain')
    for (var i in addrlist) {
        list[addrlist[i].address] = utxo.getUTXOList(addrlist[i].address, -1);
    }

    return list
}

wallet.prototype.getUTXOHistory = function (addrlist) {
    var list = [];
    const { utxo, unconfirmed } = require('./blockchain')
    for (var i in addrlist) {
        info = utxo.getUTXOList(addrlist[i].address, -1);
        unchained = unconfirmed.getUTXOList(addrlist[i].address, -1);
        if (info.count > 0)
            list = list.concat(info.list);

        if (unchained.count > 0)
            list = list.concat(unchained.list);
    }

    var byDate = list.slice(0);

    byDate.sort(function (a, b) {
        return (a.spentTime ? a.spentTime : a.added) - (b.spentTime ? b.spentTime : b.added);
    });

    var balance = 0;
    for (var i in byDate) {
        if (byDate[i].spent && byDate[i].spentHash)
            balance -= byDate[i].amount / 1e8;
        else
            balance += byDate[i].amount / 1e8;
        byDate[i].balance = balance
    }

    byDate.sort(function (a, b) {
        return (b.spentTime ? b.spentTime : b.added) - (a.spentTime ? a.spentTime : a.added);
    });

    return byDate;

}

wallet.prototype.existAddress = function (address) {
    return this.count({ address: address }) == 1;
}

wallet.prototype.export = function (filter) {
    if (!filter)
        filter = {};
    let list = this.find(filter);
    for (let i in list) {
        if (!list[i])
            continue;
        delete list[i].meta
        delete list[i].$loki
    }

    return list;
}

wallet.prototype.getBalance = function (filter) {

    let addresses = this.find(filter);
    let ut = this.getUTXO(addresses);
    let balance = 0;

    for (let k in ut) {
        let unspent = ut[k].stats.unspent_amount - ut[k].stats.spent_amount;
        balance += unspent / 1e8
    }

    return balance;
}

module.exports = obj ? obj : obj = new wallet;