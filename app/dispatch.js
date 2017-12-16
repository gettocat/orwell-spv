const window = require('./window');
const handler = require('./handler');
const events = require('./events');

var dispatch = function (sender, data) {
    this.sender = sender;
    this.event = data.event;
    this.data = data.data;
    this.run();
}

dispatch.prototype.run = function () {

    switch (this.event) {
        case 'popup.open':

            events.emit("app.popup.create." + this.data.name, this.data);

            break;
        case 'popup.close':
            var win = window.findWindow(this.data.id);
            if (win) {
                win.close();
            } else
                debug('error', 'can not find window ', this.data.id)
            break;
        case 'popup.data':
            new handler(this.data.id, this.data);
            break;
        case 'app.render':
            events.emit("app.page." + this.data.view, this.data);
            break;
        case 'navigate':
            events.emit("app.navigate", this.data.link);
            break;
        case 'dialog.open':
            events.emit("app.dialog.create." + this.data.name, this.data);
            break;
        case 'validate.address': {
            const view = 'send';
            const crypto = require('./crypto');
            let res = false;

            try {
                res = crypto.isValidAddress(this.data.value);
            } catch (e) {

            }

            debug('info', 'is valid address', this.data.value, res)
            let data = {
                operator: 'validate',
                type: 'address',
                command: 'validate.address',
                isValid: res,
                address: this.data.value,
                field: this.data.field,
            };

            win = window.findWindow(-1);
            events.emit("app.window.send", win, view + '/data', data)

            break;
        }
        case 'validate.amount': {

            const view = 'send';
            let win = window.findWindow(-1);
            let a = parseFloat(parseFloat(this.data.value).toFixed(9));
            events.emit("app.window.send", win, view + '/data', {
                operator: 'validate',
                type: 'amount',
                command: 'validate.amount',
                isValid: a >= 1e-8 && !isNaN(a) && a <= 20e6,
                amount: a,
                field: this.data.field
            })

            break;
        }
        case 'validate.utxo': {

            const { value, amount } = this.data;
            const a = parseFloat(parseFloat(this.data.value).toFixed(9));
            const wallet = require('./db/wallet')
            const blockchain = require('./db/blockchain').chain

            let obj = {};
            if (value != '0')
                obj.address = value;

            const list = wallet.find(obj);
            const utxo = wallet.getUTXO(list);
            let avalAmount = 0;
            for (let addr in utxo) {
                avalAmount += utxo[addr].stats.unspent_amount - utxo[addr].stats.spent_amount
            }

            const view = 'send';
            var win = window.findWindow(-1);
            let amou = parseFloat(parseFloat(amount).toFixed(9));
            events.emit("app.window.send", win, view + '/data', {
                operator: 'validate',
                type: 'utxo',
                command: 'validate.utxo',
                isValidAmount: avalAmount / 1e8 >= amou && amou >= 1e-8 && !isNaN(amou) && amou <= 20e6,
                isValid: value && utxo[value] ? utxo[value].stats.unspent_amount > 0 : avalAmount > 0,
                amount: amou,
                aval_amount: avalAmount / 1e8,
                field: this.data.field
            })

            break;
        }
        case "txbody": {

            let wallet = require('./db/wallet')
            wallet.setFee(this.data.fee);
            let res = wallet.createTx(this.data.from, this.data.to, parseFloat(this.data.amount * 1e8));
            if (!res.status)
                throw new Error('invalid transaction parameters, error: ' + res.error);

            debug("info", 'new tx', res.tx)
            let txdata = res.tx.toJSON();
            txdata.fee = txdata.length * this.data.fee;
            txdata.time = new Date().getTime() / 1000;
            events.emit("app.popup.create.txbody", { txbody: txdata });

            break;
        }
        case "tx.send": {

            let wallet = require('./db/wallet')
            wallet.setFee(this.data.fee);
            let res = wallet.createTx(this.data.from, this.data.to, parseFloat(this.data.amount * 1e8));
            if (!res.status)
                throw new Error('invalid transaction parameters, error: ' + res.error);

            debug("info", 'new tx', res.tx)
            let txdata = res.tx.toJSON();
            txdata.fee = txdata.length * this.data.fee;
            txdata.time = new Date().getTime() / 1000;
            res.tx.send();

            break;
        }
        default:
            break;
    }

}




module.exports = dispatch;