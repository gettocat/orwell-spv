module.exports = {

    addresses: function (sender, cmd, data) {
        //default handler
    },
    send: function (sender, cmd, data) {
        if (cmd == 'data') {
            console.log("debug", "recv data", cmd, data)

            if (data.operator == 'validate') {
                var event = new CustomEvent('response.' + data.command, { detail: data });
                window.dispatchEvent(event);
                return;
            }

        }
    },
    _render: function (data) {
        window.pageId = data.id;
        $("#content").html(data.html);
    }
}