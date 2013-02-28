/**
 * Pegasus - ClientRequest
 * Copyright(c) 2010 ~ 2012 Alibaba.com, Inc.
 * MIT Licensed
 */

var clientResponse = require('./clientResponse'),
	fs = require('fs'),
	server = {
		'http:': require('http'),
		'https:': require('https')
	},
	serverRequest = require('./serverRequest'),
	serverResponse = require('./serverResponse'),
	url = require('url'),
	util = require('./util'),
	version = require('./version'),
	zlib = require('zlib');

	/**
	 * Decompress gzip or deflate data.
	 * @param data {Buffer}
	 * @param encoding {string}
	 * @param callback {Function}
	 */
var decompress = function (data, encoding, callback) {
		if (encoding === 'gzip') {
			zlib.gunzip(data, callback);
		} else if (encoding === 'deflate') {
			zlib.inflate(data, callback);
		} else {
			callback(null, data);
		}
	},

	// ClientRequest contructor.
	ClientRequest = util.inherit(Object, {
		/**
		 * Initializer.
		 * @param config {Object}
		 */
		_initialize: function (config) {
			this._charset = config.charset;
			this._mountTable = config.mountTable;
		},

		/**
		 * Read local file.
		 * @param pathname {string}
		 * @param callback {Function}
		 */
		_fileRequest: function (pathname, callback) {
			var self = this;

			if (/\/\w:/.test(pathname)) { // Remove leading slash for windows pathname.
				pathname = pathname.substring(1);
			}

			fs.stat(pathname, function (err, stats) {
				if (err) {
					callback(clientResponse.create({ status: 404 }));
				} else if (stats.isFile()) {
					fs.readFile(pathname, function (err, data) {
						if (err) {
							callback(clientResponse.create({ status: 500 }));
						} else {
							callback(clientResponse.create({
								status: 200,
								headers: {
									'content-length': stats.size,
									'last-modified': stats.mtime
								},
								body: data
							}));
						}
					});
				} else {
					callback(clientResponse.create({ status: 500 }));
				}
			});
		},

		/**
		 * Read pipeline.
		 * @param pathname {string}
		 * @param callback {Function}
		 */
		_loopRequest: function (options, callback) {
			var charset = this._charset,
				mountTable = this._mountTable,
				config = {},
				request = serverRequest.create({
					body: options.body,
					charset: charset,
					mountTable: mountTable,
					request: { // Fake native request.
						client: {
							remoteAddress: '127.0.0.1'
						},
						headers: options.headers,
						method: options.method,
						protocol: 'loop:',
						url: options.url
					}
				}),
				response = serverResponse.create({
					charset: charset,
					hasBody: options.method !== 'HEAD',
					response: { // Fake native response.
						writeHead: function (status, headers) {
							config.status = status;
							config.headers = headers;
						},
						write: function (body) {
							config.body = body;
						},
						end: function () {
							callback(clientResponse.create(config));
						}
					}
				});

			mountTable.dispatch({
				charset: charset,
				request: request,
				response: response
			});
		},

		/**
		 * Read remote server.
		 * @param options {Object}
		 * @param callback {Function}
		 */
		_httpRequest: function (options, callback) {
			var	body = options.body,
				protocol = options.protocol,
				request,
				self = this;

			// Remove unnecessary options.
			delete options['body'];
			delete options['protocol'];

			request = server[protocol].request(options, function (response) {
				var status = response.statusCode,
					headers = response.headers,
					encoding = headers['content-encoding'],
					body = [];

				response.on('data', function (chunk) {
					body.push(chunk);
				});

				response.on('end', function () {
					decompress(Buffer.concat(body), encoding, function (err, data) {
						if (err) {
							callback(clientResponse.create({ status: 500 }));
						} else {
							// Remove unnecessary headers.
							delete headers['content-length'];
							delete headers['content-encoding'];

							callback(clientResponse.create({
								status: status,
								headers: headers,
								body: data
							}));
						}
					});
				});
			});

			request.on('error', function (err) {
				callback(clientResponse.create({ status: 500 }));
			});

			body && request.write(body);
			request.end();
		},

		/**
		 * Request something.
		 * @param options {Object|string}
		 * @param callback {Function}
		 */
		request: function (options, callback) {
			if (util.isString(options)) { // Refine arguments.
				options = {
					href: options,
				};
			}

			var charset = this._charset,
				meta = url.parse(options.href);

			if (util.isString(options.body)) { // Convert body to binary.
				options.body = util.encode(options.body, charset);
			}

			switch (meta.protocol) {
			case 'file:':
				this._fileRequest(meta.path, callback);
				break;
			case 'loop:':
				this._loopRequest({
					body: options.body || new Buffer(0),
					headers: util.mix({
						host: meta.host,
						'user-agent': 'pegasus/' + version.number
					}, options.headers),
					method: options.method,
					url: meta.path
				}, callback);
				break;
			case 'http:': // Fall through.
			case 'https:':
				this._httpRequest({
					body: options.body,
					headers: util.mix({
						'accept-encoding': 'gzip, deflate',
						host: meta.host,
						'user-agent': 'pegasus/' + version.number
					}, options.headers),
					hostname: options.hostname || meta.hostname,
					method: options.method || 'GET',
					path: meta.path,
					port: meta.port,
					protocol: meta.protocol
				}, callback);
				break;
			default:
				callback(clientResponse.create({ status: 500 }));
				break;
			}
		}
	});

/**
 * Create an instance.
 * @param config {Object}
 * @return {Function}
 */
exports.create = function (config) {
	var client = new ClientRequest(config);

	return client.request.bind(client);
};