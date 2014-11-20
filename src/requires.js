// JavaScript Document
(function( head ){
	var requires = new Class();

	var regx_root = /^\/.+/,
		regx_http = /^http\:\/\//i,
		regx_parent = /^\.\.\/.+/,
		regx_self = /^\.\/.+/,
		regx_local = /^\:.+/;
	
	requires.add('initialize', function(selector, filename){
		this.__filename = filename;
		this.__dirname = this.__filename.split('/').slice(0, -1).join('/');
		this.__loadModule = selector;
		return this.compile();
	});
	
	requires.add('loadscript', function(url){
		return new Promise(function( resolve ){
			var node = document.createElement("script");
			node.onload = node.onerror = node.onreadystatechange = function(){
				if ( /loaded|complete|undefined/i.test(node.readyState) ) {
					node.onload = node.onerror = node.onreadystatechange = null;
					resolve(node);
				}
			}
			node.async = true;
			node.src = url;
			head.insertBefore( node, head.firstChild );
		});
	});
	
	requires.add('loadcss', function(href, before, media){
		return new Promise(function(resolve){
			var ss = window.document.createElement( "link" );
			var ref = before || window.document.getElementsByTagName( "script" )[ 0 ];
			var sheets = window.document.styleSheets;
				ss.rel = "stylesheet";
				ss.href = href;
				ss.media = "only x";
				ref.parentNode.insertBefore( ss, ref );
			
			var dtime = new Date().getTime();
			function toggleMedia(){
				if ( new Date().getTime() - dtime > 30000 ){
					reject(ss);
					return;
				};
				var defined;
				for( var i = 0; i < sheets.length; i++ ){
					if( sheets[ i ].href && sheets[ i ].href.indexOf( href ) > -1 ){
						defined = true;
					}
				}
				if( defined ){
					ss.media = media || "all";
					resolve(ss);
				}
				else {
					setTimeout( toggleMedia );
				}
			}
			
			toggleMedia();
		});
	});
	
	requires.add('request', function(url){
		if ( /\.css(?:\?|$)/i.test(url) ){
			return this.loadcss(url);
		}else{
			return this.loadscript(url);
		}
	});
	
	function contrasted(str, dirname){
		if ( str === undefined || typeof str !== 'string' ){
			throw 'Tronjs Error Message: Error Selector String. It Must Be Exist. Now It Is Undefined.';
			return;
		};
		
		if ( window.modules.maps[str] ){ 
			str = window.modules.maps[str]; 
		};
		
		// root like /a/b/c
		if ( regx_root.test(str) ){ 
			str = Library.httpDomain + str; 
		}
		// http://
		else if ( regx_http.test(str) ){ 
			str = str; 
		}
		// parent like ../a/b/c
		else if ( regx_parent.test(str) ){
			str = ResolveParentSelector(dirname + '/' + str); 
		}
		// self like ./a/b/c
		else if ( regx_self.test(str) ){ str = dirname + '/' + str.replace(/^\.\//, ''); }
		// local like :a/b/c
		else if ( regx_local.test(str) ){ 
			str = str.replace(/^:/, '').replace(/^\//, ''); 
			str = Library.httpBase + '/' + str; 
		}
		// base like a/b/c
		else{ str = dirname + '/' + str.replace(/^\.\//, ''); }
		
		return str;
	}
	
	function resolved(str, dirname){
		str = contrasted(str, dirname);
		
		if ( !str ) return;

		if ( /\.css$/i.test(str) ){ str = str; }
		else if ( /\.js$/i.test(str) ){ str = str; }
		else{ str += '.js'; }
		
		return str;
	}
	
	requires.add('contrast', function(str, dirname){
		dirname = dirname || this.__dirname;
		return contrasted(str, dirname);
	});
	
	requires.add('resolve', function(str, dirname){
		dirname = dirname || this.__dirname;
		return resolved(str, dirname);
	});
	
	requires.add('inRequire', function(selector, dirname){
		if ( window.modules.exports[selector] ){
			return window.modules.exports[selector].module.exports;
		}else{
			selector = this.resolve(selector, dirname);
			return window.modules.exports[selector].module.exports;
		}
	});
	
	requires.add('CompileFactory', function(modules, depicals){
		var factory = modules.factory,
			that = this,
			inRequire = function(selector){
				if ( window.modules.exports[selector] ){
					return window.modules.exports[selector].module.exports;
				}else{
					selector = that.resolve(selector, modules.__dirname);
					return window.modules.exports[selector].module.exports;
				}
			};

		var ret = null;
		try{
			depicals = depicals.concat([inRequire, modules.exports, modules]);
			ret = typeof factory === 'function' ? factory.apply( this, depicals ) : null;
		}catch(e){}

		window.modules.exports[modules.__modulename].module = modules;
		window.modules.exports[modules.__modulename].status = false;
		
		if ( ret ){
			window.modules.exports[modules.__modulename].module.exports = ret;
		};

		return window.modules.exports[modules.__modulename].module.exports;
	});
	
	requires.add('parseModules', function(node){

		var modules = null, _modules = null;
		if ( !node.__LoaderModule__ ){
			modules = Array.prototype.slice.call(window.__LoaderModule__, 0);
		}else{
			modules = node.__LoaderModule__;
		};

		if ( modules.length > 0 ){
			var keepModules = [];
			for ( var i = 0 ; i < modules.length ; i++ ){
				if ( !modules[i].__filename || modules[i].__filename.length === 0 ){
					modules[i].__filename = node.src ? node.src : node.href;
					modules[i].__modulename = modules[i].__filename;
					modules[i].__dirname = modules[i].__filename.split('/').slice(0, -1).join('/');
				}else{
					var dpath = node.src ? node.src : node.href;
					var durl = this.resolve(modules[i].__filename, dpath.split('/').slice(0, -1).join('/'));
					modules[i].__modulename = durl;
					modules[i].__filename = dpath;
					modules[i].__dirname = dpath.split('/').slice(0, -1).join('/');
				}

				keepModules.push(modules[i]);
			}
			modules = keepModules;

		}else{
			var m = function(){
				this.exports 		= {};
				this.__filename		= null;
				this.__modulename	= null;
				this.__dirname		= null;
				this.dependencies 	= [];
				this.factory		= null;
				this.amd			= false;
			}
			_modules = new m();
			_modules.__filename = node.src ? node.src : node.href;
			_modules.__modulename = _modules.__filename;
			_modules.__dirname = _modules.__filename.split('/').slice(0, -1).join('/');
			modules = [_modules];
		}
		
		window.__LoaderModule__ = [];
		
		return modules;
	});
	
	requires.add('parseModuleDependencies', function(modules, resolve, node){
		var Promises = [], 
			that = this;

		for ( var i = 0 ; i < modules.length ; i++ ){
			var module = modules[i];
			if ( /item\.js$/.test(module.__modulename) ){
				console.log(module)
			}
			Promises.push(
				new Promise(function(_resolve){
					if ( !window.modules.exports[module.__modulename] ){
						window.modules.exports[module.__modulename] = {
							status: true,
							module: {
								exports: {}
							}
						};
	
						if ( module.dependencies && module.dependencies.length > 0 ){
							if ( !module.amd ){
								var PromiseRequires = [];
								for ( var i = 0 ; i < module.dependencies.length ; i++ ){
									PromiseRequires.push(new requires(module.dependencies[i], module.__filename));
								}
								Promise.all(PromiseRequires).then(function(){
									var argcs = [];
			
									for ( var j = 0 ; j < module.dependencies.length ; j++ ){
										argcs.push(that.inRequire(module.dependencies[j], module.__dirname));
									}
									
									that.CompileFactory(module, argcs);
									_resolve();
								});
								
							}else{
								var argcs = [];
								var promiseAMD = function(i, module, callback){
									if ( i + 1 > module.dependencies.length ){
										callback();
									}else{
	
										var PromiseRequire = new requires(module.dependencies[i], module.__filename);									
										PromiseRequire.then(function(){
											argcs.push(that.inRequire(module.dependencies[i], module.__dirname));
											promiseAMD(++i, module, callback);
										});
									}
								}
								promiseAMD(0, module, function(){
									that.CompileFactory(module, argcs);
									_resolve();
								});
							}
						}else{
							that.CompileFactory(module, []);
							_resolve();
						}
					}else{
						that.parseResolveRequire(module.__modulename, _resolve);
					}	
				})
			);
		}
		
		Promise.all(Promises).then(function(){
			var __filename__ = node.src ? node.src : node.href;
			if ( /\.js$/.test(__filename__) ){
				node.parentNode.removeChild(node);
			};
			resolve();
		});
		
	});
	
	requires.add('parseResolveRequire', function(url, resolve){
		var that = this;
		var delays = function(uri, _resolve){
			var wait = function(){
				setTimeout(function(){
					if ( !window.modules.exports[url].status ){
						_resolve();
					}else{
						wait();
					}
				}, 1);
			};
			wait();
		}

		if ( window.modules.exports[url].status ){
			if ( !resolve ){
				return new Promise(function(_resolve){ delays(url, _resolve); });
			}else{
				delays(url, resolve);
			}
		}else{
			if ( !resolve ){
				return Promise.resolve();
			}else{
				resolve();
			}
		}
		
	});
	
	requires.add('compile', function(){
		var that = this;
		var url = this.resolve(this.__loadModule);
		
		if ( !window.modules.exports[url] ){
			return new Promise(function(resolve){
				that.request(url).then(function(node){
					that.parseModuleDependencies(that.parseModules(node), resolve, node);
				});
			});
		}else{
			return this.parseResolveRequire(url);
		}

	});
	
	window.require = function(deps, callback){
		return window.modules.Promise = window.modules.Promise.then(function(){
			if ( !readVariableType(deps, 'array') ){ deps = [deps]; };
		
			var k = [];

			for ( var i = 0 ; i < deps.length ; i++ ){
				k.push(new requires(deps[i], window.Library.httpFile));
			};

			return Promise.all(k).then(function(){
				var t = [];
				for ( var j = 0 ; j < deps.length ; j++ ){
					
					if ( window.modules.exports[deps[j]] ){
						t.push(window.modules.exports[deps[j]]);
					}else{
						var selector = resolved(deps[j], window.Library.httpFile.split('/').slice(0, -1).join('/'));
						t.push(window.modules.exports[selector].module.exports);
					}
				}

				typeof callback === 'function' && callback.apply(null, t);

				return t;
			});
		});
	}
	
	function ResolveParentSelector( p ){
		var parentNode = p.replace(Library.httpDomain, "");
			
		if ( /^\//.test(parentNode) ){
			parentNode = parentNode.replace(/^\//, "");
		}
		
		var parentArrays = parentNode.split("/"),
			index = parentArrays.indexOf("..");
			
		if ( index > -1 ){
			index--;
			
			if ( index < 0 ){
				index = 0;
				parentArrays.splice(0, 1);
			}
			else{
				parentArrays.splice(index, 2);
			}
			
			var x = parentArrays.join("/");
			
			if ( !regx_http.test(x) ){
				x = Library.httpDomain + "/" + x;
			}
			
			return ResolveParentSelector(x);
		}else{
			
			var b = parentArrays.join("/");
			
			if ( !regx_http.test(b) ){
				b = Library.httpDomain + "/" + b;
			}
			
			return b;
			
		}
	};
	
	function getEmpty(json){
		var j = 0;
		for ( var i in json ){
			j++;
		}
		
		return j === 0;
	}
	
})( head = document.head || document.getElementsByTagName('head')[0] || document.documentElement );