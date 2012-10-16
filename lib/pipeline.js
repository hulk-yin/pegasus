/**
 * Pegasus - Pipeline
 * Copyright(c) 2010 ~ 2011 Alibaba.com, Inc.
 * MIT Licensed
 */

var	util = require('./util');

	/**
	 * End response with 500 error.
	 * @param res {Object}
	 */
var	error = function (res) {
		res
			.status(500)
			.head('content-type', 'text/plain; charset=' + res.charset)
			.clear()
			.end('Error occurred in pipe function. See log for details.');
	},

	/**
	 * Last pipe.
	 * @param context {Object}
	 * @param next {Function}
	 */
	last = function (context, next) {
		context.response.end();
	}

	// Pipeline constructor.
	Pipeline = util.inherit(Object, {
		/**
		 * Initializer.
		 * @param config {Object}
		 */
		_initialize: function (config) {
			this._config = config;
			this._step = 0;

			config.pipe.push(last);

			this._next();
		},

		/**
		 * Move to next pipe.
		 */
		_next: function () {
			var cfg = this._config,
				context = cfg.context,
				pipe = cfg.pipe;

			if (this._step < pipe.length) {
				try {
					pipe[this._step++](context, this._next.bind(this));
				} catch (err) {
					util.error(err);
					error(context.response);
				}
			}
		}
	});

module.exports = Pipeline;