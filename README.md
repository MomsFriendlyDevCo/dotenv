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
    .parse(['.env.example', '.env']) // Import from one or more files in order of precidence
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


DotEnv.parse(source, options)
----------------------
Read files from path (or relative to current directory) in presidence order.
Source can be a path (string with no '='), paths (an array of strings) or raw blob data (string || buffer).

Later files with keys will overwrite earlier ones.

Options are:

| Option              | Type                       | Default | Description                                               |
|---------------------|----------------------------|---------|-----------------------------------------------------------|
| `from`              | `String` / `Buffer`        |         | Source to parse instead of a file path                    |
| `path`              | `String` / `Array<String>` |         | Source file(s) to parse in order (later overrides former) |
| `allowMissing=true` | `Boolean`                  | `true`  | Skip over missing files, if falsy will throw instead      |

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
| Option          | Type                         | Default | Description                                                                                                                                                                                                                           |
|-----------------|------------------------------|---------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `required=true` | `Boolean`                    | `true`  | Whether the field is required                                                                                                                                                                                                         |
| `type`          | `Array<*>` / `*`             |         | Either a instance of class the object (lookup table via `aliases`) or the string representation of any key in `types`                                                                                                                 |
| `default`       | `*`                          |         | Default value to use if none is specified. If a function it is run as `(fieldSchema)` and the result used.                                                                                                                            |
| `validate`      | `Function` / `String`        |         | Function to validate an input, must return true. If a string is given the cast function is retrieved from the type instead. Called as `(value, fieldSchema)`                                                                          |
| `cast`          | `Function` / `String`        |         | Optional function to convert user input to a native type. If a string is given the validate is retrieved from that type instead. Called as `(value, fieldSchema)` and expected to either throw or return falsy - undefined is ignored |
| `destruct`      | `Object` / `String` / `Date` |         | Optional destruction config. See `ConfigDestruct` for details                                                                                                                                                                         |


DotEnv.value()
--------------
Return the final, computed config object.


Built in types
--------------
The following is a list of built in types which provide a handy shorthand for various functionality.


| Type       | Example                                                     | Notes                                               | Additional properties                                          |
|------------|-------------------------------------------------------------|-----------------------------------------------------|----------------------------------------------------------------|
| `any`      | `KEY=something `                                            | Any type is valid                                   |                                                                |
| `array`    | `KEY=foo,Bar, Baz`                                          | CSV of string values                                | `min` / `max` for array length                                 |
| `boolean`  | `KEY=yes` / `key=true`                                      | Parse common 'truthy' strings into a boolean        |  `true=[...]`, `false=[]` (accepted strings to validate true / false |
| `date`     | `KEY=2022-12-06` / `KEY=2022-12-06T13:20+10:00`             | Parse Date-like or ISO dates into a Date object `   | `min` / `max` for date period                                  |
| `duration` | `KEY=2h37m`                                                 | Parse a valid timestring duration into milliseconds | `unit=ms` for the unit to parse to                             |
| `email`    | `KEY=a@b.com` / `KEY=Simon Jones <simon@thing.com>`         | A single email in short or long form                | `name=true` to allow a long form address                       |
| `emails`   | `KEY=a@b.com, someone@somewhere.com, J Smith <j@smith.com>` | A CSV of email addreses                             | `name=true` to allow a long form address                       |
| `float`    | `KEY=3.1415`                                                | Any floating value                                  | `min` / `max` for value                                        |
| `keyvals`  | `KEY=key1=val1, key2 = val 2, key3=val3`                    | An object composed of key=vals                      | `min` / `max` for key count                                    |
| `mongoUri` | `KEY=mongodb+src://URL...`                                  | A valid MongoDB URI                                 |                                                                |
| `number`   | `KEY=123`                                                   | A string parsed into a number                       | `float` to accept floating values, `min` / `max` for value     |
| `object`   |                                                             | Alias for `keyvals`                                 |                                                                |
| `set`      | `KEY=foo, bar, baz`                                         | CSV of values cast into a Set                       | `min` / `max` for value count                                  |
| `string`   | `KEY=some long string`                                      | Any valid string                                    | `enum` for an array of values, `min` / `max` for string length |
| `uri`      | `KEY=https://somewhere.com`                                 | A valid URI                                         |                                                                |
