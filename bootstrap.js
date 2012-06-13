var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");

let gWin;
let gMenuSaveId = null;
let gMenuRestId = null;
let gMenuDestroyId = null;


var SessionManager = {

  autosaving:true,
  sessionFilename:"session.zip",
  htmlSaved : "session.html",
  cookieSaved : "cookies.json",
  savingTimer:5,
  timerID:null,
  timer_debug:null,
  savingPath:null,
  init : function(aEvent) {
    SessionManager.savingPath = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
     
    logconsole("Initialized");
  },

  getCurrentURI:function(){

    var currBrowser = gWin.BrowserApp.selectedBrowser;
    var currURL = currBrowser.currentURI.spec;
    var ios = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
    return ios.newURI(currURL, null, null);
  },

  getCookies:function(){
  
  var cookies = [];
  uri = SessionManager.getCurrentURI();

  var cookieMgr = Components.classes["@mozilla.org/cookiemanager;1"]  
                  .getService(Components.interfaces.nsICookieManager2);
  iterator = cookieMgr.getCookiesFromHost(uri.host);
  while (iterator.hasMoreElements()) {
    var c = iterator.getNext().QueryInterface(Components.interfaces.nsICookie2);
    cookies.push(c);
  }
  return JSON.stringify(cookies);

  },

  saveSession: function(){

    SessionManager.timer_debug=(new Date).getTime();

    logconsole("saving session");
    //listen for msg from child
    
    gWin.messageManager.addMessageListener("SessMan:ReceiveHTMLFromChild", SessionManager.receiveMessage );
    
    //script executed by child process
    
    gWin.messageManager.loadFrameScript("chrome://SessionManager/content/content.js", true);

    SessionManager.sendMessageToGetHTML();
  },
  restorePage:function(){
    var path = this.unzipHTML();
    localUrl="file://localhost/"+path.replace("\\","/") ;
    gWin.BrowserApp.loadURI( localUrl);
    //gWin.BrowserApp.addTab(localUrl,true); #to add a new tab
    logconsole("Page restored");
    
  },
  removeCookies : function(){
    
    var cookieManager = Components.classes["@mozilla.org/cookiemanager;1"]
                    .getService(Components.interfaces.nsICookieManager);
    cookieManager.removeAll();
    
    logconsole("Cookies removed/Session destroyed");

  },
  restoreCookies : function(){
    cookies = SessionManager.unzipCookies();

    var cookieManager = Components.classes["@mozilla.org/cookiemanager;1"]
                    .getService(Components.interfaces.nsICookieManager2);

    for(var i in cookies){
      c = cookies[i];
      cookieManager.add(c.host,c.path,c.name,c.value,c.isSecure,c.isHttpOnly,c.isSession,c.expiry);
    }

    logconsole("Cookies restored");
  },

  restoreSession: function(){
    var t = (new Date).getTime();
    var outFile = SessionManager.savingPath.clone();
    outFile.append(SessionManager.sessionFilename);

    if( ! outFile.exists() ){
      logconsole("No saved session!");
      return;
    }
    SessionManager.restoreCookies();
    SessionManager.restorePage();
    logconsole("Executed in :"+((new Date).getTime()-t) +" ms");
    
  },

  sendMessageToGetHTML: function() {
    gWin.BrowserApp.selectedBrowser.messageManager.sendAsyncMessage("SessMan:AskChildForHTML",{});
    
  },
  
  receiveMessage: function(aMessage) {
    /*Receive HTML source -> zip it*/
    SessionManager.zipToFile( aMessage.json.html, SessionManager.getCookies());
    logconsole( "Session Saved" );
    gWin.messageManager.removeMessageListener("SessMan:ReceiveHTMLFromChild", SessionManager.receiveMessage );
    delta = ((new Date).getTime())-SessionManager.timer_debug;
    logconsole("Saving Executed in: "+delta+" ms.");
    
  },
  
  zipToFile : function ( html, cookies ) {

    var outFile = SessionManager.savingPath.clone();
    /* Zip file*/
    
    outFile.append(SessionManager.sessionFilename);

    if( ! outFile.exists() )
      outFile.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0666);
    var zipWriter = Components.Constructor("@mozilla.org/zipwriter;1", "nsIZipWriter");
    var zipW = new zipWriter();
    zipW.open( outFile, 0x04 /*PR_RDWR*/ | 0x08 /*PR_CREATE_FILE*/ | 0x20 /*PR_TRUNCATE*/);
    
    var storage = Components.classes["@mozilla.org/storagestream;1"].createInstance(Components.interfaces.nsIStorageStream);
    storage.init(8192, 4294967295 /*PR_UINT32_MAX*/ , null);
     var out = storage.getOutputStream(0);

     var binout = Components.classes["@mozilla.org/binaryoutputstream;1"].createInstance(Components.interfaces.nsIBinaryOutputStream);
     binout.setOutputStream(out);
     binout.writeUtf8Z(html);
     binout.close();
     out.close();
     var instr = storage.newInputStream(4);
    
    if (zipW.hasEntry(SessionManager.htmlSaved))
        zipW.removeEntry(SessionManager.htmlSaved,false)
    zipW.addEntryStream(SessionManager.htmlSaved,null,Ci.nsIZipWriter.COMPRESSION_DEFAULT,instr,false)
    var istream = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);
    istream.setData(cookies, cookies.length);
    if (zipW.hasEntry(SessionManager.cookieSaved))
        zipW.removeEntry(SessionManager.cookieSaved,false)
    zipW.addEntryStream(SessionManager.cookieSaved,null,Ci.nsIZipWriter.COMPRESSION_DEFAULT,istream,false)
    zipW.close();
    
  },
  
  unzipHTML: function(){
    
    var zipFile = this.savingPath.clone();
    zipFile.append(this.sessionFilename);
       
    var outFile = this.savingPath.clone();
    outFile.append(this.htmlSaved);
    
    if( ! outFile.exists() )
      outFile.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0666);

    var zipReader = Cc["@mozilla.org/libjar/zip-reader;1"]
                .createInstance(Ci.nsIZipReader);
    zipReader.open( zipFile );
    zipReader.extract( this.htmlSaved, outFile );
    return outFile.path;
  },
  unzipCookies: function(){
    var zipFile = this.savingPath.clone();
    var outFile = this.savingPath.clone();
    zipFile.append(this.sessionFilename);
    outFile.append(this.cookieSaved);
    
    if( ! outFile.exists() )
      outFile.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0666);
    var zipReader = Cc["@mozilla.org/libjar/zip-reader;1"]
                .createInstance(Ci.nsIZipReader);
        zipReader.open( zipFile );
    var stream = zipReader.getInputStream(this.cookieSaved);
    
    var data = "";
    var cstream = Components.classes["@mozilla.org/intl/converter-input-stream;1"].  
              createInstance(Components.interfaces.nsIConverterInputStream);  
    cstream.init(stream, "UTF-8", 0, 0); // you can use another encoding here if you wish  
      
    let (str = {}) {  
      let read = 0;  
      do {   
        read = cstream.readString(0xffffffff, str); // read as much as we can and put it in str.value  
        data += str.value;  
      } while (read != 0);  
    }  
    cstream.close();
    cookies = JSON.parse(data);

    return cookies;
  },

   
  unload: function() {
    gWin.clearInterval(SessionManager.savingTimer);

  }
};

function logconsole(msg){
  var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
                                 .getService(Components.interfaces.nsIConsoleService);
  consoleService.logStringMessage("[HPPS] " + msg);
}

function notify(msg){
  let alerts = Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService);
  alerts.showAlertNotification(null, "Log", msg, false, "", null);  
}



function load(win) {
  gWin = win;
  gMenuSaveId = win.NativeWindow.menu.add("Save Session", null, SessionManager.saveSession);
  gMenuRestId = win.NativeWindow.menu.add("Restore Session", null, SessionManager.restoreSession);
  gMenuDestroyId = win.NativeWindow.menu.add("Destroy Session", null, SessionManager.removeCookies);
  if(SessionManager.autosaving){
      SessionManager.timerID = gWin.setInterval(SessionManager.saveSession,SessionManager.savingTimer*1000);
      logconsole("Autosaving timer: "+SessionManager.savingTimer);
  }
  logconsole("Load UI");
  
}

function unload(win) {
  logconsole("Unload UI");
  win.NativeWindow.menu.remove(gMenuSaveId);  
  win.NativeWindow.menu.remove(gMenuRestId);  
  win.NativeWindow.menu.remove(gMenuDestroyId);  
  SessionManager.unload();
}

var listener = {
  onOpenWindow: function(aWindow) {
    // Wait for the window to finish loading
    let win = aWindow.QueryInterface(Ci.nsIInterfaceRequestor)
                     .getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
    win.addEventListener("UIReady", function(aEvent) {
      win.removeEventListener(aEvent.name, arguments.callee, false);
      load(win);
    }, false);
  },

  // Unused:
  onCloseWindow: function(aWindow) {},
  onWindowTitleChange: function(aWindow, aTitle) { }
};

/* Bootstrap Interface */

function startup(aData, aReason) {
  // Load in existing windows.
  logconsole("Loaded Extension");
  SessionManager.init();
  let enumerator = Services.wm.getEnumerator("navigator:browser");
  while(enumerator.hasMoreElements()) {
    let win = enumerator.getNext();
    load(win);
  }

  // Load in future windows.
  Services.wm.addListener(listener);
}

function shutdown(aData, aReason) {
  // When the application is shutting down we normally don't have to clean
  // up any UI changes made
  logconsole("Shuttingdown Extension");
  if (aReason == APP_SHUTDOWN)
    return;
  // Stop listening for new windows
  Services.wm.removeListener(listener);
  // Unload from any existing windows
  let enumerator = Services.wm.getEnumerator("navigator:browser");
  while(enumerator.hasMoreElements()) {
    let win = enumerator.getNext();
    unload(win);
  }
}

function install(aData, aReason) {}
function uninstall(aData, aReason) {shutdown(aData,aReason);}
