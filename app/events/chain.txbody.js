const events = require('../events');


events.on("chain.updatetxbody", function () {
    if (!global.blockchain_synced)
        return;//only when all merkle blocks for this filter is recived

    events.emit("chain.calltxbody.start", 0);

})

events.on("chain.calltxbody.start", function () {
    //1. take 2000 items
    //2. make gettxdata
    //3. wait empty inv,
    //go to 1 while have items
    events.emit("chain.calltxbody", 0);
})

events.on("chain.calltxbody", function (nextoffset) {
    const protocol = require('../network/protocol')
    const { txlist } = require('../db/blockchain')
    const alltx = txlist.count();
    const hashes = txlist.findNoBody(nextoffset, 2000);

    if (hashes.length > 0) {

        events.emit("chain.txbody.process", alltx, nextoffset);
        events.on("chain.txbody.endslice." + (hashes[0] + hashes[hashes.length - 1]), function (slice) {

            events.removeAllListeners("chain.txbody.endslice." + slice);
            events.emit("chain.calltxbody", nextoffset + 2000);

        });

        var rinfo = protocol.getUniqAddress(protocol.getRandomNode())
        //todo: change that to send One
        protocol.sendAll('gettxdata', {
            hash: hashes
        })
    } else {
        //we a catch all blocks. can finish update.
        events.emit("chain.txbody.process", alltx, alltx);
        events.emit("chain.txbody.finish")
    }
});

events.on("chain.txbody", function (params) {

    //if we find empty 
    if (params.list.length == 0) {//notice, what mean that previous slice of data is complete sended, can serve next.

        //call next slice of data
        events.emit("chain.txbody.endslice." + params.queryhash, params.queryhash)

    } else {
        //get target tx, 
        //check
        //save in indexes
        var txinfo = params.list[0];

        if (txinfo.fromBlock) {
            const { txlist, unconfirmed } = require('../db/blockchain')
            try {
                txlist.saveBody(txinfo);
                unconfirmed.removeTx(txinfo);
            } catch (e) {
                debug('error', 'save tx body error', e.message)
            }
        } else {
            events.emit("chain.unconfirmed.txbody", params);
        }

    }

});

events.on("chain.txbody.finish", function () {

    debug('info', 'all tx in database. Build utxo for all addresses')
    events.emit("chain.utxo.update");

})