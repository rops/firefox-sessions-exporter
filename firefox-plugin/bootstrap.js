var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");

let gWin;
let gMenuSaveId = null;
let gMenuRestId = null;
let gMenuDestroyId = null;
let gMenuSwishId = null;

var Base64 = {
 
  // private property
  _keyStr : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
 
  // public method for encoding
  encode : function (input) {
    var output = "";
    var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
    var i = 0;
 
    input = Base64._utf8_encode(input);
 
    while (i < input.length) {
 
      chr1 = input.charCodeAt(i++);
      chr2 = input.charCodeAt(i++);
      chr3 = input.charCodeAt(i++);
 
      enc1 = chr1 >> 2;
      enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
      enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
      enc4 = chr3 & 63;
 
      if (isNaN(chr2)) {
        enc3 = enc4 = 64;
      } else if (isNaN(chr3)) {
        enc4 = 64;
      }
 
      output = output +
      this._keyStr.charAt(enc1) + this._keyStr.charAt(enc2) +
      this._keyStr.charAt(enc3) + this._keyStr.charAt(enc4);
 
    }
 
    return output;
  },
 
  // public method for decoding
  decode : function (input) {
    var output = "";
    var chr1, chr2, chr3;
    var enc1, enc2, enc3, enc4;
    var i = 0;
 
    input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
 
    while (i < input.length) {
 
      enc1 = this._keyStr.indexOf(input.charAt(i++));
      enc2 = this._keyStr.indexOf(input.charAt(i++));
      enc3 = this._keyStr.indexOf(input.charAt(i++));
      enc4 = this._keyStr.indexOf(input.charAt(i++));
 
      chr1 = (enc1 << 2) | (enc2 >> 4);
      chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      chr3 = ((enc3 & 3) << 6) | enc4;
 
      output = output + String.fromCharCode(chr1);
 
      if (enc3 != 64) {
        output = output + String.fromCharCode(chr2);
      }
      if (enc4 != 64) {
        output = output + String.fromCharCode(chr3);
      }
 
    }
 
    output = Base64._utf8_decode(output);
 
    return output;
 
  },
 
  // private method for UTF-8 encoding
  _utf8_encode : function (string) {
    string = string.replace(/\r\n/g,"\n");
    var utftext = "";
 
    for (var n = 0; n < string.length; n++) {
 
      var c = string.charCodeAt(n);
 
      if (c < 128) {
        utftext += String.fromCharCode(c);
      }
      else if((c > 127) && (c < 2048)) {
        utftext += String.fromCharCode((c >> 6) | 192);
        utftext += String.fromCharCode((c & 63) | 128);
      }
      else {
        utftext += String.fromCharCode((c >> 12) | 224);
        utftext += String.fromCharCode(((c >> 6) & 63) | 128);
        utftext += String.fromCharCode((c & 63) | 128);
      }
 
    }
 
    return utftext;
  },
 
  // private method for UTF-8 decoding
  _utf8_decode : function (utftext) {
    var string = "";
    var i = 0;
    var c = c1 = c2 = 0;
 
    while ( i < utftext.length ) {
 
      c = utftext.charCodeAt(i);
 
      if (c < 128) {
        string += String.fromCharCode(c);
        i++;
      }
      else if((c > 191) && (c < 224)) {
        c2 = utftext.charCodeAt(i+1);
        string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
        i += 2;
      }
      else {
        c2 = utftext.charCodeAt(i+1);
        c3 = utftext.charCodeAt(i+2);
        string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
        i += 3;
      }
 
    }
 
    return string;
  }
 
}


var SessionManager = {

  autosaving:false,
  path:"/mnt/sdcard/sessions",
  sessionFilename:"session.session",
  htmlSaved : "session.html",
  cookieSaved : "cookies.json",
  savingTimer:5,
  timerID:null,
  timer_debug:null,
  savingPath:null,
  offline:false,
  init : function(aEvent) {
    /*SessionManager.savingPath = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
    
    var file = Components.classes["@mozilla.org/file/local;1"].  
           createInstance(Components.interfaces.nsILocalFile);  
    file.initWithPath("/mnt/sdcard/");  
    logconsole(SessionManager.savingPath+" "+file);
    logconsole(file.path);*/

    SessionManager.savingPath = Components.classes["@mozilla.org/file/local;1"].  
           createInstance(Components.interfaces.nsILocalFile);

    SessionManager.savingPath.initWithPath(SessionManager.path); 
    if( !SessionManager.savingPath.exists() || !SessionManager.savingPath.isDirectory() ) {   // if it doesn't exist, create  
        SessionManager.savingPath.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0777); 
        logconsole("Dir created"); 
    }

    var observerService = Components.classes["@mozilla.org/observer-service;1"]  
          .getService(Components.interfaces.nsIObserverService);
    
    observerService.addObserver(SessionManager,"network:offline-about-to-go-offline",false);
    logconsole("Initialized");
  },
 observe: function(subject, topic, data) {  
    if (topic == "network:offline-about-to-go-offline"){
      logconsole("Network is going down!");
      SessionManager.saveSession();
     }
              
  },
  
  externalHandler: function(e) {  
    logconsole("External Calling");
    SessionManager.restoreSession();
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

  swish:function(){
    SessionManager.saveSession();
    var zipFile = SessionManager.savingPath.clone();
    zipFile.append(SessionManager.sessionFilename);
    if(zipFile.exists())
    {
        //encodedPath = Base64.encode(zipFile.path);
        localUrl="devswsh://send/file://"+zipFile.path ;
        logconsole(localUrl);
        gWin.BrowserApp.loadURI( localUrl);
    }else{
      logconsole("No session saved");
    }
  },

  saveSession: function(){

    var currBrowser = gWin.BrowserApp.selectedBrowser;
    var currURI = currBrowser.currentURI;
    if ( currURI.scheme == "file" || currURI.scheme == "chrome" ){
        logconsole("Can't save this session");
        return;
    }

    SessionManager.timer_debug=(new Date).getTime();

    logconsole("saving session");
    //listen for msg from child
    
    gWin.messageManager.addMessageListener("SessMan:ReceiveHTMLFromChild", SessionManager.receiveMessage );
    
    //script executed by child process
    
    gWin.messageManager.loadFrameScript("chrome://SessionManager/content/content.js", true);

    SessionManager.sendMessageToGetHTML();
  },
  restorePage:function(){
    var path = SessionManager.unzipHTML();
    localUrl="file://localhost/"+path.replace("\\","/") ;
    gWin.BrowserApp.loadURI( localUrl);
    //gWin.BrowserApp.addTab(localUrl,true); #to add a new tab
    logconsole("Page restored");
    notify("Page restored");
    
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
    //encodedHTML = Base64.encode(aMessage.json.html);
    encodedHTML = aMessage.json.html;
    encodedCookies = Base64.encode(SessionManager.getCookies());
    SessionManager.zipToFile( encodedHTML, encodedCookies);
    //SessionManager.zipToFile( aMessage.json.html, SessionManager.getCookies());
    logconsole( "Session Saved" );
    notify("Session Saved");
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
    
    var zipFile = SessionManager.savingPath.clone();
    zipFile.append(SessionManager.sessionFilename);
       
    var outFile = SessionManager.savingPath.clone();
    outFile.append(SessionManager.htmlSaved);
    
    if( ! outFile.exists() )
      outFile.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0666);

    var zipReader = Cc["@mozilla.org/libjar/zip-reader;1"]
                .createInstance(Ci.nsIZipReader);
    zipReader.open( zipFile );
    zipReader.extract( SessionManager.htmlSaved, outFile );
    return outFile.path;
  },
  unzipCookies: function(){
    var zipFile = SessionManager.savingPath.clone();
    var outFile = SessionManager.savingPath.clone();
    zipFile.append(SessionManager.sessionFilename);
    outFile.append(SessionManager.cookieSaved);
    
    if( ! outFile.exists() )
      outFile.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0666);
    var zipReader = Cc["@mozilla.org/libjar/zip-reader;1"]
                .createInstance(Ci.nsIZipReader);
        zipReader.open( zipFile );
    var stream = zipReader.getInputStream(SessionManager.cookieSaved);
    
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
    cookies = JSON.parse(Base64.decode(data));

    return cookies;
  },

   
  unload: function() {
    gWin.clearInterval(SessionManager.savingTimer);

  }
};

function logconsole(msg){
  var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
                                 .getService(Components.interfaces.nsIConsoleService);
  consoleService.logStringMessage("[SessionManager] " + msg);
}

function notify(msg){
  let alerts = Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService);
  alerts.showAlertNotification(null, "Log", msg, false, "", null);  
}



function load(win) {
  gWin = win;
  gMenuSwishId = win.NativeWindow.menu.add("Swish", null, SessionManager.swish);
  gMenuSaveId = win.NativeWindow.menu.add("Save Session", null, SessionManager.saveSession);
  gMenuRestId = win.NativeWindow.menu.add("Restore Session", null, SessionManager.restoreSession);
  gMenuDestroyId = win.NativeWindow.menu.add("Destroy Session[DEMO]", null, SessionManager.removeCookies);
  if(SessionManager.autosaving){
      SessionManager.timerID = gWin.setInterval(SessionManager.saveSession,SessionManager.savingTimer*1000);
      logconsole("Autosaving timer: "+SessionManager.savingTimer);
  }
  logconsole("Load UI");
  gWin.document.addEventListener("RestorePageEvent", function(e){SessionManager.externalHandler()} , false, true); 
  logconsole("Registred for external calling");
  
}

function unload(win) {
  logconsole("Unload UI");
  win.NativeWindow.menu.remove(gMenuSaveId);  
  win.NativeWindow.menu.remove(gMenuRestId);  
  win.NativeWindow.menu.remove(gMenuDestroyId);  
  win.NativeWindow.menu.remove(gMenuSwishId);  
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
  SessionManager.init();
  let enumerator = Services.wm.getEnumerator("navigator:browser");
  while(enumerator.hasMoreElements()) {
    let win = enumerator.getNext();
    load(win);
  }
  
  // Load in future windows.
  Services.wm.addListener(listener);
  logconsole("Extension Loaded");

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


