/*
 * Orwell http://github.com/gettocat/orwell
 * Platform for building decentralized applications
 * MIT License
 * Copyright (c) 2017 Nanocat <@orwellcat at twitter>
 */

var bitPony = require('bitpony');

bitPony.extend('filterload', function () {
    return {
        read: function (buffer) {
            if (typeof buffer == 'string')
                buffer = new Buffer(buffer, 'hex')

            if (buffer.length == 0 || !buffer)
                buffer = new Buffer([0x0]);

            var offset = 0, stream = new bitPony.reader(buffer);
            var res = stream.var_int(offset);
            var count = res.result, vData = [], nHashFuncs, nTweak, nFlags;
            offset = res.offset;
            for (var i = 0; i < count; i++) {
                res = stream.uint8(offset)
                vData.push(res.result);
                offset = res.offset;
            }

            res = stream.uint32(offset);
            nHashFuncs = res.result;
            offset = res.offset;

            res = stream.uint32(offset);
            nTweak = res.result;
            offset = res.offset;

            res = stream.uint8(offset);
            nFlags = res.result;
            offset = res.offset;

            return {
                nFlags: nFlags,
                nHashFuncs: nHashFuncs,
                nTweak: nTweak,
                vData: vData
            }
        },
        write: function (vData, nHashFuncs, nTweak, nFlags) {
            var len = vData.length;
            var writer = new bitPony.writer(new Buffer(""));
            writer.var_int(len, true);
            for (var i in vData) {
                writer.uint8(vData[i], true);
            }

            writer.uint32(nHashFuncs, true);
            writer.uint32(nTweak, true);
            writer.uint8(nFlags, true);
            return writer.getBuffer().toString('hex')
        },
    }
});

bitPony.extend('filteradd', function () {
    return {
        read: function (buffer) {
            if (typeof buffer == 'string')
                buffer = new Buffer(buffer, 'hex')

            if (buffer.length == 0 || !buffer)
                buffer = new Buffer([0x0]);

            var offset = 0, stream = new bitPony.reader(buffer);
            var res = stream.var_int(offset);
            var count = res.result, vData = []
            offset = res.offset;
            for (var i = 0; i < count; i++) {
                res = stream.uint8(offset)
                vData.push(res.result);
                offset = res.offset;
            }


            return vData
        },
        write: function (vData) {
            var len = vData.length;
            var writer = new bitPony.writer(new Buffer(""));
            writer.var_int(len, true);
            for (var i in vData) {
                writer.uint8(vData[i], true);
            }

            return writer.getBuffer().toString('hex')
        },
    }
});


bitPony.extend('orwell_block', function () {//datascript...

    return {
        read: function (buffer, rawTx) {
            if (typeof buffer == 'string')
                buffer = new Buffer(buffer, 'hex')

            if (buffer.length == 0 || !buffer)
                buffer = new Buffer([0x0]);

            var offset = 0, stream = new bitPony.reader(buffer);
            var block = {}
            var res = stream.header(offset);
            offset = res.offset;
            block.header = res.result;

            var tx = [];

            for (var i = 0; i < block.header.txn_count; i++) {

                var startoffset = offset;
                res = stream.tx(offset);
                offset = res.offset;
                var tx_item;
                var dsstart = offset;

                if (buffer[offset] == 0xef) {//have datascript array
                    res = stream.var_int(offset + 1)
                    offset = res.offset;
                    var script_cnt = res.result;
                    var scripts = [];
                    for (var k = 0; k < script_cnt; k++) {
                        res = stream.string(offset);
                        offset = res.offset;
                        scripts.push(res.result)
                    }

                } else if (buffer[offset] == 0xee) {//have datascript

                    res = stream.uint8(offset + 1);
                    offset = res.offset;
                    res = stream.string(offset);
                    offset = res.offset;
                    res = stream.string(offset);
                    offset = res.offset;

                }

                if (offset > dsstart && !rawTx)
                    tx_item.datascript = buffer.slice(dsstart, offset).toString('hex');


                if (rawTx)
                    tx_item = buffer.slice(startoffset, offset).toString('hex');

                tx.push(tx_item)
            }

            block.txn_count = tx.length;
            block.txns = tx;
            return block

        },
        write: function (block) {

            var header = bitPony.header.write(block.version, block.prev_block || block.hashPrevBlock, block.merkle_root || block.hashMerkleRoot || block.merkle, block.time, block.bits, block.nonce);
            var length = bitPony.var_int(block.vtx.length);
            var txlist = new Buffer('');

            for (var i in block.vtx) {
                txlist += new Buffer(block.vtx[i].toHex(), 'hex');
            }

            return Buffer.concat([
                header,
                length,
                txlist
            ])

        }
    }

});