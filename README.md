@MomsFriendlyDevCo/DotEnv
=========================
DotEnv with schema, validation, expiring keys and multi-input support.

Features:

* All standard DotEnv parser / reader
* Mongo like Schema support
* Entirely synchronous - config is available immediately, no waiting on promises or fixing up race conditions
* Support for destructing config - wipe values like passwords or API-keys after a set interval


```javascript
import dotenv from '@momsfriendlydevco/dotenv';

let config = dotenv
    .parse('.env') // Import from one or more files in order of precidence
    .importEnv({prefix: 'MY_APP_'}) // Import from process.env
    .schema({ // Apply a schema
        port: Number, // Simple schemas (`required` is implied for these)
        host: {required: true, type: String}, // ...or be more explicit
        password: {
            type: 'string', // Custom support also for your own types
            cast: v => v.toLowerCase(), // Case incoming values
            destruct: '10s', // Variables not allowed to be read after this time from start (timestring)
        },
    })
    .value() //= {host: String, port: Number, password: String}
```


API
===


DotEnv (default export)
-----------------------
Returns an instance of the DotEnv class.


DotEnv.parse(files...)
----------------------
Read files from path (or relative to current directory) in presidence order.
Later files with keys will overwrite earlier ones.

Returns the chainable DotEnv instance.


DotEnv.importEnv(options)
-------------------------
Import environment variables (from `process.env` by default).

Returns the chainable DotEnv instance.

Valid options are:


| Option       | Type       | Default         | Description                                                                                         |
|--------------|------------|-----------------|-----------------------------------------------------------------------------------------------------|
| `source`     | `Object`   | `process.env`   | Source object to import from                                                                        |
| `prefix`     | `String`   | `''`            | Optional prefix to limit imports to                                                                 |
| `filter`     | `Function` | `(k, v)=> true` | Optional function to filter by. Called as `(key, val)`                                              |
| `replace`    | `Function` | `(k, v)=> v`    | Optional function to rewrite the value. Called as `(key, val)` and expected to return the new value |
| `trim`       | `Boolean`  | `true`          | Try to trum whitespace from variables, if any                                                       |
| `trimPrefix` | `Boolean`  | `true`          | If using a prefix, remove this from the final keys to merge                                         |


DotEnv.schema(schema, options)
------------------------------
Apply a schema to the existing internal config state.

A schema is a object mapping each key to a FieldSchema.

Returns the chainable DotEnv instance.

FieldSchemas are made up of any of the following properties. If a simple string or built-in type is provided instead it is assumed as the `type` subkey.

```
* @property {boolean} [required=true] Whether the field is required
* @property {Array<*>|*} [type] Either a instance of class the object (lookup table via `aliases`) or the string representation of any key in `types`
* @property {*} [default] Default value to use if none is specified. If a function it is run as `(fieldSchema)` and the result used.
* @property {function|string} [validate] Function to validate an input, must return true. If a string is given the cast function is retrieved from the type instead. Called as `(value, fieldSchema)`
* @property {function|string} [cast] Optional function to convert user input to a native type. If a string is given the validate is retrieved from that type instead. Called as `(value, fieldSchema)` and expected to either throw or return falsy - undefined is ignored
* @property {Object|string|Date} [destruct] Optional destruction config. See `ConfigDestruct` for details
```


| Option | Type | Default | Description |
|--------|------|---------|-------------|


FIXME: Add options


DotEnv.value()
--------------
Return the final, computed config object.


Built in types
--------------
The following is a list of built in types which provide a handy shorthand for various functionality.


FIXME: List of types
