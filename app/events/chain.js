const events = require('../events')

events.on("chain.localsync.start", function () {
    debug('info', "start sync blockchain")
})

events.on("chain.localsync.end", function () {
    debug('info', "end sync blockchain");
    const network = require('../network/transport');
    network();
})

events.on("network.init.start", function () {
    debug('info', "network init started");
    
    const protocol = require('../network/protocol');
    protocol.createCheckNodeTask(300000);
})


events.on("chain.inventory.chunk", function (params) {

    if (params.type == 'block') {
        events.emit("chain.blockheaders", params);
    }

    if (params.type == 'newtx') {
        events.emit("chain.unconfirmedtx", params);
    }

    if (params.type == 'merkleblock') {
        events.emit("chain.merkleblock", params);
    }

    if (params.type == 'tx') {
        events.emit("chain.unconfirmed.hashes", params.list);
    }

    if (params.type == 'txdata') {
        events.emit("chain.txbody", params);
    }

});

events.on("chain.update.need", function (rinfo) {
    const nodeInfo = { rinfo: rinfo };
    const protocol = require('../network/protocol')

    protocol.sendAll('getblocks', {
        headhash: indexes.get('top').hash,
    });

})

events.on("chain.filter.change", function (filter, hex) {

    const { indexes, txlist, utxo } = require('../db/blockchain')
    if (indexes.get('filter').hex != hex) {
        debug('filterhex changes', hex);
        //make something with old filter, update txlist.

        var oldfilterhex = indexes.get('filter');
        txlist.setFilter(oldfilterhex)
        txlist.clear();
        utxo.clear();

        indexes.set('filter', { hex: hex });
        txlist.setFilter(hex);
        if (global.headers_synced == 1) {
            global.blockchain_synced = 0;
            global.preloader = 1;
            indexes.set('merkletop', {height: 0});
            events.emit("chain.callmerkleblock.start");
        }
    }

});

events.on("chain.netsync.block.end", function () {

    global.headers_synced = 1;//we need update txlist only when headers is fully synced.
    debug('chain netsync end', global.blockchain_synced);
    //now we have block headers and setup bloom filter at every node. Need ask getblockdata message and recv merkleblock
    if (!global.blockchain_synced) {
        global.blockchain_synced = -1;//process

        events.emit("chain.callmerkleblock.start");
    }

});

events.on("chain.top.update", function (newtop, oldtop) {

    if (global.blockchain_synced == 1 && global.headers_synced) {
        debug('come new block, update merkleblocks');
        global.new_top = 1;
        events.emit("chain.callmerkleblock.start", oldtop.height);
    }

});

events.on("chain.reject", function (params) {

    let notify = require("../notify");
    notify.danger('Transaction was rejected', 'Your transaction ' + params.hash + ' was rejected from node with reasons: ' + params.errors.join(","), function (event) {
        events.emit("app.page.history")
        this.defaultClickHandler(event);
    }, 6000);

    const { unconfirmed } = require('../db/blockchain')
    try {
        let tx = unconfirmed.getTx(params.hash);
        unconfirmed.removeTx(tx, true);
    } catch (e) {
        debug(e)
    }


})


require('./chain.headers')
require('./chain.inv')
require('./chain.merkleblock')
require('./chain.txbody')
require('./chain.utxo')
require('./chain.unconfirmed')