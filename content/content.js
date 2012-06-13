function updateDOM(inputField) {

    inputField.setAttribute("value", inputField.value);
    if (inputField.tagName.toLowerCase() == "textarea") {
        inputField.innerHTML = inputField.value;
    }
}

function getHTML(){

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

  var enc = content.document.createElement("META");
  enc.setAttribute("http-equiv", "Content-Type" );
  enc.setAttribute("content", "text/html; charset=utf-8" );
  content.document.getElementsByTagName("head")[0].appendChild( enc );
  
  var current_url = content.document.location.href;
  var clean_url = current_url.replace( /#.*?$/gi , "" );
  var root_url = current_url.replace( /^(https?:\/\/[^\/]+\/?).*?$/gi, "$1" );
  var relative_url = current_url.replace( /^(.*?\/)[^\/]+$|^(.*?\/)$/gi, "$1" );
  
  var resolveLink = function( url ){
    if( url.match( /^\s*https?:\/\//gi ) )
      return url;
    else if( url.trim().substr(0,5) == "data:" )
      return url;
    else if( url.trim().substr(0,2) == "//" )
      return loc.protocol + url;
    else if( url[0] == "/" )
      return root_url + url.substr(1);
    else if( url[0] == "#" )
      return url;
    else
      return relative_url + url;
  }
  
  var cssURIRegex = /url\(\s*(["']?)([^)"' \n\r\t]+)\1\s*\)/gm;
  var iter = content.document.evaluate("//*[@style]", content.document, null, 0, null);
  while(e = iter.iterateNext()) {
    var cssText = e.getAttribute("style");
    if(!cssText)
      continue;
    var results = null;
    while((results = cssURIRegex.exec(cssText)) != null) {
      var newStyle = cssText.replace( results[2], resolveLink( results[2] ) );
      e.setAttribute( "style", newStyle );
    }
  }
  
  var elems = content.document.getElementsByTagName("STYLE");
  for(var i=0;i<elems.length;i++){
    if( elems[i].innerHTML.match( cssURIRegex ) ){
      var cssText = elems[i].innerHTML;
    elems[i].innerHTML = cssText.replace( cssURIRegex, function( match, s1, s2, offset, s0 ){
        return "url("+s1+resolveLink( s2 )+s1+")";
      });
    }
  }
  
  var source = content.document.documentElement.innerHTML;
  return source;  
  
  
  
  source = source.replace( /\s(href|src|action)=([\'\"])(.*?)\2/gi , function( match, s1, s2, s3, offset, s0 ){
    return " "+s1+"="+s2+resolveLink( s3 )+s2;
  });
  
  return source;
}
function logconsole(msg){
  var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
                                 .getService(Components.interfaces.nsIConsoleService);
  consoleService.logStringMessage("[HPPS] " + msg);
}

function msgRcv(aMessage) {
  //send message to Parent with html source
  removeMessageListener( "SessMan:AskChildForHTML", msgRcv);
  sendAsyncMessage("SessMan:ReceiveHTMLFromChild", {html:getHTML()/*,info:{url:content.window.location.href,referer:content.document.referrer}*/});
}

//listen for msg from Parent for getting HTML source
addMessageListener("SessMan:AskChildForHTML", msgRcv);
