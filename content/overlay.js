var SessionManager = {

  autosaving:false,
  sessionFilename:"session.zip",
  htmlSaved : "session.html",
  cookieSaved : "cookies.json",
  savingTimer:0,
  timerID:null,
  pref:null,
  timer_debug:null,
  savingPath:null,
  onLoad : function(aEvent) {
    this.initPref();
    this.savingPath = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
    var observerService = Components.classes["@mozilla.org/observer-service;1"]  
          .getService(Components.interfaces.nsIObserverService);
    
    observerService.addObserver(this,"network:offline-about-to-go-offline",false);
        
    if(this.autosaving){
      this.timerID = window.setInterval(this.saveSession,this.savingTimer*1000);
      notify("timer: "+this.savingTimer);
    }
    notify("loaded");
  },
  
  getCurrentURI:function(){

    var currentWindow = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator).getMostRecentWindow("navigator:browser");
    var currBrowser = currentWindow.getBrowser();
    var currURL = currBrowser.currentURI.spec;
    var ios = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
    return ios.newURI(currURL, null, null);
  },

  getCookies:function(){
  
  var cookies = [];
  uri = this.getCurrentURI();
  
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

    /*TODO pag locale, about:..*/

    this.timer_debug=(new Date).getTime();

    notify("saving session");
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
    notify("Page restored");
    
  },
  removeCookies : function(){
    var cookieSvc = Components.classes["@mozilla.org/cookieService;1"]  
                  .getService(Components.interfaces.nsICookieService);  
    var cookieStr = cookieSvc.getCookieString(this.getCurrentURI(), null);
    var cookieManager = Components.classes["@mozilla.org/cookiemanager;1"]
                    .getService(Components.interfaces.nsICookieManager);
    cookieManager.removeAll();
    var cookieStr = cookieSvc.getCookieString(this.getCurrentURI(), null);
    notify("Cookies removed/Session destroyed");

  },
  restoreCookies : function(){
    cookies = this.unzipCookies();

    var cookieManager = Components.classes["@mozilla.org/cookiemanager;1"]
                    .getService(Components.interfaces.nsICookieManager2);

    for(var i in cookies){
      c = cookies[i];
      cookieManager.add(c.host,c.path,c.name,c.value,c.isSecure,c.isHttpOnly,c.isSession,c.expiry);
    }

    notify("Cookies restored");
  },

  restoreSession: function(){
    var t = (new Date).getTime();
    var outFile = this.savingPath.clone();
    outFile.append(this.sessionFilename);

    if( ! outFile.exists() ){
      notify("No saved session!");
      return;
    }
    this.restoreCookies();
    this.restorePage();
    notify("Executed in :"+((new Date).getTime()-t) +" ms");
    
  },

  sendMessageToGetHTML: function() {
    Browser.selectedBrowser.messageManager.sendAsyncMessage("SessMan:AskChildForHTML",{});
  },
  
  receiveMessage: function(aMessage) {
    /*Receive HTML source -> zip it*/
    SessionManager.zipToFile( aMessage.json.html, SessionManager.getCookies(), aMessage.json.info );
    notify("session saved");
    logconsole( "Session Saved" );
    window.messageManager.removeMessageListener("SessMan:ReceiveHTMLFromChild", SessionManager.receiveMessage );
    delta = ((new Date).getTime())-SessionManager.timer_debug;
    logconsole("Saving Executed in: "+delta+" ms.");
    notify("Executed in: "+delta+" ms.");
  },
  
	zipToFile : function ( html, cookies, info ) {

    var outFile = this.savingPath.clone();
    /* Zip file*/
    
		outFile.append(this.sessionFilename);

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
		
		if (zipW.hasEntry(this.htmlSaved))
		    zipW.removeEntry(this.htmlSaved,false)
		zipW.addEntryStream(this.htmlSaved,null,Ci.nsIZipWriter.COMPRESSION_DEFAULT,instr,false)
		var istream = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);
		istream.setData(cookies, cookies.length);
		if (zipW.hasEntry(this.cookieSaved))
		    zipW.removeEntry(this.cookieSaved,false)
		zipW.addEntryStream(this.cookieSaved,null,Ci.nsIZipWriter.COMPRESSION_DEFAULT,istream,false)
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

  initPref: function()  
   {  
     
     this.prefs = Components.classes["@mozilla.org/preferences-service;1"]  
         .getService(Components.interfaces.nsIPrefService)  
         .getBranch("extensions.sessionmanager.");  
     this.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);  
     this.prefs.addObserver("", this, false);  
     this.savingTimer = this.prefs.getIntPref("savingtimer");
     this.autosaving = this.prefs.getBoolPref("autosaving");
   },

  //observer for preferences changes 
  observe: function(subject, topic, data) {  

  
     if (topic == "network:offline-about-to-go-offline"){
      this.saveSession();
     } 
     if (topic == "nsPref:changed"){     
      switch(data)  
          {  
            case "autosaving":
               if(this.autosaving)
                 window.clearInterval(this.timerID);
               this.autosaving = this.prefs.getBoolPref("autosaving");
               if(this.autosaving){
                 this.timerID = window.setInterval(this.saveSession,this.savingTimer*1000);
                 notify("timer on");
               }else{
                 notify("timer off");
               }
               break;
     
            case "savingtimer":  
              this.savingTimer = this.prefs.getIntPref("savingtimer");
              if(this.autosaving){
                 window.clearInterval(this.timerID);
                 this.timerID = window.setInterval(this.saveSession,this.savingTimer*1000);
              }
              notify("new timer: "+this.savingTimer);
              break;  
      } 
    } 
  },   
   
  unload: function() {  
    this.prefs.removeObserver("", this);  
   }
};

window.addEventListener("load", function(e) {
	SessionManager.onLoad(e);
}, false);
window.addEventListener("unload", function(e) {
  SessionManager.unload(e);
}, false);


