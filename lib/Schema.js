import chalk from 'chalk';
import fs from 'node:fs';
import timestring from 'timestring';
import {ConfigDestruct} from '#lib/configDestruct';
import readable from '@momsfriendlydevco/readable';
import strUtils from '#lib/strUtils';
import {URL} from 'node:url';

/**
* A single object representing a fields schema
* If a non object without a `type` key is specified the structure `{type: value, required: true}` is assumed - e.g. `{thing: Boolean}` -> `{thing: {type: Boolean, required: true}}`
* All keys must be lower case
* @type {FieldSchema}
* @property {Boolean} [required=true] Whether the field is required
* @property {Array<*>|*} [type] Either a instance of class the object (lookup table via `aliases`) or the string representation of any key in `types`
* @property {*} [default] Default value to use if none is specified. If a function it is run as `(fieldSchema)` and the result used.
* @property {*} [defaultRaw] Default value to use without attempting evaluate functions or perform any casting if its a string. Set this as the default and don't ask any questions
* @property {function|String} [validate] Function to validate an input, must return true. If a string is given the cast function is retrieved from the type instead. Called as `(value, fieldSchema)`
* @property {Function|String} [describe] How to describe the field validation, if omitted the type will try to describe itself based on its criteria
* @property {Function|String} [cast] Optional function to convert user input to a native type. If a string is given the validate is retrieved from that type instead. Called as `(value, fieldSchema)` and expected to either throw or return falsy - undefined is ignored
* @property {Function|String} [uncast] Optional function to convert the already-casted object back into a simple string - used by `export()`
* @property {Object|String|Date} [destruct] Optional destruction config. See `ConfigDestruct` for details
*/


/**
* Schema class
* @param {Object} fields Default field specification of a DotEnv file
*/
export class Schema {
	/**
	* Options to mutate how schema behaves
	* @type {Object} Object of options
	* @property {Boolean} [reject=true] Whether to reject non-defined field data
	*/
	options = {
		reject: true,
	};


	/**
	* Known types supported when parsing schemas
	* @type {Object}
	* @property {*} [*...] Additional keys to merge
	*/
	types = {
		// Supported native types {{{
		'any': {
			/**
			* Any value at all
			* No casting is done on this so it will appear as a string
			*/
		},
		'array': {
			/**
			* List of items, usually in CSV format
			* @property {Number} [min] Minimum allowed array size
			* @property {Number} [max] Maximum allowed array size
			* @property {String|RegExp} [split='csv'] Split method alias or a RegExp, can be any key in splitMethods
			* @property {String} [join=', '] Join string to use if the split method is unrecognised
			*/
			split: 'csv',
			splitMethods: {
				csv: {re: /\s*,\s*/, join: ', ', title: 'CSV'},
				nonAlpha: {re: /[^\w]+/, join: ', ', title: 'Non-alpha split string'},
				nonAlphaNumeric: {re: /[^\W]+/, join: ', ', title: 'Non-alpha-numeric split string'},
				nonNumeric: {re: /[^\d]+/, join: ', ', title: 'Non-numeric split string'},
				whitespace: {re: /\s+/, join: ' ', title: 'Whitespace split string'},
			},
			join: ', ',
			cast: (v, field) => v
				? (''+v)
					.split(
						v instanceof RegExp ? field.split
						: field.splitMethods[field.split] ? field.splitMethods[field.split].re
						: /\s*,\s*/
					)
				: [],
			uncast: (v, field) => v
				.join(
					v instanceof RegExp ? field.join
					: field.splitMethods[field.split] ? field.splitMethods[field.split].join
					: field.join
				),
			describe: field => strUtils.filteredJoin([
				field.splitMethods?.[field.split] || 'Split string',
				'of',
				field.min !== undefined && field.max !== undefined ? `${field.min} to ${field.max}`
					: field.min ? `at least ${field.min}`
					: field.min ? `at most ${field.max}`
					: null,
				'strings',
			]),
			validate: (v, field) => {
				if (!Array.isArray(v)) throw 'Not an array';
				if (field.min !== undefined && v.length < field.min) throw `Below minimum value of "${field.min}"`;
				if (field.max !== undefined && v.length > field.max) throw `Above maximum value of "${field.max}"`;
			},
		},
		'boolean': {
			/**
			* Boolean value parsed from strings
			* @property {Array<String>|Set<String>} [true] List of acceptable true values
			* @property {Array<String>|Set<String>} [false] List of acceptable false values
			*/
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
				: field.false.values().next().value,
			describe: 'Boolean yes/no',
		},
		'date': {
			/**
			* ISO compatible date (or Date() parsable date)
			* @property {Date|Number} [min] Lowest possible value for the date
			* @property {Date|Number} [max] Highest possible value for the date
			*/
			cast: v => new Date(v),
			uncast: v => v.toISOString(),
			describe: field => strUtils.filteredJoin([
				'ISO parsable date/date+time',
				field.min !== undefined && field.max !== undefined ? `with a range of ${field.min} to ${field.max}`
					: field.min ? `starting at ${field.min}`
					: field.min ? `ending at ${field.max}`
					: null,
			]),
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
			* @property {string} [unit='ms'] Unit to parse to
			*/
			unit: 'ms',
			cast: (v, field) => timestring(v, field.unit),
			uncast: v => readable.relativeTime(v),
			describe: 'Timestring compatible duration',
		},
		'email': { // Single email
			/**
			* Alias for a "emails" but restricted to `{min: 1, max: 1}`
			* @see emails
			*/
			// @property {boolean} [name=true] Support the `A <a@server.com>` format as well as `a@server.com` format
			cast: 'string',
			name: true,
			describe: 'Email address',
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
			describe: field => strUtils.filteredJoin([
				'CSV of',
				field.min !== undefined && field.max !== undefined ? `${field.min} to ${field.max}`
					: field.min ? `at least ${field.min}`
					: field.min ? `at most ${field.max}`
					: null,
				'email address' + (field.max !== 1 ? 'es' : ''),
			]),
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
		'file': {
			/**
			* Read in a path from disk
			* @property {Boolean} [buffer=true] Read in contents to a buffer as the value
			* @property {Boolean} [string=false] Read in contents to a string as the value
			*/
			cast: (v, field) => fs.readFileSync(v, field.string ? 'utf-8' : null),
			describe: ()=> 'Path to a file on disk',
		},
		'float': {
			/**
			* Shorthand function for JavaScript numbers + `{float: true}`
			* @alias Number
			*/
			cast: v => parseFloat(v),
			describe: field => strUtils.filteredJoin([
				'Number',
				field.min !== undefined && field.max !== undefined ? `in the range ${field.min} to ${field.max}`
					: field.min !== undefined ? `with a minimum of ${field.min}`
					: field.max !== undefined ? `with a maximum of ${field.max}`
					: null,
				'with optional decimal places',
			]),
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
			* If no value portion is specified (e.g. `key, key2`) noValue is used as the value instead
			* @property {Number} [min] Minimum number of allowed keys
			* @property {Number} [max] Maximum number of allowed keys
			* @property {*} [noValue] If set, determines the value to set if no value is provided
			*/
			noValue: false, // Value to associate if no value portion is given, if `false`, throw an error
			cast: (v, field) => v.split(/\s*,\s*/)
				.filter(Boolean) // Remove duds
				.reduce((obj, expr) => {
					let {key, val} = /^\s*(?<key>.+)[:=]\s*(?<val>.*$)/.exec(expr)?.groups ?? [];
					if (!key) { // No value items
						if (field.noValue === false) throw new Error(`Invalid object format for "${v}" expected in format "key1:val, key2:val" etc.`);
						[key, val] = [expr, field.noValue];
					}

					obj[key] = val;
					return obj;
				}, {}),
			uncast: v => Object.entries(v)
				.map(([key, val]) => `${key}=${val}`)
				.join(', '),
			describe: field => strUtils.filteredJoin([
				'Object made up of a CSV',
				field.min !== undefined && field.max !== undefined ? `with between ${field.min} and ${field.max}`
					: field.min !== undefined ? `with a minimum of ${field.min}`
					: field.max !== undefined ? `with a maximum of ${field.max}`
					: 'of',
				'key/vals',
			]),
			validate: (v, field) => {
				if (typeof v != 'object') throw 'Must be an object';
				if (field.min !== undefined && Object.keys(v).length < field.min) throw `Below minimum number of keys "${field.min}"`;
				if (field.max !== undefined && Object.keys(v).length > field.max) throw `Above maximum number of keys "${field.max}"`;
			},
		},
		'mongouri': {
			/**
			* A MongoDB compatible URI
			*/
			parse: false,
			cast: 'uri',
			uncast: 'uri',
			describe: 'MongoDB compatible URI',
			validate: v => {
				if (!/^mongodb(?:\+srv)?:\/\//.test(v)) throw 'URI must begin with "mongodb://" or "mongodb+srv://"';
			},
		},
		'number': {
			/**
			* Simple integer with no decimal places
			* @property {boolean} [float=false] Parse number as floating-point rather than integer
			* @property {Number} [min] Minimum allowed value
			* @property {Number} [max] Maximum allowed value
			*/
			float: false,
			cast: (v, field) => field.float ? parseFloat(v) : parseInt(v),
			describe: field => strUtils.filteredJoin([
				'Number',
				field.min !== undefined && field.max !== undefined ? `in the range ${field.min} to ${field.max}`
					: field.min !== undefined ? `with a minimum of ${field.min}`
					: field.max !== undefined ? `with a maximum of ${field.max}`
					: null,
				field.float && 'with optional decimal places',
			]),
			validate: (v, field) => {
				if (!v && !field.required) return;
				if (isNaN(v)) throw 'Number is invalid';
				if (!isFinite(v)) throw 'Number must be finite';
				if (field.min !== undefined && v < field.min) throw `Below minimum value of "${field.min}"`;
				if (field.max !== undefined && v > field.max) throw `Above maximum value of "${field.max}"`;
			},
		},
		'object': { // Form: `key1=val1, key2=val2, ...`
			cast: 'keyvals',
			uncast: 'keyvals',
			describe: field => strUtils.filteredJoin([
				'Object made up of a CSV',
				field.min !== undefined && field.max !== undefined ? `with between ${field.min} and ${field.max}`
					: field.min !== undefined ? `with a minimum of ${field.min}`
					: field.max !== undefined ? `with a maximum of ${field.max}`
					: null,
				'key/vals',
			]),
			validate: v => typeof v == 'object',
		},
		'percent': { // Form: key=10%
			/**
			* Integer (or float) absolute percentage as an abolute number (the form `0-100`) without the optional '%' suffix
			* @property {Boolean} [float=false] Parse the number as floating point instead of an integer
			* @property {Number} [min] Minimum allowed value
			* @property {Number} [max] Maximum allowed value
			*/
			float: false,
			cast: (v, field) =>
				(field.float ? parseFloat : parseInt)(
					v.replace(/\s*%/, '')
				),
			validate: 'number',
		},
		'regexp': {
			/**
			* RegExp parsed from a string
			* @property {Boolean} [escape=false] Whether to escape the entire RegExp - treating it as a glob
			* @property {Boolean} [surrounds=true] Insist that RegExp fields begin and end with slashes i.e. `/field/flags'`
			* @property {Boolean} [acceptPlain=false] If the string is not wrapped in slashes an escaped plaintext string matcher instead (requires `{surrounds:true}`)
			* @property {String} [plainPrefix=''] Prefix to add to any non-surrounded RegExp while being parsed
			* @property {String} [plainSuffix=''] Suffix to add to any non-surrounded RegExp while being parsed
			* @property {String} [flags=''] RegExp flags to assume. If `surrounds=true` these are determined from the expression
			*/
			escape: false,
			surrounds: true,
			acceptPlain: false,
			plainPrefix: '',
			plainSuffix: '',
			flags: '',
			cast: (v, field) => {
				if (field.acceptPlain && !field.surrounds) throw new Error('`{acceptPlain: true}` also requires `{surrounds: true}`');
				let junk, extractedFlags;
				if (field.surrounds) {
					let hasSurrounds = /^\/.*\/\w*?$/.test(v);
					if (!hasSurrounds && field.acceptPlain) {
						return new RegExp(
							field.plainPrefix
							+ strUtils.regExpEscape(v)
							+ field.plainSuffix
						, field.flags);
					} else if (!hasSurrounds) {
						throw new Error(`RegExp must be enclosed in "/slashes/[optional-flags]" got "${v}"`);
					}
					// eslint-disable-next-line no-unused-vars
					[junk, v, extractedFlags] = /^\/(.+)\/(.*)$/.exec(v); // Remove outer slashes
				}
				return new RegExp(field.escape
					? strUtils.regExpEscape(v)
					: v
				, extractedFlags ?? field.flags);
			},
			describe: 'RegExp string',
		},
		'set': {
			/**
			* A Set instance using a CSV input
			* @property {Number} [min] Minimum allowed value
			* @property {Number} [max] Maximum allowed value
			*/
			cast: v => new Set(v ? (''+v).split(/\s*,\s*/) : []),
			uncast: v => Array.from(v).join(', '),
			describe: field => strUtils.filteredJoin([
				'CSV of strings constituting Set',
				field.min !== undefined && field.max !== undefined ? `with between ${field.min} and ${field.max}`
					: field.min !== undefined ? `with a minimum of ${field.min}`
					: field.max !== undefined ? `with a maximum of ${field.max}`
					: 'of',
				'items',
			]),
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
			describe: field => strUtils.filteredJoin([
				'String',
				field.min !== undefined && field.max !== undefined ? `with a length between ${field.min} and ${field.max}`
					: field.min !== undefined ? `with a minimum length of ${field.min}`
					: field.max !== undefined ? `with a maximum length of ${field.max}`
					: false,
			]),
			validate: (v, field) => {
				if (typeof v != 'string') throw 'Must be a string';
				if (field.enum && !field.enum.includes(v)) throw `Must be one of: ${field.enum.map(v => '"' + v + '"').join(', ')}`;
				if (field.min !== undefined && v.length < field.min) throw `Below minimum length of "${field.min}"`;
				if (field.max !== undefined && v.length > field.max) throw `Above maximum length of "${field.max}"`;
			},
		},
		'style': {
			cast: v => v
				.split(/[+,\s]+/)
				.filter(Boolean)
				.reduce((styler, rawSegment) => {
					let segment = rawSegment
						.toLowerCase()
						.replace(/\bbg(.+?)/g, (junk, bgColor) => 'bg' + bgColor[0].toUpperCase() + bgColor.substr(1)) // Tidy up bgwhite -> bgWhite
						.replace(/\bfg/g, '') // Remove 'fg' prefixes

					if (!styler[segment]) throw new Error(`Chalk does not support style "${segment}"`);
					return styler[segment];
				}, chalk),
			describe: 'Combination of console styles',
		},
		'uri': {
			/**
			* A URI/URL string
			* @property {Boolean} [parse=false] If true return the `URL` object rather than the input string
			*/
			parse: false,
			cast: (v, field) => field.parse
				? new URL(v)
				: v,
			uncast: v => v.toString(),
			describe: 'Parsable URI',
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
		if (fieldSchema.defaultRaw !== undefined) { // Use raw default - don't try to eval / cast it
			return fieldSchema.defaultRaw;
		} else if (
			fieldSchema.default !== undefined
			&& (val === undefined || val === '') // Unset OR has a blank string value
		) {
			let defaultVal = typeof fieldSchema.default == 'function' // Flatten default function into a scalar before we do anything else
				? fieldSchema.default(fieldSchema) // Default is a function which returns something
				: fieldSchema.default;

			if (typeof defaultVal == 'string') { // Got a string back - assume this is the same as setting the value in the .env file
				val = defaultVal;
			} else { // Got something weird like a direct set of a value post-processing - assume the default is pristine and abort all further checks
				return defaultVal;
			}
		}

		// .required
		if (
			!fieldSchema.required
			&& (val === undefined || val === '') // Unset OR has a blank string value
		) { // No value but thats allowed anyway - don't try to cast or go any further
			return undefined;
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

		// .required #2 (post casting)
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
		// Compile schema'd fields into a entry array {{{
		let schemaFields = Object.fromEntries(
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
		);
		// }}}

		/**
		* Return a proxy object which executes `.toConfig()` on any lookup key it finds
		* Sub-keys like ConfigDestruct return this and handle inner value destuction automatically
		*/
		return new Proxy({
			...(!this.options.reject ? config : {}), // Start with original values if we're not rejecting
			...schemaFields, // Then overwrite with schema'd values
		}, {
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
	* @param {Object} [options] Additional options to mutate behaviour
	*/
	constructor(schema, options) {
		if (schema) this.fields = schema;
		if (options) Object.assign(this.options, options);
	}
}
