import {parse} from '#lib/parse';
import {Schema} from '#lib/schema';

export class DotEnv {
	/**
	* Current config state, set via .parse()
	* @type {Object}
	*/
	_state = {};


	/**
	* Current schema, set via .schema()
	* @type {Schema}
	*/
	_schema;


	/**
	* Read in dotenv details either from a path, raw String or raw Buffer
	* @param {String|Buffer|Array} input The input to parse
	* @param {Object} [options] Additional options for `parse()`
	* @returns {DotEnv} This chainable instance
	*/
	parse(input, options) {
		this._state = parse(input, options);
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
			this._state[key] = value;
		} else {
			Object.assign(this._state, key);
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
		this._state = Object.assign(this._state, ...configs);
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
		this._schema = new Schema(input, options);
		this._state = this._schema.apply(this._state);
		return this;
	}


	/**
	* Execute state against schema and return the result as a POJO
	* @returns {Object}
	*/
	value() {
		return this._state;
	}
}


let globalDotEnv = new DotEnv();
export default globalDotEnv;
