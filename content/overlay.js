function log(msg){
	let alerts = Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService);
  alerts.showAlertNotification(null, "Log", msg, false, "", null);	
}

function getCookies() {
  var cookieMgr = Components.classes["@mozilla.org/cookiemanager;1"]  
              .getService(Components.interfaces.nsICookieManager);  
  
  var dumped = new Array();
  
  for (var e = cookieMgr.enumerator; e.hasMoreElements();) {  
      var cookie = e.getNext().QueryInterface(Components.interfaces.nsICookie);   
        dumped.push( cookie );
  }
  //filter cookies and encode in json..
};

var SessionManager = {

  current_html:"",
  current_cookie:new Array(),
  onLoad : function(aEvent) {
    //listen for msg from child
    window.messageManager.addMessageListener("SessMan:ReceiveHTMLFromChild", this);
    //script executed by child process
    window.messageManager.loadFrameScript("chrome://SessionManager/content/content.js", true);
  },

  saveSession: function(){
    this.sendMessageToGetHTML();
  },

  sendMessageToGetHTML: function() {
    Browser.selectedBrowser.messageManager.sendAsyncMessage("SessMan:AskChildForHTML",{});
    log("sent from parent to child");
  },
  
  receiveMessage: function(aMessage) {
    log("rcv msg from child to parent");
    this.current_html = aMessage.json.html;
    this.current_cookie = getCookies();
    //save on disk
    
  },

  onUIReady : function(aEvent) {
  },
  UIReadyDelayed : function(aEvent) {
  },
};

window.addEventListener("load", function(e) {
	SessionManager.onLoad(e);
}, false);

window.addEventListener("UIReady", function(e) {
  SessionManager.onUIReady(e);
}, false);

window.addEventListener("UIReadyDelayed", function(e) {
  SessionManager.onUIReadyDelayed(e);
}, false);

