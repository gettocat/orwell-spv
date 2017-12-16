const events = require('../events')
const path = require('path')
const url = require('url')
const app = require('electron').app
const { ipcMain } = require('electron')
const dispatch = require('../dispatch')
const windowManager = require('../window')
const ejs = require('ejs');
const fs = require('fs')
const config = require('../../config');

let window

events.on("app.init", function (w) {
    global.config = {};
    window = w
    windowManager.appendWindow(-1, w)

    const dbconn = require('../db/types/connection')(app.getPath('userData'))
    const dbconnection = new dbconn(config.net == 'mainnet' ? 'wallet.dat' : 'wallet.testnet.dat');
    const dbconnection_blockchain = new dbconn(config.net == 'mainnet' ? 'blockchain.dat' : 'blockchain.testnet.dat');
    const dbmemory = new dbconn('memindex');
    const dbindex = new dbconn(config.net == 'mainnet' ? 'dbindex' : 'dbindextestnet');
    //init db.
    Promise.all([
        dbconnection.create(),
        dbconnection_blockchain.create(),
        dbmemory.create(true),
        dbindex.create(false, true)
    ])
        .then(function () {

            try {
                const wallet = require('../db/wallet')
                const blockchain = require('../db/blockchain').chain
                const list = wallet.find({});
                if (!list.length) {
                    //create new address
                    var obj = wallet.createNewAddress();
                    list.push(obj)
                }

                var nodeName = list[0];
                global.config['publicKey'] = nodeName.publicKey;

                global.preloader = 1;
                events.emit("app.preloader", 'localsync', 0)

                setTimeout(function () {
                    blockchain.sync();
                    debug("data path: ", app.getPath('userData'))
                }, 5000);
            } catch (e) {
                console.log(e);
                throw e;
            }

        })
        .catch(function (e) {
            throw e;
        })

})

events.on("app.tray.inited", function (tray) {
    windowManager.appendWindow(-2, tray)
})


events.on("app.destroy", function () {
    events.emit("app.before.exit");
    windowManager.destroyWindows();
    window = null
})

events.on("app.render", function (file, data, windowName) {

    let w;
    if (!windowName)
        w = window;
    else
        w = windowManager.findWindow(windowName)


    if (w) {

        var onloaded = (event, url) => {
            if (event)
                event.preventDefault()
            data.html = ejs.render(fs.readFileSync(path.join(__dirname, "../..", "templates", file + '.ejs'), 'utf8'), data)
            data.id = windowName;
            events.emit("app.window.send", w, file + '/render', data)
            if (data.title)
                w.setTitle(config.title.replace("%build%", config.agent_version).replace("%action%", " - " + data.title))
        };

        w.webContents.on('dom-ready', onloaded)
        const pageurl = url.format({
            pathname: path.join(__dirname, "../..", "views", 'layout.html'),
            protocol: 'file:',
            slashes: true
        })

        if (!w.webContents.layoutCompleted) {
            w.webContents.layoutCompleted = 1;
            w.loadURL(pageurl);
        } else
            onloaded();
    } else {
        debug('error', 'can not find window', windowName)
    }

})

events.on("app.window.send", function (windowName, evName, data) {
    let win = windowName ? windowName : 'main';
    if (typeof windowName == 'string') {
        win = windowName == 'main' ? window : windowManager.findWindow(windowName)
        if (win instanceof windowManager)
            win = win.getWindow();
    } else
        win = windowName;

    if (win)
        win.webContents.send("app.ipc.event", {
            event: evName,
            isFunction: evName instanceof Function,
            data: data
        });
})

events.on("app.debug", function (args) {
    events.emit("app.window.send", window, 'debug', args);
})

events.on("app.navigate", function (link) {
    if (link) {
        var shell = require('electron').shell;
        shell.openExternal(link);
    }
})

ipcMain.on('app.ipc.event', (event, data) => {
    new dispatch(event.sender, data);
})

events.on("app.preloader", function (stage, persent) {
    if (global.preloader)
        events.emit("app.render", 'preloader', {
            stage: stage,
            process: persent
        });
})

events.on("chain.localsync.process", function (process) {
    events.emit("app.preloader", 'localsync', parseInt(process * 100))
})

events.on("chain.blockheaders.process", function (need_update, updated_count) {
    events.emit("app.preloader", 'headers', parseInt((updated_count / need_update) * 100))
})

events.on("chain.merkleblocks.process", function (all_headers, updated_count) {
    events.emit("app.preloader", 'blocks', parseInt((updated_count / all_headers) * 100))
})

events.on("chain.txbody.process", function (all_headers, updated_count) {
    events.emit("app.preloader", 'txbody', parseInt((updated_count / all_headers) * 100))
})

events.on("chain.utxo.process", function (all_headers, updated_count) {
    events.emit("app.preloader", 'utxo', parseInt((updated_count / all_headers) * 100))
})

events.on("chain.sync.complete", function () {

    if (global.new_top) {

        global.new_top = null;

        debug('info', 'sync to new blockchain top')
        events.emit("app.page.addressess");
        var notify = require("../notify");
        notify.info('New confirmation recived', 'Your wallet have actual network info!', function (event) {
            events.emit("app.page.history")
            this.defaultClickHandler(event);
        }, 6000);

    } else {

        debug('info', 'spv node was synced successfully')
        events.emit("app.page.addressess");
        var notify = require("../notify");
        notify.info('Syncronization complete', 'Your wallet have actual network info!', function (event) {
            events.emit("app.page.history")
            this.defaultClickHandler(event);
        }, 6000);

    }

    const wallet = require('../db/wallet')
    const { indexes } = require('../db/blockchain')
    let balance = wallet.getBalance({});
    require('../menu')({
        balance: parseFloat(balance).toLocaleString(),
        height: parseInt(indexes.get("top").height).toLocaleString(),
    })
    events.emit("wallet.balance.changed", parseFloat(balance).toLocaleString());

})

events.on("app.page.addressess", function (params) {

    const wallet = require('../db/wallet')
    const blockchain = require('../db/blockchain').chain
    const list = wallet.find({});
    global.preloader = 0;
    const utxo = wallet.getUTXO(list);

    events.emit("app.render", 'addresses', {
        title: 'Wallet addresses list',
        list: list,
        utxoIndex: utxo
    })

})

events.on("app.page.history", function (params) {
    if (!params)
        params = {}

    const wallet = require('../db/wallet')
    const { txlist, indexes } = require('../db/blockchain')
    var obj = {};
    if (params.address)
        obj['address'] = params.address;
    const list = wallet.find(obj);
    var h = wallet.getUTXOHistory(list);
    h = txlist.UTXOupdgrateList(h);
    debug('debug', 'history', h);
    events.emit("app.render", 'history', {
        title: 'Transaction history',
        history: h,
        filter: obj,
        top: indexes.get('top')
    })
})

events.on("app.page.send", function (params) {
    if (!params)
        params = {}

    const wallet = require('../db/wallet')
    const blockchain = require('../db/blockchain').chain
    const list = wallet.find({});
    const utxo = wallet.getUTXO(list);
    const sorted = Object.keys(utxo).sort(function (ai, bi) {
        let a = utxo[ai], b = utxo[bi];
        let suma = 0, sumb = 0;
        suma += a.stats.unspent_amount - a.stats.spent_amount
        sumb += b.stats.unspent_amount - b.stats.spent_amount

        return suma <= sumb;
    })

    debug('debug', 'send utxo', utxo);
    events.emit("app.render", 'send', {
        title: 'Create transaction and send coins',
        utxo: utxo,
        sorted: sorted,
    })
})


events.on("app.popup.create.addresscreatepopup", function (params) {
    windowManager.createModal(params.name || 'popup', 'address/create', {
        parent: windowManager.findWindow(-1),
        title: 'Append address',
        width: 400,
        height: 200
    });
})

events.on("app.popup.create.addressimportpopup", function (data) {

    windowManager.createModal(data.name || 'popup', 'address/import', {
        parent: windowManager.findWindow(-1),
        title: 'Import address',
        width: 400,
        height: 400
    }, { errors: [] });

})

events.on("app.popup.create.txbody", function (data) {
    let txbody;
    const { txlist, unconfirmed } = require('../db/blockchain');
    if (data.hash) {
        try {
            txbody = txlist.getTx(data.hash);
            if (!txbody)
                throw new Error('where is my body?')
        } catch (e) {
            debug(e);
            txbody = unconfirmed.getTx(data.hash);
        }
    } else if (data.txbody)
        txbody = data.txbody;
    else return false;

    var inputs = {};

    for (var i in txbody.in) {
        try {
            inputs[txbody.in[i].hash + ":" + txbody.in[i].index] = txlist.getOut(txbody.in[i].hash, txbody.in[i].index)
        } catch (e) {
            debug('warn', 'can not find input', txbody.in[i].hash + ":" + txbody.in[i].index)
            inputs[txbody.in[i].hash + ":" + txbody.in[i].index] = -1;
        }
    }


    data.txbody = txbody;
    data.inputs = inputs;

    windowManager.createNoModal('tx/' + txbody.hash, 'txbody', {
        //parent: windowManager.findWindow(-1),
        title: 'Info about transaction ' + txbody.hash,
        width: 360,
        height: 600
    }, data);
})

events.on("app.popup.create.about", function () {
    windowManager.createModal('about', 'about', {
        parent: windowManager.findWindow(-1),
        title: 'About orwell spv',
        width: 400,
        height: 400
    }, { errors: [] });
})



events.on("app.popup.create.nodes", function (params) {
    const nodes = require('../db/nodes')

    let node_list = [];
    let list = nodes.get("connections");
    for (let i in list) {

        node_list.push(nodes.get('data/' + list[i]));

    }

    debug(node_list);

    windowManager.createModal('nodes', 'nodes', {
        parent: windowManager.findWindow(-1),
        title: 'Connection list',
        width: 900,
        height: 400
    }, {
            nodes: node_list
        });

    let win = windowManager.findWindow('nodes');
    win.setResizable(true);
    win.setMovable(true);
})

events.on("app.dialog.create.exportkeys", function (params) {

    const { app, dialog } = require('electron')
    let paths = dialog.showOpenDialog(windowManager.findWindow(-1), {
        title: 'Select place to save private keys',
        defaultPath: app.getPath('desktop'),
        properties: ['openDirectory', 'createDirectory']
    });

    if (!paths || !paths.length)
        return;

    let path = paths[0];
    let file = path + "/orwell.bak";
    const wallet = require('../db/wallet')
    const list = wallet.export();
    const fs = require('fs')
    fs.writeFileSync(file, JSON.stringify(list));

    let notify = require("../notify");
    notify.success('Wallet backup', 'Your wallet was successfully exported to ' + file, function (event) {
        const shell = require('electron').shell;
        shell.openItem(file);
        this.defaultClickHandler(event);
    }, 6000);

})

events.on("app.dialog.create.exportkey", function (params) {

    let address = params.address;

    if (!address)
        return;

    const { app, dialog } = require('electron')
    let paths = dialog.showOpenDialog(windowManager.findWindow(-1), {
        title: 'Select place to save private key',
        defaultPath: app.getPath('desktop'),
        properties: ['openDirectory', 'createDirectory']
    });

    if (!paths || !paths.length)
        return;

    let path = paths[0];
    let file = path + "/orwell-" + address + ".bak";
    const wallet = require('../db/wallet')
    const list = wallet.export({ address: address });
    const fs = require('fs')
    fs.writeFileSync(file, JSON.stringify(list));

    let notify = require("../notify");
    notify.success('Address backup', 'Your address was successfully exported to ' + file, function (event) {
        const shell = require('electron').shell;
        shell.openItem(file);
        this.defaultClickHandler(event);
    }, 6000);

})

events.on("app.dialog.create.importkeys", function (params) {

    const { app, dialog } = require('electron')
    let paths = dialog.showOpenDialog(windowManager.findWindow(-1), {
        title: 'Select private key backup',
        defaultPath: app.getPath('desktop'),
        properties: ['openFile', 'multiSelections'],
        filters: [
            { name: 'Backup files', extensions: ['bak', 'orwell'] },
            { name: 'Text files', extensions: ['txt', 'dat'] },
            { name: 'Json', extensions: ['json'] }
        ]
    });

    //for each path:
    //read file
    //parse JSON
    //if ok and have privateKey
    //if not have this privateKey in wallet 
    //import.
    //show notify
    debug(paths)

    let count = 0;
    const notify = require("../notify");
    const fs = require('fs');
    const wallet = require("../db/wallet")


    const { bloom } = require('../db/blockchain')
    let filter = new bloom();
    let added = [];

    for (let i in paths) {
        let path = paths[i];

        try {
            let content = fs.readFileSync(path);
            let json = JSON.parse(content);
            for (let k in json) {
                if (json[k].privateKey) {
                    let obj = wallet.importPrivateKey(json[k].privateKey, json[k].label || "");
                    if (obj instanceof Object) {
                        added.push(obj);
                        filter.add(obj.hash160)
                        count++;
                    }
                }
            }

        } catch (e) {
            debug(e);
        }

        notify.success('Import', 'Import successfully complete from file ' + path, function (event) {
            this.defaultClickHandler(event);
        }, 6000);

    }

    if (count > 0) {
        debug("info", 'added ' + count + ' keys', added)
        filter.send();
    }

    events.emit("app.page.addressess");
})

events.on("wallet.balance.changed", function (balance) {

    let tray = windowManager.findWindow(-2)
    tray.setToolTip('Orwell spv wallet, balance: ' + balance + " orwl");
})

events.on("net.connection.add", function () {

    setTimeout(() => {
        const protocol = require('../network/protocol')
        require('../menu')({
            nodes: protocol.exceptNode("").length
        })
    }, 1e4);

})

events.on("net.connection.remove", function () {
    const protocol = require('../network/protocol')
    require('../menu')({
        nodes: protocol.exceptNode("").length
    })
})