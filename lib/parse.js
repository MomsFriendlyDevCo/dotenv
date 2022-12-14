import dotenv from 'dotenv';
import fs from 'node:fs';

export let parseDefaults = {
	allowMissing: true,
}


/**
* Parse either a file path(s), string or buffers into a usable config object
* If `options` contains no-newlines and no-equals signs it is assumed to be a file path
* @param {Object|String|Buffer|Array} sources The sources to import as a path (string with no '='), paths (an array of strings) or blob data (string || buffer)
* @param {Object} [options] Additional options to mutate behaviour
* @param {String|Buffer} [options.from] Source to parse instead of a file path
* @param {String|Array<String>} [options.path] Source file(s) to parse in order (later overrides former)
* @param {Boolean} [options.allowMissing=true] Skip over missing files, if falsy will throw instead
* @returns {Object} A simple key=val config object
*/
export function parse(sources, options) {
	let settings = {
		...parseDefaults,
		...(
			Array.isArray(sources) ? {path: sources} // Given arrary - assume list of paths
			: typeof sources == 'object' ? sources // Given object - Use sources to expand settings
			: typeof sources == 'string' && !/\n|=/.test(sources) ? {path: sources} // Given single with no equals - assume path
			: {from: sources} // Everything else - assume `from`
		),
		...options,
	};

	// Settings sanity checks {{{
	if (!settings.from && !settings.path) throw new Error('Either `from` or `path` must be specified');
	// }}}

	let config; // Read in dotenv config
	if (settings.path && Array.isArray(settings.path)) { // Array of paths
		config = settings.path;
		config = Object.assign(
			{},
			...settings.path.map(path => {
				try {
					return dotenv.parse(fs.readFileSync(path))
				} catch (e) {
					if (e.code == 'ENOENT' && settings.allowMissing) return {};
					throw e;
				}
			})
		);
	} else if (settings.path) {
		config = dotenv.parse(fs.readFileSync(settings.path));
	} else {
		if (settings.from instanceof Buffer) settings.from = settings.from.toString();
		config = dotenv.parse(settings.from);
	}

	return config;
}
