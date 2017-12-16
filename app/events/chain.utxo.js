const events = require('../events');

events.on("chain.utxo.update", function () {

    //for every tx in txlist we calculate utxo for input and outputs.
    const { txlist, utxo } = require('../db/blockchain')
    const list = txlist.getList();
    const unindexed = utxo.getUnIndexed(list);

    for (var i in unindexed) {
        var tx = txlist.getTx(unindexed[i])
        if (tx)
            utxo.addTx(tx);
        events.emit("chain.utxo.process", unindexed.length, i);    
    }

    events.emit("chain.unconfirmed.update");
    events.emit("chain.sync.complete");

})