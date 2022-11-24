import timestring from 'timestring';
import {URL} from 'node:url';

/**
* A single object representing a fields schema
* If a non object without a `type` key is specified the structure `{type: value, required: true}` is assumed - e.g. `{thing: Boolean}` -> `{thing: {type: Boolean, required: true}}`
* @type {FieldSchema}
* @property {boolean} [required=true] Whether the field is required
* @property {Array<*>|*} [type] Either a instance of class the object (lookup table via `aliases`) or the string representation of any key in `types`
* @property {*} [default] Default value to use if none is specified. If a function it is run as `(fieldSchema)` and the result used.
* @property {function} [validator] Function to validate an input, must return true. Called as `(value, fieldSchema)`
* @property {function|string} [cast] Optional function to convert user input to a native type. If a string is given the validator is retrieved from that type instead. Called as `(value, fieldSchema)`
*/


/**
* Schema class
* @param {Object} fields Default field specification of a DotEnv file
*/
export class Schema {
	/**
	* Known types supported when parsing schemas
	* @type {Object}
	* @property {*} [*] Additional keys to merge
	*/
	types = {
		'any': {
		},
		'array': {
			cast: v => v.split(/\s*,\s*/),
			validator: v => Array.isArray(v),
		},
		'boolean': {
			cast: v => ['true', 'yes', '1', 'on'].includes(v.toLowerCase()),
		},
		'date': {
			cast: v => new Date(v),
		},
		'duration': { // Transforms to time in milliseconds
			cast: v => timestring(v, 'ms'),
		},
		'float': {
			// @property {Number} [min] Minimum allowed value
			// @property {Number} [max] Maximum allowed value
			cast: v => parseFloat(v),
			validator: (v, field) =>
				isFinite(v)
				&& (field.min === undefined || v < field.min)
				&& (field.max === undefined || v < field.max),
		},
		'mongoUri': {
			cast: 'string',
			validate: v => v.startsWith('mongodb+srv://'),
		},
		'number': {
			// @property {Number} [min] Minimum allowed value
			// @property {Number} [max] Maximum allowed value
			cast: v => parseInt(v),
			validator: (v, field) =>
				isFinite(v)
				&& (field.min === undefined || v < field.min)
				&& (field.max === undefined || v < field.max),
		},
		'object': { // Form: `key1=val1, key2=val2, ...`
			cast: v => v.split(/\s*,\s*/)
				.reduce((obj, expr) => {
					let {key, val} = /^\s*(?<key>.+:)\s*(?<val>.*$)/.exec(expr)?.groups ?? [];
					if (!key) throw new Error(`Invalid object format for "${v}" expected in format "key1:val, key2:val" etc.`);
					obj[key] = val;
					return obj;
				}, {}),
			validator: v => typeof v == 'object',
		},
		'set': {
			cast: v => new Set(v.split(/\s*,\s*/)),
			validator: v => v instanceof Set,
		},
		'string': {
			// @property {Array<string>} [enum] List of valid values
			cast: v => ''+v,
			validator: (v, field) =>
				typeof v == 'string'
				&& (!field.enum || field.enum.includes(v)),
		},
		'uri': {
			cast: 'string',
			validator: v => new URL(v),
		},
	};


	/**
	* Map of native JS types to their string equivalents
	* This gets used when passing something like `{type: Boolean}` as a schema field
	* @type {Map}
	*/
	aliases = new Map()
		.set(Array, 'array')
		.set(Boolean, 'boolean')
		.set(Date, 'date')
		.set(Number, 'number')
		.set(Object, 'object')
		.set(String, 'string')
		.set(Set, 'set');


	/**
	* Object mapping for all schema items within an object
	* @type {Object}
	* @property {*} {FieldSchema}
	*/
	fields;


	/**
	* Config of a default field definitions
	* @type {Object}
	* @property {FieldSchema} noType The default schema used when no type is specified
	* @property {FieldSchema} hasType The default schema used when a type is given
	*/
	defaultFields = {
		noType:{
			type: 'any',
			required: false,
		},
		hasType:{
			required: true,
		},
	};


	/**
	* Apply a given fieldSchema to a value
	* @param {*} val The value to apply to
	* @param {Object} parent Parent object (if any), used to attach `destruct` events
	* @param {FieldSchema} rawFieldSchema The field schema to apply
	*/
	applyField(val, rawFieldSchema, parent) {
		// Calculate type + fetch real val from config object
		let fieldSchema =
			typeof rawFieldSchema == 'string' ? {...this.defaultFields.hasType, type: rawFieldSchema.toLowerCase()}
			: typeof rawFieldSchema?.type == 'string' ? {...this.defaultFields.hasType, ...rawFieldSchema, type: rawFieldSchema.type.toLowerCase()}
			: this.aliases.has(rawFieldSchema) ? {...this.defaultFields.hasType, type: this.aliases.get(rawFieldSchema),} // Form: `{[path]: SCALAR}`
			: this.aliases.has(rawFieldSchema.type) ? {...this.defaultFields.hasType, type: this.aliases.get(rawFieldSchema.type)} // Form: `{[path]: {type: SCALAR, ...}}`
			: rawFieldSchema.type ? {...this.defaultFields.hasType, ...rawFieldSchema} // Form: `{[path]: {type: STRING, ...}}`
			: typeof rawFieldSchema == 'object' ? {...this.defaultFields.noType, ...rawFieldSchema} // Form: Generic typeless POJO
			: (()=> { throw new Error(`Unknown field type`) })();

		// Inherit from type if specified
		if (this.types[fieldSchema.type]) Object.assign(fieldSchema, this.types[fieldSchema.type]);

		// Default
		if (fieldSchema.default && val === undefined)
			val = typeof fieldSchema.default == 'function' ? fieldSchema.default(fieldSchema) : fieldSchema.default;

		// Cast
		if (fieldSchema.cast)
			val = typeof fieldSchema.cast == 'string'
				? this.types[fieldSchema.cast].cast(val) // Lookup schema from other type
				: fieldSchema.cast(val, fieldSchema); // Use as is

		// Required
		if (fieldSchema.required && val === undefined) throw new Error(`Value required`);

		// Validator|| Type checking
		if (fieldSchema.validator && !fieldSchema.validator(val, fieldSchema))
			throw new Error(`Failed validation`);

		return val;
	}


	/**
	* Apply this schema to a given config object and return the final output
	* @param {Object} config The config object to apply this schema to
	* @param {Object} [parent] Parent object, used to attach dynamic handles like `destruct`
	* @returns {Object} The input config object with the applied defaults, validation and other supported functionality
	*/
	apply(config) {
		return Object.fromEntries(
			Object.entries(this.fields)
				.map(([path, rawFieldSchema], index, parent) => {
					try {
						return [
							path,
							this.applyField(config[path], rawFieldSchema, parent),
						]
					} catch (e) {
						throw new Error(`Error while parsing path '${path}': ${e.toString()}`);
					}
				})
		);
	}


	constructor(schema) {
		this.fields = schema;
	}
}
