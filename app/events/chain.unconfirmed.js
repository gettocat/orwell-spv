const events = require('../events');
const protocol = require('../network/protocol')
var unconfirmed_list = [];

events.on("chain.unconfirmed.update", function () {

    const { unconfirmed } = require('../db/blockchain')
    unconfirmed.clear();
    //var rinfo = protocol.getUniqAddress(protocol.getRandomNode())
    protocol.sendAll('gettx', {
        count: 0,
    });


});

events.on("chain.unconfirmed.hashes", function (list) {

    if (list instanceof Array)
        unconfirmed_list = list;
    events.emit("chain.callunconfirmed", 0);

});


events.on("chain.callunconfirmed", function (nextoffset) {
    const protocol = require('../network/protocol')
    const hashes = unconfirmed_list.slice(nextoffset, nextoffset + 2000);

    if (hashes.length > 0) {

        events.emit("chain.unconfirmed.process", unconfirmed_list.length, nextoffset);
        events.on("chain.txbody.endslice." + (hashes[0] + hashes[hashes.length - 1]), function (slice) {

            events.removeAllListeners("chain.txbody.endslice." + slice);
            events.emit("chain.callunconfirmed", nextoffset + 2000);

        });

        var rinfo = protocol.getUniqAddress(protocol.getRandomNode())
        //todo: change that to send One
        protocol.sendAll('gettxdata', {
            hash: hashes
        })
    } else {
        //we a catch all blocks. can finish update.
        events.emit("chain.unconfirmed.process", unconfirmed_list.length, unconfirmed_list.length);
        events.emit("chain.unconfirmed.finish");
    }
});

events.on("chain.unconfirmed.txbody", function (params) {

    //get target tx, 
    //check
    //save in indexes
    var txinfo = params.list[0];
    const { unconfirmed } = require('../db/blockchain')
    try {
        if (!txinfo.time)
            txinfo.time = new Date().getTime() / 1000;
        unconfirmed.addTx(txinfo, function (txinfo, reslist) {
            events.emit("chain.unconfirmed.isnew", txinfo, reslist);
        });
    } catch (e) {
        debug('error', 'save unconfirmed tx body error', e.message)
    }

});

events.on("chain.unconfirmed.finish", function () {

    debug('info', 'all tx from mempool in database.')

})