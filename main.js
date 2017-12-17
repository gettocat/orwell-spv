const { app, Tray, Menu, BrowserWindow } = require('electron')
const events = require('./app/events')
const listener = require('./app/listener');
const config = require('./config')

global.debug = function () {
  var arr = [
    new Date().getHours() + ":" + new Date().getMinutes() + ":" + new Date().getSeconds() + ":" + new Date().getMilliseconds(),
  ];
  for (var i in arguments) {
    arr.push(arguments[i]);
  }
  events.emit("app.debug", arr);
}

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow, willQuitApp = false, tray = null;

const isSecondInstance = app.makeSingleInstance((commandLine, workingDirectory) => {
  // Someone tried to run a second instance, we should focus our window.
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

if (isSecondInstance) {
  app.quit()
}

function createWindow() {
  debug('window created')
  var name = 'orwell-spv-wallet';
  app.setName(name);
  app.setAppUserModelId("orwell.orwellcoin." + name + "." + config.agent_version);
  app.setPath('userData', app.getPath('userData').replace(/Electron/i, name));
  
  // Create the browser window.
  mainWindow = new BrowserWindow({ width: 980, height: 400 })
  mainWindow.setMenu(null);
  require("./app/menu")();

  tray = new Tray(__dirname+'/views/assets/img/icon.png')//'/path/to/my/icon'
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show', click() { mainWindow.show(), mainWindow.focus() } },
    { label: 'Exit', click() { willQuitApp = true, app.quit() } },
  ])
  tray.setToolTip('Orwell spv wallet')
  tray.setContextMenu(contextMenu)
  tray.on('click', () => {
    if (!mainWindow) {
      events.emit("app.destroy");
      return;
    }
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()
  })

  events.emit("app.tray.inited", tray);

  setTimeout(function () {
    events.emit("app.init", mainWindow);
  }, 5000);
  // and load the index.html of the app.
  // Open the DevTools.
  //mainWindow.webContents.openDevTools()
  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    events.emit("app.destroy");
    mainWindow = null
  })

  mainWindow.on('minimize', (e) => {
    mainWindow.hide();
  });

  mainWindow.on('close', (e) => {
    if (willQuitApp) {
      /* the user tried to quit the app */
      mainWindow.destroy();
      mainWindow = null;
    } else {
      /* the user only tried to close the window */
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    events.emit("app.destroy");
    app.quit()
  }
})

app.on('before-quit', () => {
  mainWindow.removeAllListeners('close');
  mainWindow.close();
});

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
