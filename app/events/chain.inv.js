const events = require('../events');

events.on("chain.unconfirmedtx", function (params) {


    debug('warn', 'new unconfirmed tx', params);

    const { unconfirmed } = require("../db/blockchain");
    if (!params.list[0].time)
        params.list[0].time = new Date().getTime() / 1000;
    unconfirmed.addTx(params.list[0], function (txinfo, reslist) {
        events.emit("chain.unconfirmed.isnew", txinfo, reslist);
    });
    //check bloom filter with this tx
    //add to unconfirmed utxo
    //when have new block (or sync) - remove unconfirmed.


})

events.on("chain.unconfirmed.utxo.unspent", function (obj) {
    debug("info", 'new unspent index', obj);
})

events.on("chain.unconfirmed.utxo.spent", function (obj) {
    debug("info", 'new spent index', obj);
})

events.on("chain.unconfirmed.isnew", function (tx, reslist) {
    const wallet = require("../db/wallet");
    for (let i in reslist) {

        if (wallet.existAddress(reslist[i].address)) {
            let notify = require("../notify"), title, text, type = 'info';

            if (reslist[i].unspent === true) {
                type = 'success';
                title = "New unspent coins"
                text = '<b>+' + parseFloat(reslist[i].amount / 1e8).toFixed(9) + '</b> orwl, to address ' + reslist[i].address
            } else if (reslist[i].spent === true) {
                type = 'danger';
                title = 'New spent coins'
                text = '<b>-' + parseFloat(reslist[i].amount / 1e8).toFixed(9) + '</b> orwl, from address ' + reslist[i].address
            }

            if (!title) {
                debug('error', 'unexpected reslist item', reslist[i]);
            }

            notify[type](title, text, function (event) {
                events.emit("app.page.history", { address: reslist[i].address })
                this.defaultClickHandler(event);
            }, 1e4);
        }

    }

})