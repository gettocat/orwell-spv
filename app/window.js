const { BrowserWindow } = require('electron')
const path = require('path')
const url = require('url')
const events = require('./events')

var windows = {};
var window = function (name, title, initView, initViewData) {

    this.name = name;
    this.initView = initView;
    this.viewData = initViewData;
    this.params = {};
    this.params['title'] = title;
    this.params['show'] = false;
    if (windows[this.name])
        windows[this.name].focus();
    //throw new Error('Window with name ' + this.name + " already exist!");
}

window.prototype.setModal = function (val) {
    this.params['modal'] = val;
    return this;
}

window.prototype.setResizable = function (val) {
    this.params['resizable'] = val;
    return this;
}

window.prototype.setMovable = function (val) {
    this.params['movable'] = val;
    return this;
}

window.prototype.setMinimizable = function (val) {
    this.params['minimizable'] = val;
    return this;
}

window.prototype.setMaximizable = function (val) {
    this.params['maximizable'] = val;
    return this;
}

window.prototype.setClosable = function (val) {
    this.params['closable'] = val;
    return this;
}

window.prototype.setFocusable = function (val) {
    this.params['focusable'] = val;
    return this;
}


window.prototype.setFullscreenable = function (val) {
    this.params['fullscreenable'] = val;
    return this;
}

window.prototype.setFullscreen = function (val) {
    this.params['fullscreen'] = val;
    return this;
}

window.prototype.setTitle = function (val) {
    this.params['title'] = val;
    return this;
}

window.prototype.setParent = function (val) {
    this.params['parent'] = val;
    return this;
}

window.prototype.setShowInTaskBar = function (val) {
    this.params['skipTaskbar'] = !val;
    return this;
}

window.prototype.setMinBounds = function (w, h) {
    this.params['minWidth'] = w;
    this.params['minHeight'] = h;
    return this;
}

window.prototype.setMaxBounds = function (w, h) {
    this.params['maxWidth'] = w;
    this.params['maxHeight'] = h;
    return this;
}

window.prototype.setBounds = function (w, h) {
    this.params['width'] = w;
    this.params['height'] = h;
    return this;
}

window.prototype.setAlwaysOnTop = function (val) {
    this.params['setAlwaysOnTop'] = val;
    return this;
}

window.prototype.setView = function (viewname) {
    if (!viewname)
        viewname = this.initView;
    debug('info', 'view: ' + viewname, 'send render')
    events.emit("app.render", viewname, this.viewData || {}, this.name);
    /*this.getWindow().loadURL(url.format({
        pathname: path.join(__dirname, "..", "views", name + '.html'),
        protocol: 'file:',
        slashes: true
    }));
    console.log(url.format({
        pathname: path.join(__dirname, "..", "views", name + '.html'),
        protocol: 'file:',
        slashes: true
    }))*/
}

window.prototype.build = function () {

    if (windows[this.name])
        return false;

    debug('info', 'build window', this)

    const f = this;
    let win = new BrowserWindow(this.params)
    win.name = this.name;
    win.once('ready-to-show', () => {
        debug('info', 'window ' + f.name + ' ready to show')
        win.show();
        win.setTitle(f.params['title'])
    });
    win.setMenu(null);
    win.on("closed", function () {
        debug('info', 'window ' + f.name + ' closed')
        windows[f.name] = null;
        if (windows[-1])
            windows[-1].focus();
    })

    this.window = win;
    windows[this.name] = win;
    this.setView();

    return this;
}

window.prototype.getWindow = function () {
    return this.window;
}

window.findWindow = function (name) {
    return windows[name];
}

window.appendWindow = function (name, window) {
    if (window && name)
        windows[name] = window;
}

window.destroyWindow = function (name) {
    if (windows[name] instanceof window)
        windows[name].destroy();
    windows[name] = null;
    return true;
}

window.destroyWindows = function () {
    for (var i in windows) {
        if (i == -1 || i == -2)
            continue;
        if (windows[i])
            windows[i].destroy();
        windows[i] = null;
    }

    return true;
}

window.createModal = function (name, view, options, viewdata) {

    var w = new window(name, options.title || 'Orwell', view, viewdata || {});
    w.setBounds(options.width || 800, options.height || 600);
    w.setModal(true);
    //w.setAlwaysOnTop(true);
    w.setResizable(false);
    w.setMovable(false);
    w.setMinimizable(false);
    w.setMaximizable(false);
    w.setFullscreenable(false);
    w.setShowInTaskBar(false);
    w.setMinBounds(100, 100);

    if (options.parent)
        w.setParent(options.parent);

    w.build();

    return w;

}

window.createNoModal = function (name, view, options, viewdata) {

    var w = new window(name, options.title || 'Orwell', view, viewdata || {});
    w.setBounds(options.width || 800, options.height || 600);
    w.setModal(false);
    w.setResizable(true);
    w.setMovable(true);
    w.setMinimizable(true);
    w.setMaximizable(false);
    w.setFullscreenable(false);
    //w.setShowInTaskBar(true);
    w.setMinBounds(200, 120);

    if (options.parent)
        w.setParent(options.parent);

    w.build();

    return w;

}

module.exports = window