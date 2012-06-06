function log(msg){
  let alerts = Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService);
  alerts.showAlertNotification(null, "Log", msg, false, "", null);  
}
function updateDOM(inputField) {

    inputField.setAttribute("value", inputField.value);
    if (inputField.tagName.toLowerCase() == "textarea") {
        inputField.innerHTML = inputField.value;
    }
}

function getHTMLold(){

  var inputs = content.document.getElementsByTagName("input");
  var textarea =  content.document.getElementsByTagName("textarea");
  var select = content.document.getElementsByTagName("select");
  
  var elems = [].concat( Array.prototype.slice.call(inputs), 
                         Array.prototype.slice.call(textarea), 
                         Array.prototype.slice.call(select) );
  

  for(var i=0;i<elems.length;i++){
  	updateDOM( elems[i] );
  }

  var loc = content.document.location;
  var base = content.document.createElement("BASE");
  var addr = loc.protocol + "//" + loc.hostname + loc.pathname;
  addr = addr.substr( 0, addr.lastIndexOf("/") );
  base.setAttribute( "href", addr );
  content.document.getElementsByTagName("head")[0].appendChild( base );

  var source = content.document.documentElement.innerHTML;

  return source;
  //return replace_all_rel_by_abs(source);  
}

function getHTML(){
  return getHTMLold();
  //return replace_all_rel_by_abs(content.document.documentElement.innerHTML);
}

function msgRcv(aMessage) {
  //send message to Parent with html source
  removeMessageListener( "SessMan:AskChildForHTML", msgRcv);
  sendAsyncMessage("SessMan:ReceiveHTMLFromChild", {html:getHTML(),info:{url:content.window.location.href,referer:content.document.referrer}});
}

//listen for msg from Parent for getting HTML source
addMessageListener("SessMan:AskChildForHTML", msgRcv);
