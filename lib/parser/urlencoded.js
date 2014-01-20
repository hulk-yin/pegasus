var qs = require('querystring'),
	util = require('../util');

	/**
	 * Parse urlencoded post request.
	 * @param bin {Buffer}
	 * @param parameter {string}
	 * @param charset {string}
	 * @return {Object}
	 */
var parse = function (bin, parameter, charset) {  
		
		var str = util.decode(bin, charset) 
		str=str.replace(/%([A-z][a-zA-Z0-9])/g,function(_,code){ 
    		return String.fromCharCode(parseInt(code,16)); 
		}),text = decodeURIComponent(str),
			data = qs.parse(text); 
		return data;
	};

exports.parse = parse;
