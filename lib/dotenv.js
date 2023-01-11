import fs from 'node:fs/promises';
import {parse} from '#lib/parse';
import {Schema} from '#lib/Schema';
import micromatch from 'micromatch';
import objUtils from '#lib/objUtils';
import strUtils from '#lib/strUtils';
import template from '@momsfriendlydevco/template';

export class DotEnv {
	/**
	* Current config state, set via .parse()
	* @type {Object}
	*/
	#state = {};


	/**
	* Current schema, set via .schema()
	* @type {Schema}
	*/
	#schema;


	/**
	* Read in dotenv details either from a path, raw String or raw Buffer
	* @param {String|Buffer|Array} input The input to parse
	* @param {Object} [options] Additional options for `parse()`
	* @returns {DotEnv} This chainable instance
	*/
	parse(input, options) {
		this.#state = parse(input, options);
		return this;
	}


	/**
	* Set one or more config variables by key/val or objects
	* @param {string|Object} key Either the key to set or an object to merge
	* @param {*} [value] If `key` is a string, the value to set
	* @returns {DotEnv} This chainable instance
	*/
	set(key, value) {
		if (typeof key == 'string') {
			this.#state[key] = value;
		} else {
			Object.assign(this.#state, key);
		}
		return this;
	}


	/**
	* Merge multiple configs together to form a single config
	* NOTE: This is really just a lazy-mans Object.assign + chaining
	* @param {Object} config... Configs to merge
	* @returns {DotEnv} This chainable instance
	*/
	merge(...configs) {
		this.#state = Object.assign(this.#state, ...configs);
		return this;
	}


	/**
	* Import values from `process.env` based on options
	* @param {Object} [options] Additional options to configure behaviour
	* @param {Object} [options.source=process.env] Source object to import from
	* @param {string} [options.prefix] Optional prefix to limit imports to
	* @param {function} [options.filter] Optional function to filter by. Called as `(key, val)`
	* @param {function} [options.replace] Optional function to rewrite the value. Called as `(key, val)` and expected to return the new value
	* @param {boolean} [options.trim=true] Try to trum whitespace from variables, if any
	* @param {boolean} [options.trimPrefix=true] If using a prefix, remove this from the final keys to merge
	* @returns {DotEnv} This chainable instance
	*/
	importEnv(options) {
		let settings = {
			source: process.env,
			prefix: '',
			match: (k, v) => true, // eslint-disable-line no-unused-vars
			replace: (k, v) => v, // eslint-disable-line no-unused-vars
			trim: true,
			trimPrefix: true,
			...options,
		};
		return this.set(
			Object.fromEntries(
				Object.entries(settings.source)
					.filter(([key]) =>
						!settings.prefix // Prefix disabled
						|| key.startsWith(settings.prefix) // OR key has that prefix
					)
					.map(([key, val]) => settings.prefix && settings.trimPrefix // Has prefix and we're trimming it
						? [key.substr(settings.prefix.length), val]
						: [key, val]
					)
					.map(([key, val]) => [
						key,
						settings.replace(key, val),
					])
					.map(([key, val]) => [
						key,
						settings.trim ? val.trim() : val,
					])
			)
		);
	}


	/**
	* Parse a schema spec against the state to mutate the input
	* @param {Object} input The input schema to apply
	* @param {Object} [options] Additional options to pass to `new Schema()`
	* @returns {DotEnv} This chainable instance
	*/
	schema(input, options) {
		this.#schema = new Schema(input, options);
		this.#state = this.#schema.apply(this.#state);
		return this;
	}


	/**
	* Check all existing config values against a glob to apply a schema
	* @param {String|RegExp|Array<String>} glob Glob / RegExp to match or array of globs to check
	* @param {FieldSchema} fieldSchema Schema to apply to matching config items
	* @returns {DotEnv} This chainable instance
	*/
	schemaGlob(glob, fieldSchema) {
		let matcher = glob instanceof RegExp ? glob : micromatch.makeRe(glob);

		// Create schema if we don't already have one
		if (!this.#schema) this.#schema = new Schema();

		Object.entries(this.#state)
			.filter(([key]) => matcher.test(key))
			.forEach(([key, val]) => {
				this.#schema.fields[key] = fieldSchema;
				this.#state[key] = this.#schema.applyField(val, fieldSchema);
			})

		return this;
	}


	/**
	* Export the config to a string
	* @param {Object} options Options object to configure behaviour
	* @param {RegExp} [options.header] How to extract section headers as a RegExp with a capture group or null to disable
	* @param {Function} [options.headerFormat] Function to format headers. Called as `(headerTitle)`
	* @param {Number} [options.headerSpacing] How many lines of spacing should be inserted before each (new) header
	* @param {Function} [options.rewritePair] Function to rewrite a single `key=val` set. Called as `(key, val, fieldSchema, settings)`
	* @returns {String} The current config as a newline seperated string
	*/
	export(options) {
		let settings = {
			header: /^(.+?)_/,
			headerFormat: h => `# ${h} #`,
			headerSpacing: 1,
			values: true,
			help: true,
			rewritePair: (key, val, field, settings) =>
				`${key}=${field.uncast ? field.uncast(val, field) : val || ''}`
				+ (settings.help && field.help ? ` # ${field.help}` : ''),
			...options,
		};

		if (!this.#schema) throw new Error('Schema has not yet been applied');

		let currentHeader;
		return Object.entries(this.#state)
			.map(([key, val]) => {
				let item = []; // Array of lines we will eventually output

				// Apply the schema to extract the default / help text {{{
				let fieldSchema = this.#schema.getFieldSchema(this.#schema.fields[key]);

				if (!settings.values) val = typeof fieldSchema.default == 'function' // Inherit default only
					? fieldSchema.default(fieldSchema) // From function
					: fieldSchema.default // From raw value
				// }}}


				// Deal with headers {{{
				if (settings.header) {
					let extractedHeader = settings.header.exec(key)[1];
					if (!currentHeader || currentHeader != extractedHeader) { // No header yet or header differs
						if (currentHeader && settings.headerSpacing > 0) // Nth header added + add spacing is true
							item.push(...Array(settings.headerSpacing).fill(''));

						item.push(settings.headerFormat(extractedHeader));
						currentHeader = extractedHeader;
					}
				}
				// }}}
				// Add in this key {{{
				item.push(
					settings.rewritePair(key, val, fieldSchema, settings)
				);
				// }}}
				return item;
			})
			.flat()
			.join('\n')
	}

	// Option mangling functions - .map() / .replace() / .trim() / .mutateKeys() / .map() / .camelCase() / .startCase() / .envCase() {{{
	/**
	* The current `deep` setting for key mangling functionality
	* @type {Number} How many levels to traverse
	*/
	#deep = 1;


	/**
	* Set the traverse depth for key mangling functions
	* @param {Number|Boolean} [depth=Infinity] The new depth to restrict to
	* @returns {DotEnv} This chainable instance
	*/
	deep(depth = Infinity) {
		this.#deep = depth || 1;
		return this;
	}


	/**
	* Replace a string or RegExp with another in all config keys
	* @param {String|RegExp} match The matching expression which should be replaced
	* @param {String|Function} [replacement=''] The value to replace matches with
	* @returns {DotEnv} This chainable instance
	*/
	replace(match, replacement = '') {
		if (typeof match == 'string') match = new RegExp('^' + strUtils.regExpEscape(match));
		return this.map(([key, val]) => [
			key.replace(match, replacement),
			val,
		]);
	}


	/**
	* Remove a prefix String / RegExp from all config keys
	* This function is really just a thin wrapper around `replace()`
	* @param {String|RegExp} match The matching prefix string or RegExp which should be replaced
	* @returns {DotEnv} This chainable instance
	*/
	trim(match) {
		return this.replace(match, '');
	}


	/**
	* Filter keys by a prefix or RegExp
	* @param {String|RegExp} match Either a string prefix to match by or a RegExp to match the whole string
	* @returns {DotEnv} This chainable instance
	*/
	filter(match) {
		if (typeof match == 'string') match = new RegExp('^' + strUtils.regExpEscape(match));
		return this.map(([key]) => match.test(key))
	}


	/**
	* Apply both a filter + trim process by the same prefix / RegExp replacement
	* @param {String|RegExp} match Either a string prefix to match by or a RegExp to match the whole string
	* @param {String|Function} [replacement=''] The value to replace matches with
	* @returns {DotEnv} This chainable instance
	*/
	filterAndTrim(match, replacement = '') {
		if (typeof match == 'string') match = new RegExp('^' + strUtils.regExpEscape(match));
		return this.map(([key, val]) => match.test(key) && [
			key.replace(match, replacement),
			val,
		])
	}


	/**
	* Apply a pre-configured mutator to a key
	* Mutators are taken from the strUtils.mutators function
	* @param {String} method Method to apply, should appear in the strUtils.mutators return
	* @returns {DotEnv} This chainable instance
	*/
	mutateKeys(method, ...args) {
		if (!strUtils.mutators[method]) throw new Error(`Mutator "${method}" is not supported`);
		return this.map(([key, val]) => [
			strUtils.mutators[method](key, ...args),
			val,
		]);
	}


	/**
	* Convert all config keys to camelCase
	* @param {Object|Number} [options] Options to mutate behaviour, if a number the value of `options.depth` is assumed
	* @param {Number} [options.depth=1] How deep into the state to traverse
	* @returns {DotEnv} This chainable instance
	*
	* @example Simple camelCasing of config values
	* dotenv.value({FOO_BAR_BAZ: 1}).camelCase().value //= {fooBarBaz: 1}
	*/
	camelCase(options) {
		let settings = {
			depth: 1,
			...options,
		};

		return this.mutateKeys('camelCase', {
			depth: settings.depth,
		});
	}


	/**
	* Convert all config keys to StartCase
	* @param {Boolean} [spacing=false] Whether to add spacing between 'words'
	* @returns {DotEnv} This chainable instance
	*
	* @example StartCase with no spacing
	* dotenv.value({FOO_BAR_BAZ: 1}).startCase().value //= {'FooBarBaz': 1}
	*
	* @example StartCase with with spacing
	* dotenv.value({FOO_BAR_BAZ: 1}).startCase(true).value //= {'Foo Bar Baz': 1}
	*/
	startCase(spacing = false) {
		return this.mutateKeys('startCase', spacing);
	}


	/**
	* Convert all config keys to ENV_CASE
	* @returns {DotEnv} This chainable instance
	*
	* @example ENV_CASE
	* dotenv.value({fooBarBaz: 1}).envCase().value //= {'FOO_BAR_BAZ': 1}
	*/
	envCase() {
		return this.mutateKeys('envCase');
	}


	/**
	* Run a function on all state config keys, potencially mutating the key / value
	* If the function returns a tuple array its assumed to mutate the key+val of the input config key+val combo
	* If the function returns a object, that object return (all keys) replace the state for that config key
	* If the function returns boolean `false` the key is removed completely
	* If the funciton returns boolean `true` OR undefined, no action or mutation is taken
	* @param {Function} func Function, called as `([key, val])`, see above for possible returns
	* @returns {DotEnv} This chainable instance
	*/
	map(func, options) {
		let settings = {
			depth: this.#deep,
			...options,
		};

		let worker = (obj, currentDepth = 1) => Object.fromEntries(
			Object.entries(obj)
				.map(([key, val]) => {
					if (typeof val == 'object' && currentDepth < settings.depth - 1) { // Traverse into function?
						return [
							func.call(this, [key, val])[0], // FIXME: I'm sure there is something wrong with this
							worker(val, currentDepth + 1),
						];
					}

					let res = func.call(this, [key, val]);
					if (res === false) { // Got Boolean false - filter out
						return false;
					} else if (Array.isArray(res)) { // Got Array tuple - replace inline
						if (res.length > 2) throw new Error('map() function return can only be a tuple - an array of [key, val]');
						return res;
					} else if (typeof res == 'object') { // Got object - split into array key / vals to be flattened later
						return Object.entries(res);
					} else if (res === true || res === undefined) { // Got boolean true || undefined - leave alone
						return [key, val];
					} else {
						throw new Error('Unrecognised return value for map() - must be a Boolean, Array tuple, object or undefined response');
					}
				})
				.filter(Boolean) // Remove falsy
		);

		this.#state = worker(this.#state, 0);

		return this;
	}


	/**
	* Allow inline JavaScript substitutions based on an input object
	* This fixes up strings like `Hello ${name}` etc.
	* @param {Object} [context] The context object to use, defaults to state if unspecified
	* @returns {DotEnv} This chainable instance
	*/
	template(context) {
		let templateContext = context || this.#state;
		return this.map(([key, val]) => [
			key,
			typeof val == 'string'
				? template(val, templateContext)
				: val,
		]);
	}
	// }}}

	// Tree functions - .toTree() {{{
	/**
	* Split a config structure into a hierarchical tree based on various options
	* @param {Object|RegExp} [options] Options to mutate behaviour, if a RegExp is passed its assumed to populate `options.branches` if it has capture groups, otherwise `options.splitter`
	* @param {Function} [options.branches] A RegExp where each capture group denotes a branch of a tree
	* @param {Function} [options.splitter] A RegExp to split keys by a given string
	* @param {Function|RegExp} [options.rewrite] Run a given funciton (or replacement RegExp) over each extracted key segment
	* @param {String} [options.matching='remove'] Operation to execute on matching items if using `options.branches`. ENUM: 'keep', 'remove'
	* @param {String} [options.nonMatching='remove'] Operation to execute on non-matching items if using `options.branches`. ENUM: 'keep', 'remove'
	* @param {String|Array} [options.prefix] Provide an optional dotted prefix / array segments to prefix each output key
	* @param {Boolean} [options.clear=false] Start with a blank tree, if falsey will instead muatete the existing state
	* @returns {DotEnv} This chainable instance
	*/
	toTree(options) {
		if (options instanceof RegExp) { // Given a RegExp - try to determine how it should be processed
			options = /(?<!\\)\(/.test(options.toString()) // Has capture groups (that arn't escaped)
				? {branches: options}
				: {splitter: options}
		}

		let settings = {
			branches: null,
			splitter: null,
			rewrite: null,
			matching: 'remove',
			nonMatching: 'remove',
			prefix: undefined,
			clear: false,
			...options,
		};
		if (!settings.branches && !settings.splitter) throw new Error('Must specify either `branches` or `splitter` option');

		this.#state = Object.entries(this.#state)
			.reduce((tree, [key, val]) => {
				// Execute match (if its a branch) and deal with non-matching
				let regExpResult;
				if (settings.branches) {
					regExpResult = settings.branches.exec(key);
					if (!regExpResult && settings.nonMatching == 'keep') {
						tree[key] = val;
						return tree;
					} else if (regExpResult && settings.matching == 'remove') {
						delete tree[key];
					}
				} else if (settings.splitter && settings.matching == 'remove') {
					delete tree[key];
				}

				// Extract segments
				let segments =
					settings.branches && regExpResult ? Array.from(regExpResult).slice(1)
					: settings.splitter ? key.split(settings.splitter)
					: [];

				// Handle rewrites
				if (typeof settings.rewrite == 'function') {
					segments = segments.map(settings.rewrite);
				} else if (settings.rewrite instanceof RegExp) {
					segments = segments.map(key => key.replace(settings.rewrite));
				}

				// Handle prefixes
				if (settings.prefix) {
					segments = [
						...(Array.isArray(settings.prefix)
							? settings.prefix
							: settings.prefix.split(/\s*\.\s*/).filter(Boolean)
						),
						...segments,
					];
				}

				return objUtils.setPath(tree, segments, val);
			}, settings.clear ? {} : this.#state);

		return this;
	}
	// }}}

	// Utility functions: .tap() {{{
	/**
	* Run an arbitrary function passing in this DotEnv instance as the first argument and context
	* @param {Function} fn The function to run as `(dotEnv)` and `dotEnv` as the context
	* @returns {DotEnv} This chainable instance
	*/
	tap(fn) {
		fn.call(this, this);
		return this;
	}
	// }}}

	/**
	* Wrapper around export() which saves to a file path
	* @param {String} path The file path to write
	* @param {Object} [options] Additional options passed to `export()`
	* @returns {Promise} A promise which resolves when the operation has completed
	*/
	exportFile(path, options) {
		return fs.writeFile(path, this.export(options));
	}


	/**
	* Execute state against schema and return the result as a POJO
	* @returns {Object}
	*/
	value() {
		return this.#state;
	}
}


let globalDotEnv = new DotEnv();
export default globalDotEnv;
