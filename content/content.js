function log(msg){
  let alerts = Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService);
  alerts.showAlertNotification(null, "Log", msg, false, "", null);  
}

function getHTML(){
  var source = content.document.documentElement.innerHTML;
  var current_url = content.document.location.href;
  var clean_url = current_url.replace( /#.*?$/gi , "" );
  var root_url = current_url.replace( /^(https?:\/\/[^\/]+\/?).*?$/gi, "$1" );
  var relative_url = current_url.replace( /^(.*?\/)[^\/]+$|^(.*?\/)$/gi, "$1" );
  
  var resolveLink = function( url ){
    if( url.match( /^\s*https?:\/\//gi ) )
      return url;
    else if( url[0] == "/" )
      return root_url + url.substr(1);
    else if( url[0] == "#" )
      return clean_url + url;
    else
      return relative_url + url;
  }
  
  source = source.replace( /\s(href|src|action)=([\'\"])(.*?)\2/gi , function( match, s1, s2, s3, offset, s0 ){
    return " "+s1+"="+s2+resolveLink( s3 )+s2;
  });
  return source;
}

function msgRcv(aMessage) {
  //send message to Parent with html source
  sendAsyncMessage("SessMan:ReceiveHTMLFromChild", {html:getHTML()});
}

//listen for msg from Parent for getting HTML source
addMessageListener("SessMan:AskChildForHTML", msgRcv);
