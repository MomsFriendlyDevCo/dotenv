/**
* Set a deeply nested value of a complex object
* This if functionally the same as Lodash's set() function
* NOTE: The object is mutated in place
* @param {*} item The item to traverse
* @param {Array<String>|String} path An array of path segments or a dotted notation path to traverse
* @param {*} value The value to set
* @return {*} The traversed object
* @url https://github.com/MomsFriendlyDevCo/Nodash
*/
export function setPath(item, path, value) {
	return (Array.isArray(path) ? path : path.split('.'))
		.reduce((target, segment, segmentIndex, segments) => {
			if (typeof target[segment] != 'object') target[segment] = {};

			if (segmentIndex >= segments.length - 1) { // Last path segment
				target[segment] = value;
				return item;
			} else { // Mid-path section - recurse into
				return target[segment];
			}
		}, item)
}

export default {
	setPath,
}
