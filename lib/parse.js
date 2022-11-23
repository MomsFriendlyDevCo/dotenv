import dotenv from 'dotenv';
import fs from 'node:fs';

export let parseDefaults = {
}


/**
* Parse either a file path(s), string or buffers into a usable config object
* If `options` contains no-newlines and no-equals signs it is assumed to be a file path
* @param {Object|String|Buffer} options an options object or the default populate for `options.from`
* @param {String|Buffer} [options.from] Source to parse instead of a file path
*/
export function parse(options) {
	let settings = {
		...parseDefaults,
		...(
			typeof options == 'object' ? options // Given object - Use options to expand settings
			: typeof options == 'string' && !/\n|=/.test(options) ? {path: options} // Given single line with no equals - assume path
			: {from: options} // Everything else - assume `from`
		),
	};

	// Settings sanity checks {{{
	if (!settings.from && !settings.path) throw new Error('Either `from` or `path` must be specified');
	// }}}

	let config; // Read in dotenv config
	if (settings.path) {
		config = dotenv.parse(fs.readFileSync(settings.path));
	} else {
		if (settings.from instanceof Buffer) settings.from = settings.from.toString();
		config = dotenv.parse(settings.from);
	}

	return config;
}
