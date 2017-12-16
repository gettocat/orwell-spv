const eNotify = require('electron-notify');
const windowManager = require("./window")
// Change config options
eNotify.setConfig({
    //appIcon: path.join(__dirname, 'images/icon.png'),
    displayTime: 6000
});

var notify = function (title, text, options) {

    this.defaultClickHandler = function (event) {
        const mainWindow = windowManager.findWindow(-1)
        mainWindow.show();
        mainWindow.focus();
        if (event)
            event.closeNotification();
    };

    this.title = title;
    this.text = text;
    this.type = options.type || 'info';
    this.timeout = options.timeout || 6000;
    this.funClick = options.onclick || this.defaultClickHandler
    this.show();

};

notify.prototype.show = function () {

    let background = 'rgba(38, 111, 114, .62)';
    if (this.type == 'success') {
        background = 'rgba(15, 161, 74, .62)'
    }

    if (this.type == 'danger') {
        background = 'rgba(185, 33, 57, .62)'
    }

    eNotify.setConfig({
        width: 450,
        height: 100,
        //appIcon: path.join(__dirname, 'images/icon.png'),
        displayTime: this.timeout,
        defaultStyleContainer: {
            backgroundColor: background,
            padding: '20px',
            fontFamily: 'Arial',
            fontSize: 12,
            position: 'relative',
            lineHeight: '15px',
            color: 'white'
        },
        defaultStyleText: {
            margin: 0,
            overflow: 'hidden',
            cursor: 'default',
            color: 'white'
        },
    });

    eNotify.notify({
        title: this.title,
        text: this.text,
        onClickFunc: (e) => {
            return this.funClick.apply(this, [e]);
        },
    });
}

notify.danger = function (title, text, cb, timeout) {
    return new notify(title, text, {
        type: 'danger',
        timeout: timeout || 6000,
        onclick: cb,
    });
}

notify.info = function (title, text, cb, timeout) {
    return new notify(title, text, {
        type: 'info',
        timeout: timeout || 6000,
        onclick: cb,
    });
}

notify.success = function (title, text, cb, timeout) {
    return new notify(title, text, {
        type: 'success',
        timeout: timeout || 6000,
        onclick: cb,
    });
}

module.exports = notify