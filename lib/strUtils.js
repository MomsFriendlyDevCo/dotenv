/**
* Simple function to escape a string so that its compatible with a RegExp
* @param {string} str The input string
* @returns {string} An escaped RegExp compatible string
* @url https://github.com/MomsFriendlyDevCo/Nodash
*/
export function regExpEscape(str) {
	return str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
}


/**
* Split a sequence of words by punctuation / spaces and uppercase first letter of each word (except the first)
* @param {String} str The input string to transform
* @returns {String} The input string in camelCase format
* @url https://github.com/MomsFriendlyDevCo/Nodash
*/
export function camelCase(str) {
	return words(str)
		.map((word, wordIndex) =>
			(wordIndex == 0 ? word[0].toLowerCase() : word[0].toUpperCase())
			+ word.substring(1).toLowerCase()
		)
		.join('');
}


/**
* Split a sequence of words by punctuation / spaces and uppercase first letter of each word
* @param {String} str The input string to transform
* @param {Boolean} [spacing=false] Whether to add spacing between words
* @returns {String} The input string in StartCase format
* @url https://github.com/MomsFriendlyDevCo/Nodash
*/
export function startCase(str, spacing=false) {
	return words(str)
		.map(word => word[0].toUpperCase() + word.substring(1).toLowerCase())
		.join(spacing ? ' ' : '');
}


/**
* Split a sequence of words by punctuation / spaces and upper case all words + seperate with underscores
* @param {String} str The input string to transform
* @returns {String} The input string in StartCase format
*/
export function envCase(str) {
	return words(str)
		.map(word => word.toUpperCase())
		.join('_');
}


/**
* Split a string into a series of words for use in other formatting functions
* @param {String} str The input string to transform
* @returns {Array<String>} String segments, where each forms a single word
*/
export function words(str) {
	return (''+str).split(/[\p{P}\p{Z}]+/u) // Split by Punctuation or Spaces
}


/**
* Join an array of strings but filter out any falsy values
* @param {Array<*>} input Input to process
* @returns {String} An array of strings concatinated together
*/
export function filteredJoin(input) {
	return input
		.filter(Boolean)
		.join(' ')
}


export let mutators = {
	camelCase,
	envCase,
	startCase,
}


export default {
	mutators,

	camelCase,
	envCase,
	filteredJoin,
	regExpEscape,
	startCase,
	words,
}
