/*function log(msg){
  let alerts = Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService);
  alerts.showAlertNotification(null, "Log", msg, false, "", null);  
}

function logconsole(msg){

  var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
                                 .getService(Components.interfaces.nsIConsoleService);
  consoleService.logStringMessage("HPPS: " + msg);

}*/

function rel_to_abs(url){

  location = content.document.location;
    /* Only accept commonly trusted protocols:
     * Only data-image URLs are accepted, Exotic flavours (escaped slash,
     * html-entitied characters) are not supported to keep the function fast */
  if(/^(https?|file|ftps?|mailto|javascript|data:image\/[^;]{2,9};):/i.test(url))
         return url; //Url is already absolute

    var base_url = location.href.match(/^(.+)\/?(?:#.+)?$/)[0]+"/";
    if(url.substring(0,2) == "//")
        return location.protocol + url;
    else if(url.charAt(0) == "/")
        return location.protocol + "//" + location.host + url;
    else if(url.substring(0,2) == "./")
        url = "." + url;
    else if(/^\s*$/.test(url))
        return ""; //Empty = Return nothing
    else url = "../" + url;

    url = base_url + url;
    var i=0
    while(/\/\.\.\//.test(url = url.replace(/[^\/]+\/+\.\.\//g,"")));

    /* Escape certain characters to prevent XSS */
    url = url.replace(/\.$/,"").replace(/\/\./g,"").replace(/"/g,"%22")
            .replace(/'/g,"%27").replace(/</g,"%3C").replace(/>/g,"%3E");
    return url;
}

function updateDOM(inputField) {
    inputField.setAttribute("value", inputField.value);
    if (inputField.tagName == "textarea") {
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
  
  for(var i=0;i<elems.length;i++)
  	updateDOM( elems[i] );

  var loc = content.document.location;
  var base = content.document.createElement("BASE");
  var addr = loc.protocol + "//" + loc.hostname + loc.pathname;
  addr = addr.substr( 0, addr.lastIndexOf("/") );
  base.setAttribute( "href", addr );
  content.document.getElementsByTagName("head")[0].appendChild( base );

  var source = content.document.documentElement.innerHTML;
  
  return source;  
  
  
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
  
//  content.wrappedJSObject.console.log( source );
  return source;
}

function getHTML(){
  return getHTMLold();
  //return replace_all_rel_by_abs(content.document.documentElement.innerHTML);
}

function msgRcv(aMessage) {
  //send message to Parent with html source
//   content.wrappedJSObject.console.log( "ARGH" );
  removeMessageListener( "SessMan:AskChildForHTML", msgRcv);
  sendAsyncMessage("SessMan:ReceiveHTMLFromChild", {html:getHTML(),info:{url:content.window.location.href,referer:content.document.referrer}});
  //alert("MSG sent");
}

//listen for msg from Parent for getting HTML source
addMessageListener("SessMan:AskChildForHTML", msgRcv);
