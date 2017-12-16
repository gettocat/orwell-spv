const { ipcRenderer } = require('electron')
const dispatch = require('./dispatch');

ipcRenderer.on('app.ipc.event', (event, arg) => {

    if (arg.event == 'debug') {
        console.log.apply(null, arg.data);
        return;
    }

    var a = arg.event.split("/"), view = a[0], cmd = a[1];

    if (dispatch[view] && cmd != 'render')
        dispatch[view](event.sender, cmd, arg.data);
    else
        dispatch._render(arg.data);
})

module.exports = function (act) {

    this.date2s = function (timestamp) {
        var date = new Date(timestamp * 1000);
        return ('0' + date.getDate()).slice(-2) + '-' + ('0' + (date.getMonth() + 1)).slice(-2) + '-' + date.getFullYear() + ' ' + ('0' + date.getHours()).slice(-2) + ':' + ('0' + date.getMinutes()).slice(-2);
    }

    this.alertField = function (id) {
        $("#" + id).addClass('redborder');
    }

    this.send = function (cmd, data) {
        $(".redborder").removeClass("redborder");
        ipcRenderer.send('app.ipc.event', {
            event: cmd,
            data: data
        })

        return false;
    }

}