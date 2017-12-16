/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

var thisnode = require('../thisnode');
module.exports = function (data, self) {

    if (self)
        return false;

    thisnode.updateCounters(data.nodeName)
    //save last ping from client (client alive)

    return {
        sendBack: true,
        type: 'pong',
        response: {}
    }

}