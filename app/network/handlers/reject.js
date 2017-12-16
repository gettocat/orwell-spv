/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

var chainEvents = require('../../events')

module.exports = function (opts, self) {

    if (self) {
        return false;
    }

    chainEvents.emit("chain.reject", {
        rinfo: this.rinfo,
        hash: opts.hash,
        errors: opts.errors
    });

    return {};
}