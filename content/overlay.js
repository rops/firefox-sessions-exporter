//Services.prefs.getIntPref("extensions.sessionmanager.something");
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
  savingTimer:0,
  current_html:"",
  timerID:null,
  pref:null,
  current_cookie:new Array(),
  onLoad : function(aEvent) {
    this.initPref();
    this.timerID = window.setInterval(this.saveSession,this.savingTimer*1000);
    log("timer: "+this.savingTimer);
    log("loaded");
  },

  saveSession: function(){
    log("timeout");
    //listen for msg from child
    window.messageManager.addMessageListener("SessMan:ReceiveHTMLFromChild", SessionManager);
    //script executed by child process
    window.messageManager.loadFrameScript("chrome://SessionManager/content/content.js", true);

    SessionManager.sendMessageToGetHTML();
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
		var outFile=Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
    //outFile = this.prefs.savingPath;
		outFile.append("session.zip");
		//alert( outFile.path );
		if( ! outFile.exists() )
			outFile.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0666);
		var zipWriter = Components.Constructor("@mozilla.org/zipwriter;1", "nsIZipWriter");
		var zipW = new zipWriter();
		zipW.open( outFile, 0x04 /*PR_RDWR*/ | 0x08 /*PR_CREATE_FILE*/ | 0x20 /*PR_TRUNCATE*/);
		var istream = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);
		istream.setData(html, html.length);
		if (zipW.hasEntry("page.html"))
		    zipW.removeEntry("page.html",false)
		zipW.addEntryStream("page.html",null,Ci.nsIZipWriter.COMPRESSION_DEFAULT,istream,false)
		istream.setData(cookies, cookies.length);
		if (zipW.hasEntry("cookies.json"))
		    zipW.removeEntry("cookies.json",false)
		zipW.addEntryStream("cookies.json",null,Ci.nsIZipWriter.COMPRESSION_DEFAULT,istream,false)
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
   },

  //observer for preferences changes 
  observe: function(subject, topic, data) {  
     if (topic != "nsPref:changed")  
     {  
       return;  
     }  
   
     switch(data)  
     {  
       case "savingpath":  
         this.savingPath = this.prefs.getCharPref("savingpath");
         log(this.savingPath);
         break;
       case "savingtimer":  
         this.savingTimer = this.prefs.getIntPref("savingtimer");
         window.clearInterval(this.timerID);
         this.timerID = window.setInterval(this.saveSession,this.savingTimer*1000);
         log("new timer: "+this.savingTimer);
         log(this.savingTimer);
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

