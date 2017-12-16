/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

var chainEvents = require('../../events')

module.exports = function (opts, self) {

    if (self && opts.object_type != 'newblock' && opts.object_type != 'newtx') {
        return false;
    }

    chainEvents.emit("chain.inventory.chunk", {
        rinfo: this.rinfo,
        synced: opts.synced,
        type: opts.object_type,
        count: opts.object_count,
        offset: opts.object_offset || 0,
        next_offset: opts.object_next_offset,
        list_cnt: opts.object_listed,
        list: opts.object_list,
        queryhash: opts.object_queryhash
    });

    return {};
}