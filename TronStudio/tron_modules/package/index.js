﻿(function (mod) {
    if (typeof exports == "object" || typeof exports === 'function' && typeof module == "object") {
        module.exports = mod();
    }
    else if (typeof define == "function" && define.amd) {
        return define([], mod);
    }
    else {
        window.package = mod();
    }
})(function () {
	
	var package = new Class();
	
	package.add('a', 1)
	
	// code here.
	
	return package;
});