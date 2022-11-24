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
	* @param {String|Buffer} input The input to parse
	* @param {Object} [options] Additional options for `parse()`
	* @returns {DotEnv} This chainable instance
	*/
	parse(input, options) {
		this._state = parse(input, options);
		return this;
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


	settings = {
		autoProxyize: true,
		allowMethods: ['parse', 'schema', 'value'],
	};

	proxyize() {
		return new Proxy(this, {
			apply(target, that, args) {
				console.log('APPLY', target, args);
				return this[target](...args);
			},
			get(obj, prop) {
				if (obj.settings.allowMethods.includes(prop)) {
					console.log('GET FUNC', prop);
					return obj[prop];
				}
				console.log('READ', prop, '=>', obj._state[prop], typeof obj._state[prop]);
				return obj._state[prop];
			},
			has(obj, prop) {
				console.log('HAS', prop);
				return [
					...obj.settings.allowMethods,
					...Object.keys(obj._state)
				].includes(prop);
			},
			ownKeys(obj) {
				return [
					...obj.settings.allowMethods,
					...Object.keys(obj._state)
				];
			},
		});
	}
}


let globalDotEnv = new DotEnv();
export default globalDotEnv;
