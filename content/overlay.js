function log(msg){
	let alerts = Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService);
  alerts.showAlertNotification(null, "Log", msg, false, "", null);	
}
function logconsole(msg){

  var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
                                 .getService(Components.interfaces.nsIConsoleService);
  consoleService.logStringMessage("HPPS: " + msg);

}
function getCurrentURI(){

    var currentWindow = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator).getMostRecentWindow("navigator:browser");
    var currBrowser = currentWindow.getBrowser();
    var currURL = currBrowser.currentURI.spec;
    var ios = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
    return ios.newURI(currURL, null, null);
}

function getCookies() {
  
  var cookies = [];
  uri = getCurrentURI();
  
  var cookieMgr = Components.classes["@mozilla.org/cookiemanager;1"]  
                  .getService(Components.interfaces.nsICookieManager2);
  iterator = cookieMgr.getCookiesFromHost(uri.host);
  while (iterator.hasMoreElements()) {
    var c = iterator.getNext().QueryInterface(Components.interfaces.nsICookie2);
    cookies.push(c);
  }
  return JSON.stringify(cookies);

};

var SessionManager = {

  savingPath:"",
  autosaving:false,
  sessionFilename:"session.zip",
  htmlSaved : "page.html",
  cookieSaved : "cookies.json",
  savingTimer:0,
  current_html:"",
  timerID:null,
  pref:null,
  current_cookie:new Array(),
  onLoad : function(aEvent) {
    this.initPref();

    var observerService = Components.classes["@mozilla.org/observer-service;1"]  
          .getService(Components.interfaces.nsIObserverService);
    
    observerService.addObserver(this,"http-on-examine-response",false);
    observerService.addObserver(this,"http-on-examine-cached-response",false);
    observerService.addObserver(this,"http-on-examine-merged-response",false);

    if(this.autosaving){
      this.timerID = window.setInterval(this.saveSession,this.savingTimer*1000);
      log("timer: "+this.savingTimer);
    }
    log("loaded");
  },

  saveSession: function(){

    log("saving session");
    //listen for msg from child
    window.messageManager.addMessageListener("SessMan:ReceiveHTMLFromChild", SessionManager.receiveMessage );
    //script executed by child process
    window.messageManager.loadFrameScript("chrome://SessionManager/content/content.js", true);

    SessionManager.sendMessageToGetHTML();
  },
  restorePage:function(){
    var path = this.unzipHTML();
    localUrl="file://localhost/"+path.replace("\\","/") ;
    Browser.loadURI( localUrl);
    //Browser.addTab(localUrl,true); #to add a new tab
    log("Page restored");
    
  },
  removeCookies : function(){
    var cookieSvc = Components.classes["@mozilla.org/cookieService;1"]  
                  .getService(Components.interfaces.nsICookieService);  
    var cookieStr = cookieSvc.getCookieString(getCurrentURI(), null);
    var cookieManager = Components.classes["@mozilla.org/cookiemanager;1"]
                    .getService(Components.interfaces.nsICookieManager);
    cookieManager.removeAll();
    var cookieStr = cookieSvc.getCookieString(getCurrentURI(), null);
    log("Cookies removed/Session destroyed");

  },
  restoreCookies : function(){
    cookies = this.unzipCookies();

    var cookieManager = Components.classes["@mozilla.org/cookiemanager;1"]
                    .getService(Components.interfaces.nsICookieManager2);

    for(var i in cookies){
      c = cookies[i];
      cookieManager.add(c.host,c.path,c.name,c.value,c.isSecure,c.isHttpOnly,c.isSession,c.expiry);
    }

    log("Cookies restored");
  },

  restoreSession: function(){
    outFile = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
    outFile.append(this.sessionFilename);
    if( ! outFile.exists() ){
      log("No saved session!");
      return;
    }
    this.restoreCookies();
    this.restorePage();
    
  },

  sendMessageToGetHTML: function() {
    Browser.selectedBrowser.messageManager.sendAsyncMessage("SessMan:AskChildForHTML",{});
    //log("sent from parent to child");
  },
  
  receiveMessage: function(aMessage) {
    SessionManager.zipToFile( aMessage.json.html, getCookies(), aMessage.json.info );
    window.messageManager.removeMessageListener("SessMan:ReceiveHTMLFromChild", SessionManager.receiveMessage );
  },
  
	zipToFile : function ( html, cookies, info ) {

    outFile = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
		outFile.append(this.sessionFilename);

		if( ! outFile.exists() )
			outFile.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0666);
		var zipWriter = Components.Constructor("@mozilla.org/zipwriter;1", "nsIZipWriter");
		var zipW = new zipWriter();
		zipW.open( outFile, 0x04 /*PR_RDWR*/ | 0x08 /*PR_CREATE_FILE*/ | 0x20 /*PR_TRUNCATE*/);
		
		var storage = Components.classes["@mozilla.org/storagestream;1"].createInstance(Components.interfaces.nsIStorageStream);
		storage.init(8192, Math.ceil( html.length * 1.1) , null);
		 var out = storage.getOutputStream(0);

		 var binout = Components.classes["@mozilla.org/binaryoutputstream;1"].createInstance(Components.interfaces.nsIBinaryOutputStream);
		 binout.setOutputStream(out);
		 binout.writeUtf8Z(html);
		 binout.close();
		 out.close();
		
		if (zipW.hasEntry(this.htmlSaved))
		    zipW.removeEntry(this.htmlSaved,false)
		zipW.addEntryStream(this.htmlSaved,null,Ci.nsIZipWriter.COMPRESSION_DEFAULT,storage.newInputStream(0),false)
		var istream = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);
		istream.setData(cookies, cookies.length);
		if (zipW.hasEntry(this.cookieSaved))
		    zipW.removeEntry(this.cookieSaved,false)
		zipW.addEntryStream(this.cookieSaved,null,Ci.nsIZipWriter.COMPRESSION_DEFAULT,istream,false)
		
		info = JSON.stringify( info );
		
		istream.setData(info, info.length);
		if (zipW.hasEntry("info.json"))
		    zipW.removeEntry("info.json",false)
		zipW.addEntryStream("info.json",null,Ci.nsIZipWriter.COMPRESSION_DEFAULT,istream,false)
		zipW.close();
    log("session saved");
    consolelog( "Session Saved" );
	},
	
  unzipHTML: function(){
		var zipFile=Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
		zipFile.append("session.zip");
		var outFile=Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
		outFile.append("session.html"); //perche cambiare nome?
		if( ! outFile.exists() )
			outFile.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0666);
		var zipReader = Cc["@mozilla.org/libjar/zip-reader;1"]
                .createInstance(Ci.nsIZipReader);
        zipReader.open( zipFile );
		zipReader.extract( "page.html", outFile );
		return outFile.path;
	},
  unzipCookies: function(){
    var zipFile=Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
    zipFile.append("session.zip");
    var outFile=Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
    outFile.append("cookies.json");
    if( ! outFile.exists() )
      outFile.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0666);
    var zipReader = Cc["@mozilla.org/libjar/zip-reader;1"]
                .createInstance(Ci.nsIZipReader);
        zipReader.open( zipFile );
    var stream = zipReader.getInputStream("cookies.json");
    
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

  initPref: function()  
   {  
     
     this.prefs = Components.classes["@mozilla.org/preferences-service;1"]  
         .getService(Components.interfaces.nsIPrefService)  
         .getBranch("extensions.sessionmanager.");  
     this.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);  
     this.prefs.addObserver("", this, false);  
     this.savingPath = this.prefs.getCharPref("savingpath");
     this.savingTimer = this.prefs.getIntPref("savingtimer");
     this.autosaving = this.prefs.getBoolPref("autosaving");
   },

  //observer for preferences changes 
  observe: function(subject, topic, data) {  
	if ( /^http\-on\-examine(\-\w+)?\-response$/gi.test( topic ) ) {  
		subject.QueryInterface(Components.interfaces.nsIHttpChannel);  
		var url = subject.URI.spec; /* url being requested. you might want this for something else */  
		/*var browser = this.getBrowserFromChannel(subject);  
		if (browser != null) {  
		}*/
      /*if (RE_URL_TO_MODIFY.test(url)) { // RE_URL_TO_MODIFY is a regular expression.  
        aSubject.setRequestHeader("Referer", "http://example.com", false);  
      } else if (RE_URL_TO_CANCEL.test(url)) { // RE_URL_TO_CANCEL is a regular expression.  
        aSubject.cancel(Components.results.NS_BINDING_ABORTED);  
      } */ 
    } 
     if (topic != "nsPref:changed")  
     {  
       return;  
     }  
     
     switch(data)  
     {  
       case "autosaving":
          if(this.autosaving)
            window.clearInterval(this.timerID);
          this.autosaving = this.prefs.getBoolPref("autosaving");
          if(this.autosaving){
            this.timerID = window.setInterval(this.saveSession,this.savingTimer*1000);
            log("timer on");
          }
          break;

       case "savingpath":  
         this.savingPath = this.prefs.getCharPref("savingpath");
         log("new path: "+this.savingPath);
         break;
       case "savingtimer":  
         this.savingTimer = this.prefs.getIntPref("savingtimer");
         if(this.autosaving){
            window.clearInterval(this.timerID);
            this.timerID = window.setInterval(this.saveSession,this.savingTimer*1000);
         }
         log("new timer: "+this.savingTimer);
         break;  
     }  
  },   
   
  shutdown: function() {  
    this.prefs.removeObserver("", this);  
   },

  onUIReady : function(aEvent) {
  },
  UIReadyDelayed : function(aEvent) {
  },
};

window.addEventListener("load", function(e) {
	SessionManager.onLoad(e);
}, false);
window.addEventListener("unload", function(e) {
  SessionManager.shutdown(e);
}, false);

window.addEventListener("UIReady", function(e) {
  SessionManager.onUIReady(e);
}, false);

window.addEventListener("UIReadyDelayed", function(e) {
  SessionManager.onUIReadyDelayed(e);
}, false);

