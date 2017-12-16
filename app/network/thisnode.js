/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

module.exports = {
    name: '',
    addr: '',
    activeConnectionCount: '',
    nodeCount: '',
    connected: false,
    synced: false,
    updateCounters: function (nodeName) {
        if (!global.activeConnections)
            global.activeConnections = {};

        if (!global.activeConnections[nodeName])
            global.activeConnections[nodeName] = 1;
        else
            global.activeConnections[nodeName]++;

        console.log('active', module.exports.activeConnectionCount = Object.keys(global.activeConnections).length);
    }

}