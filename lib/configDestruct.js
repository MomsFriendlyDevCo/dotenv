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

		if (!this.#destructed && now >= this.#destructDate) this.destruct(); // Destruct if past destruction date

		return typeof this.#value == 'function' ? this.#value() : this.#value;
	}


	/**
	* Indicator if the config value has already been destructed
	* @type {Boolean}
	*/
	#destructed = false;


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
	#destructValue;


	/**
	* Simple setter for the default value
	* @param {*} value The value to set
	* @returns {ConfigDestruct} This chainable object
	*/
	setValue(value) {
		if (this.#destructed) throw new Error('Cannot use setValue() after value has been destructed');
		this.#value = value;
		return this;
	}


	/**
	* Set when the value should be destructed
	* @param {string|Date} time Either a timestring() compatible duration a Date() instance
	* @returns {ConfigDestruct} This chainable object
	*/
	setDestruct(time) {
		if (this.#destructed) {
			throw new Error('Config set destruction date after value has already been destructed');
		} else if (typeof time == 'string') { // Assume duration
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
		return this;
	}


	/**
	* Trigger the desruction
	* This function is called if trying to access the value after the destroy date OR if the destruct timeout triggers OR manually
	* @returns {ConfigDestruct} This chainable object
	*/
	destruct() {
		// Clear any existing timers
		if (this.#tickHandle) clearTimeout(this.#tickHandle);

		this.#value = this.#destructValue;
		this.#destructed = true;
		return this;
	}


	// Timer functionality {{{

	/**
	* The interval to re-check if the data should be erased
	* Set to '0' to disable
	* @type {number} Interval in milliseconds
	*/
	#tickInterval = 500;


	/**
	* The current timer handle, if we have one
	* @type {Object}
	*/
	#tickHandle;


	/**
	* Tick and check the value hasn't expired
	* If not, reschedule in #tickInterval to check again
	* @returns {ConfigDestruct} This chainable object
	*/
	timerTick() {
		if (this.#tickHandle) clearTimeout(this.#tickHandle); // Clear any existing timers if we're being called manually
		if ((new Date) >= this.#destructDate) this.destruct(); // Destruct if past destruction date
		if (!this.#destructed) setTimeout(this.timerTick.bind(this), this.#tickInterval);
		return this;
	}


	/**
	* Either start the timer if its stopped or reset if it is already running
	* @param {string|number} [time] Optional setter for `tickInterval` as a timestring duration or millisecond value
	* @returns {ConfigDestruct} This chainable object
	*/
	timerRestart(duration) {
		if (this.#destructed) throw new Error('Cannot start timer - Config value has already been destructed');

		if (duration) {
			this.#tickInterval = typeof duration == 'number'
				? duration
				: timestring(duration)
		}

		if (this.#tickInterval > 0) {
			if (this.#tickHandle) clearTimeout(this.#tickHandle);
			this.#tickHandle = setTimeout(this.timerTick.bind(this), this.#tickInterval)
		}
	}
	// }}}


	/**
	* COnstructor to create a ConfigDestruct instance
	* @param {*} value The value of this branch
	* @param {Object|string|Date} config Either a config object or a timestring-duration/Date to call `setDestruct()` with
	* @param {*} config.value The value to set
	* @param {string|Date} [config.at='1m'] The destruction timestring or a Date object on when to destruct the value
	* @param {string|number} [config.tick=500] Timestring duration or millisecond value to check the value is still valid before purging it from memory
	* @param {*} [config.destructValue] The value (or function) to return (or run) if the value is destroyed
	*/
	constructor(value, config) {
		let settings = {
			value,
			at: '1m',
			destructValue: ()=> { throw new Error('Config value not available after application boot') },
			tick: 500,
			...(typeof config == 'string' || config instanceof Date // Either merge config if its an object or just use it as the `at` key if its a string/Date
				? {at: config}
				: config
			),
		};

		this
			.setValue(settings.value)
			.setDestruct(settings.at)
			.setDestructValue(settings.destructValue)
			.timerRestart(settings.tick)
	}
}
