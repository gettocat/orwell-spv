const windowManager = require('./window')
const events = require('./events');

module.exports = function (info) {
    if (!info)
        info = {};

    let labels = [], oldBalance = 0, oldHeight = 0, oldNode = 0;
    const { app, Menu } = require('electron')
    let menu = Menu.getApplicationMenu();
    if (menu && menu.items[0].label == "Orwell") {
        oldBalance = menu.items[4].label.split("Balance: ").join(""),
            oldHeight = menu.items[5].label.split("Height: ").join(""),
            oldNode = menu.items[6].label.split("Nodes: ").join("")

        debug('info', 'menu, old: ', {
            balance: oldBalance,
            height: oldHeight,
            node: oldNode
        }, 'new: ', info)

    }

    labels['balance'] = "Balance: " + (info.balance ? (info.balance) : oldBalance)
    labels['height'] = "Height: " + (info.height || oldHeight)
    labels['nodes'] = "Nodes: " + (info.nodes || oldNode)

    const template = [
        {
            label: "Orwell",
            submenu: [
                { role: 'about', click: () => { events.emit("app.popup.create.about", {}) } },
                { type: 'separator' },
                {
                    role: 'services', submenu: [
                        { label: 'Orwell website', click: () => { events.emit("app.navigate", "https://orwellcoin.org"); } },
                        { label: 'Block explorer', click: () => { events.emit("app.navigate", "https://orwellscan.org"); } },
                        { label: 'Mining pool', click: () => { events.emit("app.navigate", "http://pool.orwellscan.org"); } },
                        { label: 'Github', click: () => { events.emit("app.navigate", "http://github.com/gettocat"); } },
                        { label: 'Telegram chat', click: () => { events.emit("app.navigate", "https://t.me/orwellchat"); } },
                    ]
                },
                { type: 'separator' },
                {
                    label: 'Debug',
                    accelerator: 'CmdOrCtrl+D',
                    click: () => { windowManager.findWindow(-1).webContents.openDevTools() }
                },
                { role: 'quit' }
            ]
        },
        {
            label: 'Addresses',
            submenu: [
                { label: 'List', click: () => { events.emit("app.page.addressess") } },
                { type: 'separator' },
                { label: 'Create new address', click: () => { events.emit("app.popup.create.addresscreatepopup", { name: addresscreatepopup }) } },
                { label: 'Import privateKey / WIF', click: () => { events.emit("app.popup.create.addressimportpopup", { name: addressimportpopup }) } },
                { label: 'Import keys', click: () => { events.emit("app.dialog.create.importkeys", {}) } },
                { label: 'Export keys', click: () => { events.emit("app.dialog.create.exportkeys", {}) } }
            ]
        },
        {
            label: 'History',
            submenu: [
                { label: 'List', click: () => { debug(Menu.getApplicationMenu()); events.emit("app.page.history") } },
                { type: 'separator' },
            ]
        },
        {
            label: 'Send',
            submenu: [
                { label: 'Send standart transaction', click: () => { events.emit("app.page.send") } },
                { label: 'Send multisig transaction', enabled: !true },
                { label: 'Send data transaction', enabled: !true }
            ]
        },
        //info menu
        {
            label: labels['balance']
        },
        {
            label: labels['height']
        },
        {
            label: labels['nodes'], click: () => { events.emit("app.popup.create.nodes", {}) }
        },
    ]

    menu = Menu.buildFromTemplate(template)

    Menu.setApplicationMenu(menu)
}