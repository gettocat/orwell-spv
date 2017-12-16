let obj = null
const config = require('../../config')
const headers = require('./blockheaders')
const indexes = require('./indexes')
const Block = require('./blockchain/block')
const genesis = require('./blockchain/genesis');
const orphan = require('./orphan')
const util = require('./blockchain/util')
const chainEvents = require('../events')
const bloom = require('./blockchain/bloom')
const merkle = require('./blockchain/merkle')
const txlist = require('./txlist')
const utxo = require('./utxo')

let blockchain = function () {
    this.db = headers
}

blockchain.prototype = {
    action: '',
    db: null,
    getTx: function (hash) {
        var txk = indexes.get("tx/" + hash);

        if (txk) {

            var b = this.getBlock(txk.block);
            var tx = b.tx[txk.index];
            tx.confirmation = indexes.get('top').height - b.height + 1;
            tx.fromBlock = b.hash;
            tx.fromIndex = txk.index;
            return tx;

        } else {
            throw new Error('can not find tx ' + hash);
            //do inv with this hash
            return null;
        }

    },
    getOut: function (hash, index) {
        var tx = this.getTx(hash);
        return tx.out[index]
    },
    index: function (b, height, events) {
        indexes.set("index/" + height, b.hash);
        indexes.set("time/" + b.hash, b.time);
        indexes.set("block/" + b.hash, {
            prev: b.prev_block || b.hashPrevBlock,
            height: height
        });
    },
    indexBlocks: function (blocks) {
        var last = 0, dbheight = 0, m = 0, commonCnt = blocks.length, synced = false;
        if (config.debug.blockchain.indexing)
            debug("blockchain indexing: started");

        try {
            if (indexes.get('top').hash == blocks[blocks.length - 1].hash)
                synced = true;
        } catch (e) {
            console.log(e);
        }

        if (synced) {
            if (config.debug.blockchain.indexing)
                debug("blockchain indexing: already synced");
        } else {
            for (var i in blocks) {
                var b = blocks[i];

                if (!b)
                    continue;

                if (!(b instanceof Block)) {
                    var b1 = new Block();
                    b = b1.fromJSON(b);
                }

                if (m % 10 == 0 && config.debug.blockchain.indexing)
                    debug("blockchain indexing: " + (parseInt((m / commonCnt) * 100)) + "%");

                indexes.setContext(dbheight);
                this.index(b, dbheight, false);
                indexes.setContext(null);

                //todo add txHash -> block hash to find tx fast
                last = b.hash;
                dbheight++;
                m++;
            }
            if (config.debug.blockchain.indexing)
                debug("blockchain indexing: done. head block: " + last + ", height: " + (dbheight - 1));
            indexes.updateTop({
                hash: last,
                height: dbheight - 1,
            })
        }
    },
    getBlock: function (hash) {
        var block = this.db.getBlock(hash)
        if (block.hash) {
            delete block.meta
            delete block.$loki;
            block.confirmation = indexes.get('top').height - block.height + 1;
        }

        return block;
    },
    hardReIndexing: function () {
        if (config.debug.blockchain.indexing)
            debug("hardresync indexes, close db");
        var f = this;
        indexes.deleteDB()
            .then(function () {
                if (config.debug.blockchain.indexing)
                    debug("hardresync indexes, open db, resync");
                f.sync();
            })
    },
    replaceBlock: function (height, hash, replaceblock) {

        try {
            var block = this.getBlock(hash);
            this.db.removeBlock(block);
            //remove index for this height
            replaceblock.height = height;
            this.db.save(replaceblock);
            this.db.saveDb();

            indexes.setContext(height);
            //index this block (for sync new chain only, next - reindex all blockchain)
            var b = new Block();
            b.fromJSON(replaceblock);

            this.index(b, height, false);
            indexes.setContext(null);

        } catch (e) {
            console.log(e)
        }
    },
    getChilds: function (hash) {
        return this.db.findBlocks({ prev_block: hash });
    },
    bestChain: function () {

        var top = indexes.get('top').hash;
        var gen = genesis().hash;
        var hash = top, chain = [];
        while (hash != gen) {
            chain.push(hash);
            hash = indexes.get("block/" + hash).prev;
        }
        return chain;
    },
    sync: function () {
        chainEvents.emit("chain.localsync.start");

        this.resync();

        chainEvents.emit("chain.localsync.end", {
            topblock: indexes.get('top'),
        });
    },
    resync: function () {
        var commonCnt = this.db.blockCount(), m = 0;
        if (config.debug.blockchain.indexing)
            debug("blockchain local sync: finded " + commonCnt + " records, reading:");
        var offset = 0, cnt = 1000, arr = [], blocks = []
        do {
            arr = [];
            arr = this.db.loadBlocks(commonCnt);//asc//todo, fix limit,offset
            for (var i in arr) {
                if (arr[i]) {
                    var b = new Block();
                    b.fromJSON(arr[i])
                    blocks.push(b);
                    m++;

                    if (config.debug.blockchain.indexing)
                        debug("blockchain local sync: " + (parseInt((m / commonCnt) * 100)) + "%");

                    chainEvents.emit("chain.localsync.process", m / commonCnt);

                }
            }


            offset += 1000;
        } while (!1)//arr.length
        if (config.debug.blockchain.indexing)
            debug("blockchain local sync: 100%");
        if (!Object.keys(blocks).length) {
            var gen = genesis();
            var b = this.db.get(gen.hash);
            if (!b || !b.hash) {
                indexes.updateTop({ hash: gen.hash, height: 0 });
                gen.height = 0;
                gen.genesis = 1;
                blocks.push(gen);
                this.appendBlock(gen, 1);
            }
        }


        this.indexBlocks(blocks);
    },
    appendBlock: function (block, isgenesis, cb) {
        if (!block instanceof Block)
            throw new Error('block object must be instanceof Block class to appending in Blockchain');

        var b = false;
        try {
            b = this.getBlock(block.hash);
            block.validation_erros = [];
            block.validation_erros.push('duplicate');
        } catch (e) {

        }
        if (b && b.hash) {
            if (cb instanceof Function)
                cb(block, 1, 1);
            return;
            //throw new Error('block ' + block.hash + ' already exist');
        }

        var prevblockinfo = indexes.get("block/" + block.hashPrevBlock);
        block.height = prevblockinfo.height + 1;
        var blockvalid = block.isValid()

        if (block.hash == genesis().hash)
            isgenesis = 1;


        var inMainChain = 0;
        if (blockvalid && !isgenesis) {
            this.index(block, prevblockinfo.height + 1, this.action == 'seek');

            block.height = prevblockinfo.height + 1;
            debug('info', 'top', indexes.get('top'), 'block height', block.height);
            if (block.height > indexes.get('top').height) {

                inMainChain = 1;
                this.db.save(block.toJSON());
                debug('info', 'updateTop', prevblockinfo.height + 1);
                indexes.updateTop({
                    hash: block.hash,
                    height: prevblockinfo.height + 1
                });

            }

        } else if (isgenesis) {

            indexes.setContext(0)
            this.index(block, 0, false);
            indexes.setContext(null)

            inMainChain = 1;
            this.db.save(block.toJSON());
            
            indexes.updateTop({
                hash: block.hash,
                height: 0
            });


        }

        if (cb instanceof Function)
            cb(block, 0, inMainChain);
    },
    appendBlockFromHEX: function (hex, cb) {
        var b = new Block();
        b.fromHex(hex);
        return this.appendBlock(b, false, cb);
    },
    appendBlockFromJSON: function (json, cb) {
        var b = new Block();
        b.fromJSON(json);
        return this.appendBlock(b, false, cb);
    },
    findBlockHashes: function (hashto) {
        var ghash = genesis().getHash();

        var isExistBlockInChain = 0;

        var existHash = null;
        try {
            existHash = this.getBlock(hashto);
        } catch (e) {

        }
        if (existHash && existHash.hash)
            isExistBlockInChain = 1;

        var hash = indexes.get('top').hash;
        var arr = [];
        arr.unshift(hash);
        if (isExistBlockInChain)
            do {
                var p = indexes.get("block/" + hash);
                if (!p && !p.prev)
                    hash1 = this.getBlock(hash).hashPrevBlock
                else
                    hash1 = p.prev;

                arr.unshift(hash1);
                hash = hash1
            } while (hash != hashto && hash != ghash);

        return arr;

    },
    getBlocks: function (count, offset) {
        return this.db.loadBlocks(count, offset);
    },
    findLastBlocks: function (count, offset) {
        return this.db.getLastBlocks(count, offset);
    },
    findPreviousBlocks: function (from, count) {
        //and from too;
        if (!count)
            count = 1;
        var list = [], i = 0, block = null;
        try {
            do {
                if (block)
                    list.push(block);

                var prev = from;
                if (block)
                    prev = block.hashPrevBlock || block.prev_block;
                block = this.getBlock(prev);

                if (from)
                    from = null
            } while (i++ < count && block.hash);
        } catch (e) {
            console.log(e);
        }

        return list;
    },
    getCount: function () {
        return this.db.blockCount();
    },
    getLastBlock: function () {
        return this.db.getLastBlock();
    },
    validateMerkleBlock: function (blockinfo) {
        var targets = [], block;

        try {
            block = this.getBlock(blockinfo.hash);
        } catch (e) {
            throw new Error('block ' + blockinfo.hash + ' is not finded in blockchain');
        }

        if (block.mrkl_root != blockinfo.mrkl_root)
            throw new Error('Merkle root is not vaild');

        for (var i in blockinfo.proofs) {

            const proofs = blockinfo.proofs[i];
            const target = proofs.shift();
            const flags = parseInt(blockinfo.flags[i]).toString(2).split("").reverse();
            var rootproofs = [];

            for (var k in proofs) {
                var obj = {}, dir = 'right';
                if (parseInt(flags[k]) == 1)
                    dir = 'left';

                obj[dir] = proofs[k];
                rootproofs.push(obj);
            }

            if (merkle.validateProof(rootproofs, target, block.mrkl_root)) {
                targets.push(target);
            } else {
                debug("merkle debug", rootproofs, target, block.mrkl_root)
                throw new Error('malformed merkleblock');
            }

        }

        return targets;

    }
}


module.exports = {
    headers: headers,
    indexes: indexes,
    chain: obj ? obj : obj = new blockchain,
    genesis: genesis,
    orphan: orphan,
    util: util,
    bloom: bloom,
    merkle: merkle,
    txlist: txlist,
    utxo: utxo,
    unconfirmed: require('./unconfirmed'),
    Script:  require('./blockchain/script')
}