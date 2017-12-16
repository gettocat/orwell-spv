/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

//client implementation only, its not fullnode. server is not need there
var evnet = require('../events');
var netEvents = require('../events');
var nodes = require('../db/nodes')
var net = require('net');
var config = require('../../config');
var split = require('split');

function newClient(host, port) {
    debug('info','connect to ',host, port)
    var client = net.connect(port, host);
    processData.client = "";
    var st = client.pipe(split(processData.sep));
    st.on('data', function (data) {
        data = processData.sep + data;
        processData.client += data;
        var res = processData('client');
        for (var i in res) {
            netEvents.emit("net.message", client, res[i]);
        }
    });

    client.on('close', function () {
        netEvents.emit("net.close", client);
    })

    client.on('error', function (e) {
        netEvents.emit("net.error", e, client);
    })

    client.on("end", function () {
        netEvents.emit("net.close", client, 'end');
    })


    return client;

}


var processData = function (key) {

    var res = processData[key].split(processData.sep);
    if (res.length == 1) {
        //its part of previous message
        return res;
    }

    var result = [], cnt = 0
    for (var i in res) {
        if (i == 0 && res[i] != '') {
            result.push(res[i]);
        } else if (res[i] && res[i].length > 0) {
            var r = processData.sep + res[i];
            result.push(r);
            cnt++;
        }
    }

    processData[key] = "";
    return result;

}

processData.sep = config[config.net].magic

module.exports = newClient