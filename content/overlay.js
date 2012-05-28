function log(msg){
	let alerts = Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService);
  alerts.showAlertNotification(null, "Log", msg, false, "", null);	
}

function getCurrentURI(){

    var currentWindow = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator).getMostRecentWindow("navigator:browser");
    var currBrowser = currentWindow.getBrowser();
    var currURL = currBrowser.currentURI.spec;
    var ios = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
    return ios.newURI(currURL, null, null);
}

function getCookies() {
  
  uri = getCurrentURI();
  var cookieSvc = Components.classes["@mozilla.org/cookieService;1"]  
                    .getService(Components.interfaces.nsICookieService);  
  var cookie = cookieSvc.getCookieString(uri, null);
  //log(cookie);
  return JSON.stringify( cookie );

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
    if(this.autosaving){
      this.timerID = window.setInterval(this.saveSession,this.savingTimer*1000);
      log("timer: "+this.savingTimer);
    }
    log("loaded");
  },

  saveSession: function(){
    log("saving session");
    //listen for msg from child
    window.messageManager.addMessageListener("SessMan:ReceiveHTMLFromChild", SessionManager);
    //script executed by child process
    window.messageManager.loadFrameScript("chrome://SessionManager/content/content.js", true);

    SessionManager.sendMessageToGetHTML();
  },
  restoreSession: function(){


  },

  sendMessageToGetHTML: function() {
    Browser.selectedBrowser.messageManager.sendAsyncMessage("SessMan:AskChildForHTML",{});
    //log("sent from parent to child");
  },
  
  receiveMessage: function(aMessage) {
    //log("rcv msg from child to parent");
//    this.current_html = aMessage.json.html;
//    this.current_cookie = getCookies();
    //save on disk
    window.messageManager.removeMessageListener("SessMan:ReceiveHTMLFromChild", SessionManager);
    this.zipToFile( aMessage.json.html, getCookies() );
  },
  
	zipToFile : function ( html, cookies ) {

    outFile = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
		outFile.append(this.sessionFilename);

		if( ! outFile.exists() )
			outFile.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0666);
		var zipWriter = Components.Constructor("@mozilla.org/zipwriter;1", "nsIZipWriter");
		var zipW = new zipWriter();
		zipW.open( outFile, 0x04 /*PR_RDWR*/ | 0x08 /*PR_CREATE_FILE*/ | 0x20 /*PR_TRUNCATE*/);
		var istream = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);
		istream.setData(html, html.length);
		if (zipW.hasEntry(this.htmlSaved))
		    zipW.removeEntry(this.htmlSaved,false)
		zipW.addEntryStream(this.htmlSaved,null,Ci.nsIZipWriter.COMPRESSION_DEFAULT,istream,false)
		istream.setData(cookies, cookies.length);
		if (zipW.hasEntry(this.cookieSaved))
		    zipW.removeEntry(this.cookieSaved,false)
		zipW.addEntryStream(this.cookieSaved,null,Ci.nsIZipWriter.COMPRESSION_DEFAULT,istream,false)
		zipW.close();
    log("session saved");
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

