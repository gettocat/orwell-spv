const windowManager = require('./window')
const events = require('./events')

var handler = function (popupId, data) {
    this.popupId = popupId;
    this.data = data;

    var res = this.makeAction();
    if (res)
        this.closeWindow();
}

handler.prototype.showError = function (errorList) {

}

handler.prototype.makeAction = function () {
    switch (this.popupId) {
        case 'addresscreatepopup': {

            //create new address
            const wallet = require('./db/wallet')
            const obj = wallet.createNewAddress(this.data.label || '');
            debug('info', 'created address', obj.address);
            //send filteradd

            const { bloom } = require('./db/blockchain')
            let filter = new bloom({address: obj.address});
            filter.sendAdd();

            events.emit("app.page.addressess");
            return true;
            break;
        }
        case 'addressimportpopup': {

            var errors = [], obj;
            const wallet = require('./db/wallet')

            if (!this.data.value)
                errors.push({ field: "privateKey", message: "Private Key field must be filled" })

            if (!errors.length) {
                obj = wallet.importPrivateKey(this.data.value, this.data.label || '');

                if (obj instanceof Object) {
                    debug('info', 'import address', obj.address);
                    events.emit("app.page.addressess");
                    
                    const { bloom } = require('./db/blockchain')
                    let filter = new bloom();
                    filter.add(obj.hash160)
                    filter.send();

                    return true;
                }

                if (obj == -1)
                    errors.push({ field: "privateKey", message: "Private key is not hex and is not WIF" })

                if (obj == -2)
                    errors.push({ field: "privateKey", message: "This private key already exist" })

            }

            if (obj)
                debug('error', 'import address', obj);
            events.emit("app.render", 'address/import', {
                errors: errors
            }, this.popupId);

            return false;
        }
            break;

        default:
            break;
    }
}

handler.prototype.closeWindow = function () {
    const win = windowManager.findWindow(this.popupId);
    if (win)
        win.close();
    else
        debug("error", "can not find window ", this.popupId);
}


module.exports = handler;