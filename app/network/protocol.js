/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

var networkMessage = require('./networkmessage');
var config = require('../../config');
var hash = require('../crypto');
var netevent = require('../events')
var indexes = require('../db/indexes')
var bitPony = require('bitpony');
var nodes = require('../db/nodes')
var thisnode = require('./thisnode');

module.exports = protocol = {
    chunks: [],
    nodename: '',
    createMessage: function (type, data) {

        var msg = JSON.stringify(data);
        //magic
        var buff = new Buffer(config[config.net].magic, 'hex');
        var writer = new bitPony.writer(buff);
        writer.uint32(rand(0, 0xffffffff), true)//message round number

        writer.uint32(0, true);//message order in list (used if messages count > 1). Can split big message to some small
        writer.uint32(1, true);//messages count
        //command,
        writer.string(type, true);
        //checksum,
        writer.hash(hash.sha256(hash.sha256(type + msg)).toString('hex'), true);
        //payload_raw,
        writer.string(msg, true);
        return writer.getBuffer()
    },
    readMessage: function (buff) {

        if (!(buff instanceof Buffer))
            buff = new Buffer(buff, 'hex');

        if (buff.toString('hex').indexOf(config[config.net].magic) != 0) {
            protocol.chunks.push(buff);
            buff = Buffer.concat(protocol.chunks);
            //return false;
        }

        var package = {}, data = null
        var reader = new bitPony.reader(buff);
        var res = reader.uint32(0);

        package.magic = res.result;
        res = reader.uint32(res.offset);
        package.rand = res.result;
        res = reader.uint32(res.offset);
        package.order = res.result;
        res = reader.uint32(res.offset);
        package.messages = res.result;
        res = reader.string(res.offset);
        package.command = res.result.toString('utf8');
        res = reader.hash(res.offset);
        package.checksum = res.result;
        res = reader.string(res.offset);
        package.payload = res.result;

        if (package.messages > 1) {
            if (!protocol.chunks[package.rand])
                protocol.chunks[package.rand] = {};
            protocol.chunks[package.rand][package.order] = package.payload;
            data = null;
            if (Object.keys(protocol.chunks[package.rand]).length >= package.messages) {
                var buffer = Buffer.concat(protocol.chunks[package.rand]);
                data = buffer.toString('utf8');
                protocol.chunks[package.rand] = null;
                delete protocol.chunks[package.rand];
            }
        }

        if (package.messages == 1)
            data = package.payload.toString('utf8');

        if (!data)//multiple message
            return false;

        var myhash = hash.sha256(hash.sha256(package.command + data)).toString('hex');
        if (myhash != package.checksum) {
            //not full message, wait another chunks
            protocol.chunks = [];
            protocol.chunks[0] = buff;
            if (config.debug.protocol)
                debug('error', "!! cant read message, hash is not valid or size of message is not equals, size (" + package.checksum + "," + myhash + ")")

            return false;
        }

        return [
            package.command,
            data ? JSON.parse(data) : {}
        ]
    },
    init: function () {
        global.config.init_started = 1;
        netevent.emit("network.init.start");

        var nodes = protocol.getNodeList();
        for (var i in nodes) {
            debug("info", 'init node ' + nodes[i])
            protocol.initNode(nodes[i])
        }
    },
    initNode: function (addr, afterInit) {
        netevent.emit("net.node.add", addr, function (rinfo) {


            netevent.on("net.node.init" + protocol.getAddressUniq(rinfo), function () {
                netevent.removeAllListeners("net.node.init" + protocol.getAddressUniq(rinfo));
                if (afterInit instanceof Function)
                    afterInit(rinfo);
            });


            var d = nodes.get("data/" + protocol.getAddressUniq(rinfo));
            d.initiator = 1;
            nodes.set("data/" + protocol.getAddressUniq(rinfo), d);
            protocol.sendOne(rinfo, 'version', {
                version: config.blockchain.version || 0,
                lastblock: indexes.get('top'),
                agent: protocol.getUserAgent(),
                nodeName: thisnode.name = protocol.getNodeName(),
                services: 2,//spv
                relay: false
            })
        });

    },
    getNodeList: function () {
        var list = nodes.get("connections");
        if (!list || !(list instanceof Array))
            list = [];

        if (!list.length) {
            let node_list = protocol.getNodesFromList();
            if (!node_list || !node_list.length)
                list = config.nodes;
            else
                list = node_list;
        }

        return list;
    },
    checkNodes: function () {


        var list = protocol.getNodeList();
        for (var i in list) {

            var socket = nodes.get("connection/" + list[i]);

            debug('info', "check peer " + list[i] + " OK: ", !(!socket || socket.destroyed === true));

            if (!socket || socket.destroyed === true) {
                debug('notice', "remove peer " + list[i])
                netevent.emit("net.connection.remove", list[i]);
            }


        }

    },
    getNodeName: function () {
        if (!global.config['publicKey'])
            throw new Error('error, to start node need generate KeyPair');
        return protocol.nodename = hash.generateAddress(global.config['publicKey'])
    },
    emit: function (data, rinfo, self) {

        var a = protocol.readMessage(data);
        if (a) {
            debug("info", "< recv " + a[0] + " < " + JSON.stringify(a[1]))
            netevent.emit("network.newmessage", { type: a[0], data: a[1], self: self || a[1].nodeName == protocol.nodename });
            new networkMessage(protocol, a[0], a[1], rinfo, self || a[1].nodeName == protocol.nodename);
            return a[1].nodeName;
        }

        return false;
    },
    sendAll: function (type, data) {
        debug('info', "> send [ all ] " + type + " > " + JSON.stringify(data))
        netevent.emit("network.emit", { type: type, data: data });
        netevent.emit("net.send", protocol.createMessage(type, data))
    },
    sendOne: function (rinfo, type, data) {
        debug('info', "> send [ one ] " + type + " > " + JSON.stringify(data))
        netevent.emit("network.send", { type: type, data: data, rinfo: rinfo });
        netevent.emit("net.send", protocol.createMessage(type, data), rinfo)
    },
    addNode: function (nodeAddr, cb) {

        var a = protocol.getUniqAddress(nodeAddr);

        nodeAddr = nodeAddr.replace("::ffff:", "")

        var adding = true;
        var list = nodes.get("connections");
        if (!list || !(list instanceof Array))
            list = [];


        var finded = false;
        for (var i in list) {
            if (list[i] && (list[i].indexOf(a.remoteAddress.replace("::ffff:", "")) >= 0 || list[i] == nodeAddr)) {
                finded = true;
                adding = false;
                break;
            }
        }

        if (!finded) {
            protocol.initNode(nodeAddr.replace("::ffff:", ""), cb);
            thisnode.nodeCount = list.length + 1;
        }

        return adding;
    },
    checkNodes: function () {

        let list = protocol.getNodeList();
        for (let i in list) {

            let socket = nodes.get("connection/" + list[i]);

            if (config.debug.peers)
                debug("check peer " + list[i] + " OK: ", !(!socket || socket.destroyed === true));

            if (!socket || socket.destroyed === true) {
                if (config.debug.peers)
                    debug("remove peer " + list[i])
                netevent.emit("net.connection.remove", list[i]);

                if (!list[i])
                    return;

                if (config.debug.peers)
                    debug("try reconnect peer " + list[i])
                protocol.addNode(list[i], function () {
                    if (config.debug.peers)
                        debug("reconnected to peer " + list[i])
                })
            }


        }

    },
    getAddressUniq: function (rinfo) {
        return rinfo.remoteAddress.replace("::ffff:", "") + "/" + rinfo.remotePort + "/" + rinfo.port
    },
    getUniqAddress: function (key) {
        if (!key)
            throw new Error('undefined key');
        var a = key.split("/");
        return {
            remoteAddress: a[0],
            remotePort: a[1],
            port: a[2]
        }
    },
    exceptNode: function (addr) {
        var arr = [];

        var list = nodes.get("connections");
        if (!list || !(list instanceof Array))
            list = [];

        if (!list.length)
            list = config.nodes;

        for (var i in list)
            if (list[i] != addr) {
                var a = protocol.getUniqAddress(list[i]);

                if (a.remoteAddress.indexOf("127.0.0.1") >= 0 || (addr && a.remoteAddress.indexOf(addr) >= 0))
                    continue;

                var key = a.remoteAddress.replace("::ffff:", "") + "//" + a.port;
                if (arr.indexOf(key) < 0)
                    arr.push(key);
            }

        return arr;
    },
    getNodesFromList: function () {
        const fs = require('fs')
        const app = require('electron').app
        let path = app.getPath('userData') + "/nodes.conf";
        let content = ""
        try {
            content = fs.readFileSync(path).toString();
        } catch (e) {
            debug(e);
            //fs.closeSync(fs.openSync(path, 'w'));
        }

        let nodes_conf = content.split("\n");
        let node_list = [];
        for (let i in nodes_conf) {
            if (nodes_conf[i].trim())
                node_list.push(nodes_conf[i].trim());
        }

        return node_list
    },
    saveNodesToList: function (nodes) {
        const app = require('electron').app
        const fs = require('fs')
        let path = app.getPath('userData') + "/nodes.conf";
        fs.writeFileSync(path, nodes.join("\n"));
    },
    saveNodes: function () {
        const app = require('electron').app
        const fs = require('fs')
        let path = app.getPath('userData') + "/nodes.conf";
        let nodes = protocol.exceptNode();

        let node_list = protocol.getNodesFromList();
        for (let i in nodes) {
            let finded = 0;

            for (let k in node_list) {
                if (nodes[i] == node_list[k]) {
                    finded = 1;
                    break;
                }
            }

            if (finded)
                continue;

            if (nodes[i])
                node_list.push(nodes[i].trim());
        }

        protocol.saveNodesToList(node_list)
    },
    getRandomNode: function () {
        var list = protocol.exceptNode(""), n = list[rand(0, list.length - 1)];
        return n;
    },
    getUserAgent: function () {
        var os = require('os'), process = require('process')
        var ua = "%agent%:%agent_ver% (Electron:%electron_ver%)/%net%:%blockchain_ver%/%platform%:%platform_ver%/%os%:%os_ver%/%services%:%relay%/%uptime%";
        return ua
            .replace("%electron_ver%", process.versions.electron)
            .replace("%agent%", config.agent)
            .replace("%agent_ver%", config.agent_version)
            .replace("%net%", config.net)
            .replace("%blockchain_ver%", config.blockchain.version)
            .replace("%platform%", 'nodejs')
            .replace("%platform_ver%", process.version)
            .replace("%os%", os.platform())
            .replace("%os_ver%", os.release())
            .replace("%services%", 2)
            .replace("%relay%", !!config.relay)
            .replace("%uptime%", process.uptime());
    },
    createCheckNodeTask: function (seconds) {
        setTimeout(function () {

            debug('debug', "check nodes");
            protocol.checkNodes();
            protocol.saveNodes();
            protocol.createCheckNodeTask(seconds)

        }, seconds);
    }
};

var rand = function (min, max) {
    return parseInt(Math.random() * (max - min) + min);
}