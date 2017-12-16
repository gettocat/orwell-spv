/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

const { chain, indexes } = require('../blockchain')
const config = require('../../../config');

function inv(type, tophash, offset) {
    this.type = type;
    this.offset = offset || 0;
    this.hash = tophash;
    try {
        this.init();
    } catch (e) {
        console.log(e);
    }
}

inv.prototype = {
    result: null,
    init: function () {
        switch (this.type) {
            case 'block':
                this.findBlocks();
                break;
            case 'newtx':
                this.emitTx();
                break;
            default:
                throw new Error('inv has unknow type ' + this.type);
        }

    },
    findBlocks: function () {

        if (indexes.get('top').hash == this.hash) {
            var arr = [], list = [];
        } else {
            var arr = chain.findBlockHashes(this.hash), list = [];//asc
            if (arr.length > config.limits.invblocks) {
                var i = this.offset + config.limits.invblocks;
                if (i >= arr.length - 1)
                    i = arr.length - 1;

                list = arr.slice(this.offset, i);
            } else {
                list = arr;
            }
        }

        this.list = {
            synced: this.hash == indexes.get('top').hash,
            object_type: this.type,
            object_count: arr.length,
            object_offset: this.offset,
            object_next_offset: arr.length > config.limits.invblocks ? (arr.length < this.offset ? 0 : this.offset + config.limits.invblocks) : 0,
            object_listed: list.length,
            object_list: list,
            object_queryhash: this.hash,
        };


    },
    emitTx: function () {

        if (this.offset)//hack offset in this case - content of tx
            this.list = {
                synced: true,
                object_type: 'newtx',
                object_listed: 1,
                object_count: 1,
                object_list: [this.offset], //offset its content of tx in this case
            }

    },
    getList: function () {
        return this.list;
    }
}

module.exports = inv;