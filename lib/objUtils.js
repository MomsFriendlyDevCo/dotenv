/**
* Deeply clone an object
* @param {Object} obj The object to clone
* @returns {Object} A deep clone of the original object
* @see https://stackoverflow.com/a/40294058/1295040
*/
export function deepClone(obj, hash = new WeakMap()) {
	if (Object(obj) !== obj) return obj; // primitives
	if (hash.has(obj)) return hash.get(obj); // cyclic reference
	const result = obj instanceof Set ? new Set(obj) // See note about this!
		: obj instanceof Map ? new Map(Array.from(obj, ([key, val]) => [key, deepClone(val, hash)]))
		: obj instanceof Date ? new Date(obj)
		: obj instanceof RegExp ? new RegExp(obj.source, obj.flags)
		// ... add here any specific treatment for other classes ...
		// and finally a catch-all:
		: obj.constructor ? new obj.constructor()
		: Object.create(null);

	hash.set(obj, result);

	return Object.assign(result,
		...Object.keys(obj).map(
			key => ({ [key]: deepClone(obj[key], hash) })
		)
	);
}


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
			if (typeof target[segment] != 'object') {
				if (isFinite(segment)) { // Finite number - create as array
					target[segment] = [];
				} else {
					target[segment] = {};
				}
			}

			if (segmentIndex >= segments.length - 1) { // Last path segment
				target[segment] = value;
				return item;
			} else { // Mid-path section - recurse into
				return target[segment];
			}
		}, item)
}


/**
* Return if an object is any type of object
* @see https://github.com/jonschlinkert/is-plain-object>
* @param {*} o The object to examine
* @returns {Boolean} Boolean true if the given value is any type of object
*/
export function isObject(o) {
	return Object.prototype.toString.call(o) === '[object Object]';
}


/**
* Return if an object is a plain object (POJO)
* @see https://github.com/jonschlinkert/is-plain-object>
* @param {*} o The object to examine
* @returns {Boolean} Boolean true if the given value is likely a plain object
*/
export function isPlainObject(o) {
	var ctor,prot;

	if (isObject(o) === false) return false;

	// If has modified constructor
	ctor = o.constructor;
	if (ctor === undefined) return true;

	// If has modified prototype
	prot = ctor.prototype;
	if (isObject(prot) === false) return false;

	// If constructor does not have an Object-specific method
	if (prot.hasOwnProperty('isPrototypeOf') === false) { // eslint-disable-line no-prototype-builtins
		return false;
	}

	// Most likely a plain Object
	return true;
}

export default {
	deepClone,
	isObject,
	isPlainObject,
	setPath,
}
