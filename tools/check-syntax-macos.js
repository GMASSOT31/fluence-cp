ObjC.import('Foundation');
var src = $.NSString.stringWithContentsOfFileEncodingError($.NSProcessInfo.processInfo.environment.objectForKey('F'), $.NSUTF8StringEncoding, null).js;
try { new Function(src); 'SYNTAXE OK (' + src.length + ' caractères)'; } catch (e) { 'ERREUR: ' + e; }
