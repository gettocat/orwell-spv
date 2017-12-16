const events = require('../events');
const config = require('../../config');

events.on("chain.blockheaders", function (params) {

    if (params.list_cnt && !params.synced) {

        const { chain, util, indexes } = require('../db/blockchain');
        params.list = util.uniquely(params.list)

        for (var i in params.list) {

            const blockhash = util.blockhash(params.list[i]);
            events.emit("chain.blockheaders.process", params.count, parseInt(params.offset) + parseInt(i));
            if (indexes.haveblock(blockhash))
                if (config.debug.blockchain.sync)
                    debug("block " + blockhash + " already exist in db, skip")

            chain.appendBlockFromHEX(params.list[i], function (block, isExist, isAddedToMainChain) {

                if (config.debug.blockchain.sync)
                    debug("block " + block.hash + " existing before: " + isExist + " added to mainhain " + isAddedToMainChain)

                if (!isAddedToMainChain && !indexes.haveblock(block.hash)) {
                    if (config.debug.blockchain.sync)
                        console.log("block " + block.hash + " maybe wrong, but save him to memblock storage ")

                }

                events.emit("chain.block." + block.hash, block);

            });

        }


        if (params.next_offset)
            protocol.sendOne(params.rinfo, 'getblocks', {
                headhash: params.queryhash,
                offset: params.next_offset
            });
        else {
            events.emit("chain.netsync.block.end");
        }

        events.emit("chain.netsync.block.process", params.count, parseInt(params.offset) + parseInt(0));
        var forkState = 0;

        var firsthash = util.blockhash(params.list[0]);
        if (params.list.length == 1 && params.queryhash != firsthash)//now we in fork state
            forkState = 1;

    } else
        events.emit("chain.netsync.block.end");

})