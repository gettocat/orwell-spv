const events = require('../events');


events.on("chain.callmerkleblock.start", function (height) {
    //1. take 200 items
    //2. make getblockdata
    //3. wait empty inv,
    //go to 1 while have items
    const { indexes } = require('../db/blockchain')
    const cachedHeight = indexes.get('merkletop').height || 0;
    debug('info', 'cached height in merkle: ', height || cachedHeight)
    events.emit("chain.callmerkleblock", height || cachedHeight);
})

events.on("chain.callmerkleblock", function (nextoffset) {
    const protocol = require('../network/protocol')
    const { chain, indexes } = require('../db/blockchain')
    const list = chain.getBlocks(200, nextoffset);
    const allheaders = chain.getCount();
    let hashes = [];
    for (var i in list) {
        hashes.push(list[i].hash);
    }

    if (hashes.length > 0) {

        events.emit("chain.merkleblocks.process", allheaders, nextoffset);
        debug("set new merkletop", { height: nextoffset + hashes.length - 1, hash: hashes[hashes.length - 1] })
        indexes.set('merkletop', { height: nextoffset + hashes.length - 1, hash: hashes[hashes.length - 1] });
        events.on("chain.merkleblock.endslice." + (hashes[0] + hashes[hashes.length - 1]), function (slice) {

            events.removeAllListeners("chain.merkleblock.endslice." + slice);
            events.emit("chain.callmerkleblock", nextoffset + 200);


        });

        var rinfo = protocol.getUniqAddress(protocol.getRandomNode())
        //todo: change that to send One
        protocol.sendAll('getblockdata', {//before that - we send filterload, so we hope(yes, hope), that node undestand that need send merkleblock.
            hash: hashes
        })
    } else {
        //we a catch all blocks. can finish update.
        events.emit("chain.merkleblocks.process", allheaders, allheaders);
        const p = { height: allheaders - 1, hash: chain.getLastBlock().hash };
        debug("set new merkletop", p)
        indexes.set('merkletop', p);
        events.emit("chain.callmerkleblock.finish");
    }
});

events.on("chain.merkleblock", function (params) {

    //if we find empty 
    if (params.list.length == 0) {//notice, what mean that previous slice of data is complete sended, can serve next.


        //call next slice of data
        events.emit("chain.merkleblock.endslice." + params.queryhash, params.queryhash)


    } else {

        //get target tx, 
        //check
        //save in indexes
        var blockinfo = params.list[0];
        const { chain, txlist } = require('../db/blockchain')

        try {
            const targets = chain.validateMerkleBlock(blockinfo);
            txlist.appendTx(targets);
        } catch (e) {
            debug('error', 'validate merkle block error', e.message)
        }


    }

})

events.on("chain.callmerkleblock.finish", function () {

    const { txlist } = require('../db/blockchain')
    debug('update finished. tx:', txlist.count());

    //get all tx from indexes and get tx data by hashes. 
    //when all tx come - save tx, calculate UTXO, sync complete. 

    global.blockchain_synced = 1;
    events.emit("chain.updatetxbody");

});