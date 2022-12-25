import timestring from 'timestring';
import {ConfigDestruct} from '#lib/configDestruct';
import readable from '@momsfriendlydevco/readable';
import {URL} from 'node:url';

/**
* A single object representing a fields schema
* If a non object without a `type` key is specified the structure `{type: value, required: true}` is assumed - e.g. `{thing: Boolean}` -> `{thing: {type: Boolean, required: true}}`
* All keys must be lower case
* @type {FieldSchema}
* @property {boolean} [required=true] Whether the field is required
* @property {Array<*>|*} [type] Either a instance of class the object (lookup table via `aliases`) or the string representation of any key in `types`
* @property {*} [default] Default value to use if none is specified. If a function it is run as `(fieldSchema)` and the result used.
* @property {function|string} [validate] Function to validate an input, must return true. If a string is given the cast function is retrieved from the type instead. Called as `(value, fieldSchema)`
* @property {function|string} [cast] Optional function to convert user input to a native type. If a string is given the validate is retrieved from that type instead. Called as `(value, fieldSchema)` and expected to either throw or return falsy - undefined is ignored
* @property {function|string} [uncast] Optional function to convert the already-casted object back into a simple string - used by `export()`
* @property {Object|string|Date} [destruct] Optional destruction config. See `ConfigDestruct` for details
*/


/**
* Schema class
* @param {Object} fields Default field specification of a DotEnv file
*/
export class Schema {
	/**
	* Known types supported when parsing schemas
	* @type {Object}
	* @property {*} [*...] Additional keys to merge
	*/
	types = {
		// Supported native types {{{
		'any': {
		},
		'array': {
			// @property {Number} [min] Minimum allowed array size
			// @property {Number} [max] Maximum allowed array size
			cast: v => v ? (''+v).split(/\s*,\s*/) : [],
			uncast: v => v.join(', '),
			validate: (v, field) => {
				if (!Array.isArray(v)) throw 'Not an array';
				if (field.min !== undefined && v.length < field.min) throw `Below minimum value of "${field.min}"`;
				if (field.max !== undefined && v.length > field.max) throw `Above maximum value of "${field.max}"`;
			},
		},
		'boolean': {
			true: new Set(['true', 'yes', '1', 'on']),
			false: new Set(['false', 'no', '0', 'off']),
			cast: (v, field) => {
				if (!(field.true instanceof Set)) field.true = new Set(field.true);
				if (!(field.false instanceof Set)) field.false = new Set(field.false);

				if (field.true.has(v)) {
					return true;
				} else if (field.false.has(v)) {
					return false;
				} else {
					throw new Error(`Not a valid true/false response "${v}". Valid: ` +
						Array.from([...field.true, ...field.false]).map(v => `"${v}"`).join(', ')
					);
				}
			},
			uncast: (v, field) => v
				? field.true.values().next().value // Assume first entry to TRUE values is the string output
				: field.false.values().next().value
		},
		'date': {
			cast: v => new Date(v),
			uncast: v => v.toISOString(),
			validate: (v, field) => {
				if (!(v instanceof Date)) throw 'Must be a date object or something that parses to one';
				if (!isFinite(v.getTime())) throw 'Date must be finite';
				if (field.min !== undefined && v < field.min) throw `Below minimum date of "${field.min}"`;
				if (field.max !== undefined && v > field.max) throw `Above maximum date of "${field.max}"`;
			},
		},
		'duration': {
			/**
			* Parse a valid timestring into JavaScript millisecondsd
			* @param {string} [unit='ms'] Unit to parse to
			*/
			unit: 'ms',
			cast: (v, field) => timestring(v, field.unit),
			uncast: v => readable.relativeTime(v),
		},
		'email': { // Single email
			/**
			* Alias for a "emails" but restricted to `{min: 1, max: 1}`
			* @see emails
			*/
			// @property {boolean} [name=true] Support the `A <a@server.com>` format as well as `a@server.com` format
			cast: 'string',
			name: true,
			validate(v, field) {
				return this.types.emails.validate(v, {
					...field,
					min: 1,
					max: 1,
				});
			},
		},
		'emails': { // One or more emails in the
			/**
			* A CSV of multiple email addresses in the format `A <a@server.com>, B <b@server.com>` format
			* @property {Number} [min] Minimum number of allowed emails
			* @property {Number} [max] Maximum number of allowed emails
			*/
			cast: 'string',
			uncast: v => v.join(', '),
			name: true,
			validate: function(v, field) {
				let emails = (''+v).split(/\s*,\s*/);
				if (field.min !== undefined && emails.length < field.min) throw `Minimum number of emails is ${field.min}`;
				if (field.max !== undefined && emails.length > field.max) throw `Maximum number of emails is ${field.min}`;
				return emails
					.every(v =>
						/^(?<prefix>.+?)@(?<server>.+)$/.test(v)
						|| (field.name && /^(?<name>.+)\s+<(?<prefix>.+?)@(?<server>.+)>$/.test(v))
					);
			},
		},
		'float': {
			/**
			* Shorthand function for JavaScript numbers + `{float: true}`
			* @alias Number
			*/
			cast: v => parseFloat(v),
			validate: function(v, field) {
				return this.types.number.validate(v, {
					...field,
					float: true,
				})
			},
		},
		'keyvals': {
			/**
			* Multiple key=vals as an object
			* e.g. `key1=val1, key2=val2...`
			* @property {Number} [min] Minimum number of allowed keys
			* @property {Number} [max] Maximum number of allowed keys
			*/
			cast: v => v.split(/\s*,\s*/)
				.reduce((obj, expr) => {
					let {key, val} = /^\s*(?<key>.+[:=])\s*(?<val>.*$)/.exec(expr)?.groups ?? [];
					if (!key) throw new Error(`Invalid object format for "${v}" expected in format "key1:val, key2:val" etc.`);
					obj[key] = val;
					return obj;
				}, {}),
			uncast: v => Object.entries(v)
				.map(([key, val]) => `${key}=${val}`)
				.join(', '),
			validate: (v, field) => {
				if (typeof v != 'object') throw 'Must be an object';
				if (field.min !== undefined && Object.keys(v).length < field.min) throw `Below minimum number of keys "${field.min}"`;
				if (field.max !== undefined && Object.keys(v).length > field.max) throw `Above maximum number of keys "${field.max}"`;
			},
		},
		'mongouri': {
			cast: 'string',
			validate: v => {
				if (!v.startsWith('mongodb+srv://')) throw 'URI must begin with "mongodb+srv://"';
			},
		},
		'number': {
			/**
			* Simple integer with no decimal places
			* @property {boolean} [float=false] Parse number as floating-point rather than integer
			* @property {Number} [min] Minimum allowed value
			* @property {Number} [max] Maximum allowed value
			*/
			cast: (v, field) => field.float ? parseFloat(v) : parseInt(v),
			validate: (v, field) => {
				if (isNaN(v)) throw 'Number is invalid';
				if (!isFinite(v)) throw 'Number must be finite';
				if (field.min !== undefined && v < field.min) throw `Below minimum value of "${field.min}"`;
				if (field.max !== undefined && v > field.max) throw `Above maximum value of "${field.max}"`;
			},
		},
		'object': { // Form: `key1=val1, key2=val2, ...`
			cast: 'keyvals',
			uncast: 'keyvals',
			validate: v => typeof v == 'object',
		},
		'regexp': {
			/**
			* RegExp from string
			* @property {Boolean} [escape=false] Whether to escape the entire RegExp - treating it as a glob
			* @property {Boolean} [enforceSlashes=true] Insist that RegExp fields begin and end with slashes i.e. `/field/flags'`
			* @property {String} [flags=''] RegExp flags to assume. If `enforceSlashes=true` these are determined from the expression
			*/
			escape: false,
			enforceSlashes: true,
			flags: '',
			cast: (v, field) => {
				let junk, extractedFlags;
				if (field.enforceSlashes) {
					if (!/^\/.*\/$/.test(v)) throw new Error('RegExp must be enclsoed in /slashes/flags');
					[junk, v, extractedFlags] = /^\/(.+)\/(.*)$/.exec(v); // Remove outer slashes
				}
				return new RegExp(field.escape
					? strUtils.regExpEscape(v)
					: v
				, extractedFlags ?? field.flags);
			},
		},
		'set': {
			/**
			* A Set instance using a CSV input
			* @property {Number} [min] Minimum allowed value
			* @property {Number} [max] Maximum allowed value
			*/
			cast: v => new Set(v ? (''+v).split(/\s*,\s*/) : []),
			uncast: v => Array.from(v).join(', '),
			validate: (v, field) => {
				if (!(v instanceof Set)) throw 'Must be a set';
				if (field.min !== undefined && v.size < field.min) throw `Below minimum set size of "${field.min}"`;
				if (field.max !== undefined && v.size > field.max) throw `Above maximum set size of "${field.max}"`;
			},
		},
		'string': {
			/**
			* Simple JavaScript string type
			* @property {Array<string>} [enum] List of valid values
			* @property {Number} [min] Minimum allowed array size
			* @property {Number} [max] Maximum allowed array size
			*/
			cast: v => ''+v,
			validate: (v, field) => {
				if (typeof v != 'string') throw 'Must be a string';
				if (field.enum && !field.enum.includes(v)) throw `Must be one of: ${field.enum.map(v => '"' + v + '"').join(', ')}`;
				if (field.min !== undefined && v.length < field.min) throw `Below minimum length of "${field.min}"`;
				if (field.max !== undefined && v.length > field.max) throw `Above maximum length of "${field.max}"`;
			},
		},
		'uri': {
			cast: 'string',
			uncast: v => v.toString(),
			validate: v => new URL(v),
		},
		// }}}
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
		.set(Set, 'set')
		.set(RegExp, 'regexp')


	/**
	* Object mapping for all schema items within an object
	* @type {Object}
	* @property {*} {FieldSchema}
	*/
	fields = {};


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
	* Process a raw field spec into a schema object
	* This is the precursor to processing with applyField()
	* @param {String|Object} rawFieldSchema The field schema to process
	* @returns {FieldSchema} The properly formatted FieldSchema object
	*/
	getFieldSchema(rawFieldSchema) {
		// Calculate base object template `{type: String, ...defaults}` {{{
		let fieldSchema =
			typeof rawFieldSchema == 'string' ? { // Entire field is a string lookup
				...this.defaultFields.hasType,
				type: rawFieldSchema.toLowerCase(),
			}
			: typeof rawFieldSchema?.type == 'string' ? { // {type: String} lookup
				...this.defaultFields.hasType,
				...rawFieldSchema,
				type: rawFieldSchema.type.toLowerCase(),
			}
			: this.aliases.has(rawFieldSchema) ? { // Form: `{[path]: SCALAR}`
				...this.defaultFields.hasType,
				type: this.aliases.get(rawFieldSchema),
			}
			: this.aliases.has(rawFieldSchema.type) ? { // Form: `{[path]: {type: SCALAR, ...}}`
				...this.defaultFields.hasType,
				...rawFieldSchema,
				type: this.aliases.get(rawFieldSchema.type),
			}
			: rawFieldSchema.type ? { // Form: `{[path]: {type: STRING, ...}}`
				...this.defaultFields.hasType,
				...rawFieldSchema,
			}
			: typeof rawFieldSchema == 'object' ? { // Form: Generic typeless POJO
				...this.defaultFields.noType,
				...rawFieldSchema,
			}
			: (()=> { throw new Error(`Unknown field type`) })();
		// }}}

		// Inherit from type
		if (!this.types[fieldSchema.type]) throw new Error(`Invalid schema type "${fieldSchema.type}"`);

		return {
			...this.types[fieldSchema.type],
			...fieldSchema,
		};
	}


	/**
	* Apply a given fieldSchema to a value
	* @param {*} val The value to apply to
	* @param {Object} parent Parent object (if any), used to attach `destruct` events
	* @param {FieldSchema} rawFieldSchema The field schema to apply
	* @returns {*} The field value after the schema has been applied
	*/
	applyField(val, rawFieldSchema) {
		let fieldSchema = this.getFieldSchema(rawFieldSchema);

		// .default
		if (fieldSchema.default !== undefined && val === undefined) {
			val = typeof fieldSchema.default == 'function'
				? fieldSchema.default(fieldSchema)
				: fieldSchema.default;
		}

		// .cast
		if (fieldSchema.cast && typeof val == 'string') {
			let castFunc = fieldSchema.cast; // Actual cast function to run the cast against
			// Is .cast a pointer to elsewhere? {{{
			if (typeof fieldSchema.cast == 'string') {
				if (!this.types[fieldSchema.cast]) throw new Error(`Cast pointer to "${fieldSchema.cast}" does not exist`);
				if (typeof this.types[fieldSchema.cast].cast == 'string') throw new Error(`Cast pointer to "${fieldSchema.cast}" is itself a string pointer - point to the original instead!`);
				castFunc = this.types[fieldSchema.cast].cast;
			} // Implied else - use the fields own cast
			// }}}

			try {
				val = castFunc.call(this, val, {
					...this.types[fieldSchema.cast],
					...fieldSchema,
				})
			} catch (e) {
				throw new Error(`Failed to cast: ${e.toString()}`, {cause: e});
			}
		}

		// .required
		if (fieldSchema.required && val === undefined) throw new Error(`Value required`);

		// .validate || Type checking
		if (fieldSchema.validate) {
			let validateFunc = fieldSchema.validate; // Actual validation function to run the validate against
			// Is .validate a pointer to elsewhere? {{{
			if (typeof fieldSchema.validate == 'string') {
				if (!this.types[fieldSchema.validate]) throw new Error(`Validate pointer to "${fieldSchema.validate}" does not exist`);
				if (typeof this.types[fieldSchema.validate].validate == 'string') throw new Error(`Cast pointer to "${fieldSchema.validate}" is itself a string pointer - point to the original instead!`);
				validateFunc = this.types[fieldSchema.validate].validate;
			} // Implied else - use the fields own cast
			// }}}

			try {
				let result = validateFunc.call(this, val, {
					...this.types[fieldSchema.validate],
					...fieldSchema,
				})

				// Falsy but not undefined
				if (result !== undefined && !result) throw new Error('Uncategorised validation failure (validator returned falsy but not undefined)');
			} catch (e) {
				throw new Error(`Failed validation: ${e.toString()}`, {cause: e});
			}
		}

		// .destruct
		if (fieldSchema.destruct)
			val = new ConfigDestruct(val, fieldSchema.destruct);

		return val;
	}


	/**
	* Apply this schema to a given config object and return the final output
	* @param {Object} config The config object to apply this schema to
	* @returns {Object} The input config object with the applied defaults, validation and other supported functionality
	*/
	apply(config) {
		/**
		* Return a proxy object which executes `.toConfig()` on any lookup key it finds
		* Sub-keys like ConfigDestruct return this and handle inner value destuction automatically
		*/
		return new Proxy(Object.fromEntries(
			Object.entries(this.fields)
				.map(([path, rawFieldSchema]) => {
					try {
						return [
							path,
							this.applyField(config[path], rawFieldSchema),
						]
					} catch (e) {
						throw new Error(`Env '${path}': ${e.toString().replace(/^Error: /, '')}`, {cause: e});
					}
				})
		), {
			get(obj, prop) {
				let target = obj[prop];
				if (typeof target == 'object' && 'toConfig' in target) {
					return target.toConfig();
				} else {
					return obj[prop];
				}
			},
			has(obj, prop) {
				return prop in obj;
			},
			ownKeys(obj) {
				return Object.keys(obj);
			},
		});
	}


	/**
	* Create a new Schema object
	* @param {Object} [schema] Initial raw schema to populate
	*/
	constructor(schema) {
		if (schema) this.fields = schema;
	}
}
