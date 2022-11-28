import timestring from 'timestring';

export class ConfigDestruct {

	/**
	* The actual, low-level value to protect
	* This gets swapped out with `#destructValue` if the date goes beyond `#destructDate`
	* @type {*}
	*/
	#value;


	/**
	* Upstream function that gets run by DotEnv() if the instance has the method
	* Responsible here for checking the destructDate + returning value or triggering a destroy
	*/
	toConfig() {
		let now = new Date();

		if (now >= this.#destructDate) this.destruct(); // Destruct if past destruction date

		return typeof this.#value == 'function' ? this.#value() : this.#value;
	}


	/**
	* Indicator if the config value has already been destroyed
	* @type {Boolean}
	*/
	#destroyed = false;


	/**
	* Date instance of when to destroy the value
	* @type {Date}
	*/
	#destructDate;


	/**
	* The value to return after destruction
	* If this is a function - it will be run and its result used instead
	* Create a function that throws if that is the desired behaviour rather than returning a value
	* @type {*}
	*/
	#destructValue = ()=> { throw new Error('Config value not available after application boot') };


	/**
	* Set when the value should be destroyed
	* @param {string|Date} time Either a timestring() compatible duration a Date() instance
	* @returns {ConfigDestruct} This chainable object
	*/
	setDestruct(time) {
		if (typeof time == 'string') { // Assume duration
			this.#destructDate = new Date(Date.now() + timestring(time, 'ms'));
		} else if (time instanceof Date) {
			this.#destructDate = time;
		} else {
			throw new Error('Unsupported setDestruct() type. Must be a timestring() duration or Date() instance');
		}

		return this;
	}


	/**
	* Set the value (or function) to return post-destruct
	* @param {*} value The value to return post-destruction, can be a function which throws
	* @returns {ConfigDestruct} This chainable object
	*/
	setDestructValue(value) {
		this.#destructValue = value;
		this.#destroyed = true;
		return this;
	}


	/**
	* Trigger the desruction
	* This function is called if trying to access the value after the destroy date OR if the destruct timeout triggers OR manually
	* @returns {ConfigDestruct} This chainable object
	*/
	destruct() {
		this.#value = this.#destructValue;
		return this;
	}


	/**
	* COnstructor to create a ConfigDestruct instance
	* @param {*} value The value of this branch
	* @param {Object|string|date} config Either a config object or a timestring-duration/Date to call `setDestruct()` with
	*/
	constructor(value, config) {
		this.#value = value;

		if (typeof config == 'string' || config instanceof Date) {
			this.setDestruct(config);
		} else if (typeof config == 'object' && (config.after || config.at)) { // Assume object
			this.setDestruct(config.after || config.at);
			if (config.destructValue) this.setDestruct(config.destructValue);
		}
	}

}
