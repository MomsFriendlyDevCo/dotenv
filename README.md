@MomsFriendlyDevCo/DotEnv
=========================
DotEnv with schema, validation, expiring keys and multi-input support.

Features:

* All standard DotEnv parser / reader
* Mongo like Schema support
* Entirely synchronous - config is available immediately, no waiting on promises or fixing up race conditions
* Easy config key rewriting via `.map(fn)` / `.camelCase()` / `.startCase()` etc. to make config compatible with other systems
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

| Option          | Type                         | Default | Description                                                                                                                                                                                                                           |
|-----------------|------------------------------|---------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `required`      | `Boolean`                    | `true`  | Whether the field is required                                                                                                                                                                                                         |
| `type`          | `Array<*>` / `*`             |         | Either a instance of class the object (lookup table via `aliases`) or the string representation of any key in `types`                                                                                                                 |
| `default`       | `*`                          |         | Default value to use if none is specified. If a function it is run as `(fieldSchema)` and the result used.                                                                                                                            |
| `defaultRaw`    | `*`                          |         | Default value to use without attempting evaluate functions or perform any casting if its a string. Set this as the default and don't ask any questions                                                                                |
| `validate`      | `Function` / `String`        |         | Function to validate an input, must return true. If a string is given the cast function is retrieved from the type instead. Called as `(value, fieldSchema)`                                                                          |
| `cast`          | `Function` / `String`        |         | Optional function to convert user input to a native type. If a string is given the validate is retrieved from that type instead. Called as `(value, fieldSchema)` and expected to either throw or return falsy - undefined is ignored |
| `destruct`      | `Object` / `String` / `Date` |         | Optional destruction config. See `ConfigDestruct` for details                                                                                                                                                                         |

Schema options can contain:

| Option   | Type      | Default | Description                                          |
|----------|-----------|---------|------------------------------------------------------|
| `reject` | `Boolean` | `true`  | Reject unknown fields that arn't defined in a Schema |


### Required
The required boolean has the following logic:
1. If we have a value that isn't undefined or an empty string stop here
2. If any `default` / `defaultRaw` is specified - apply those (see next section)
3. If no value is still set - return `undefined`


### Defaults
Defaults are applied with the following logic:
1. If we have a value that isn't undefined or an empty string stop here
2. If `defaultRaw` exists - use that
3. If `default` exists and is a function - evaluate it first, if not contiue with the `default` value
4. If the value from step 3 is NOT a string - assume the return value should be used as is, stop any further checks (e.g. casting, validation)
5. If the value from step 3 is a string - assume this is the same as what would be set in the .env file and continue on to cast + validate etc.


DotEnv.schemaGlob(glob, schema)
-------------------------------
Apply a schema to all config keys matching a glob, array of globs or a RegExp.


DotEnv.export(options)
----------------------
Export the current config to a string.

Options are:

| Option          | Type       | Description                                                                        |
|-----------------|------------|------------------------------------------------------------------------------------|
| `header`        | `RegExp`   | How to extract section headers as a RegExp with a capture group or null to disable |
| `headerFormat`  | `Function` | Function to format headers. Called as `(headerTitle)`                              |
| `headerSpacing` | `Number`   | How many lines of spacing should be inserted before each (new) header              |
| `rewritePair`   | `Function` | Function to rewrite a single `key=val` set                                         |


DotEnv.exportFile(path, options)
--------------------------------
Utility function to call `.export()` and dump the contents into a file.


DotEnv.deep(value)
------------------
Indicates that key mutation functions (see below) should operate on nested objects.
Set to any falsy value to revert to only applying mutations to top level keys only.
Returns the DotEnv instance.


DotEnv.mutateKeys(alias, args)
------------------------------
Apply `camelCase`, `startCase` or `envCase` (with options) to all keys, returning the DotEnv instance.


DotEnv.camelCase() / DotEnv.startCase(spacing=false) / DotEnv.envCase()
-----------------------------------------------------------------------
Mutate the config keys by applying a common string mutator, returning the DotEnv instance.


DotEnv.replace(match, replacement)
----------------------------------
Apply a replacement to all config keys, returning the DotEnv instance.


DotEnv.filter(match)
------------------
Remove all config keys that either dont have the string prefix or don't match a given RegEx, returning the DotEnv instance.


DotEnv.trim(match)
------------------
Apply a replacement to all config keys removing a given String prefix / RegExp match, returning the DotEnv instance.


DotEnv.filterAndTrim(match, replacement)
----------------------------------------
Apply both a filter + trim to a config keys - removing all config that doesnt match the string prefix (or RegEx) whilst also removing the given prefix (or RegExp).
Returns the DotEnv instance.


DotEnv.template(context)
------------------------
Applies a JavaScript string template (via [@MomsFriendlyDevCo/Template](https://github.com/MomsFriendlyDevCo/template)) to all values with the given context.
If no context is provided the current state is used.
Returns the DotEnv instance.


DotEnv.map(func)
----------------
Run a function on all state config keys, potencially mutating the key / value. Returns the DotEnv instance afterwards.

* If the function returns a tuple array its assumed to mutate the key+val of the input config key+val combo
* If the function returns a object, that object return (all keys) replace the state for that config key
* If the function returns boolean `false` the key is removed completely
* If the funciton returns boolean `true` OR undefined, no action or mutation is taken


DotEnv.tap(fn)
--------------
Run an arbitrary function passing in this DotEnv instance as the first argument and context.
Returns the chainable DotEnv instance.

```javascript
new DotEnv()
    .parse(...)
    .tap(dotEnv => console.log('Raw config:', dotEnv.value())
    .toTree(/_/)
    .tap(dotEnv => console.log('Config as a tree:', dotEnv.value())
    .value()
```

Note that if you intend to copy the state inside `tap()` it is advisable to use `.value({clone: true})` as functions such as `.toTree()` mutate sub-keys which can change state.


DotEnv.thru(fn)
---------------
Like `DotEnv.tap(fn)` only the return value is used as the new state.
Returns the chainable DotEnv instance.


DotEnv.toTree(options)
----------------------
Transform a flat key/val config item a hierarchical object-of-objects based on rules.
Returns the chainable DotEnv instance.

```javascript
let result = new DotEnv()
    .parse([
        'FOO_BAR_FOO=Foo!',
        'FOO_BAR_BAR=123',
        'FOO_BAR_BAZ=true',
        'BAR_BAR_FOO=Foo2!',
        'BAR_BAR_BAR=456',
        'BAR_BAR_BAZ=false',
    ].join('\n'))
    .toTree(/_/)
    .value()

/**
// Will return
{
    FOO: {
        BAR: {
            FOO: 'Foo!',
            BAR: '123',
            BAZ: 'true',
        },
    },
    BAR: {
        BAR: {
            FOO: 'Foo2!',
            BAR: '456',
            BAZ: 'false',
        },
    },
}
```

Options are:

| Option        | Type                       | Default    | Description                                                                                 |
|---------------|----------------------------|------------|---------------------------------------------------------------------------------------------|
| `branches`    | `Function`                 |            | A RegExp where each capture group denotes a branch of a tree                                |
| `splitter`    | `Function`                 |            | A RegExp to split keys by a given string                                                    |
| `rewrite`     | `Function` / `RegExp`      |            | Run a given funciton (or replacement RegExp) over each extracted key segment                |
| `matching`    | `String`                   | `'remove'` | Operation to perform on matching keys. ENUM: `'keep'`, `'remove'`     |
| `nonMatching` | `String`                   | `'remove'` | Operation to perform on non-matching keys (branching method only). ENUM: `'keep'`, `'remove'` |
| `prefix`      | `String` / `Array<String>` | `''`       | Optional path segment prefix when setting keys                                              |
| `clear`       | `Boolean`                  | `false`    | Start with a blank tree, if falsey will instead muatete the existing state                  |


DotEnv.value(options)
---------------------
Return the final, computed config object.


Options are:

| Option  | Type      | Default | Description                                                                   |
|---------|-----------|---------|-------------------------------------------------------------------------------|
| `clone` | `Boolean` | `false` | Return a deep clone of the value - this prevents future mangling via toTree() |


Built in types
--------------
The following is a list of built in types which provide a handy shorthand for various functionality.


| Type       | Example                                                     | Notes                                               | Additional properties                                                                                                                                                                                                                                                  |
|------------|-------------------------------------------------------------|-----------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `any`      | `KEY=something `                                            | Any type is valid                                   |                                                                                                                                                                                                                                                                        |
| `array`    | `KEY=foo,Bar, Baz`                                          | CSV of string values                                | `min` / `max` for array length                                                                                                                                                                                                                                         |
| `boolean`  | `KEY=yes` / `KEY=true`                                      | Parse common 'truthy' strings into a boolean        | `true=[...]`, `false=[]` (accepted strings to validate true / false                                                                                                                                                                                                    |
| `date`     | `KEY=2022-12-06` / `KEY=2022-12-06T13:20+10:00`             | Parse Date-like or ISO dates into a Date object `   | `min` / `max` for date period                                                                                                                                                                                                                                          |
| `duration` | `KEY=2h37m`                                                 | Parse a valid timestring duration into milliseconds | `unit=ms` for the unit to parse to                                                                                                                                                                                                                                     |
| `email`    | `KEY=a@b.com` / `KEY=Simon Jones <simon@thing.com>`         | A single email in short or long form                | `name=true` to allow a long form address                                                                                                                                                                                                                               |
| `emails`   | `KEY=a@b.com, someone@somewhere.com, J Smith <j@smith.com>` | A CSV of email addreses                             | `name=true` to allow a long form address                                                                                                                                                                                                                               |
| `file`     | `KEY=/some/path/file.txt`                                   | A file on disk, read into the value                 | `buffer=true` or `string=true` to describe how to read the file                                                                                                                                                                                                        |
| `float`    | `KEY=3.1415`                                                | Any floating value                                  | `min` / `max` for value                                                                                                                                                                                                                                                |
| `keyvals`  | `KEY=key1=val1, key2 = val 2, key3=val3`                    | An object composed of key=vals                      | `min` / `max` for key count, `noValue` to specify the content if only the key portion of the spec is given but not a value (e.g. `key4`)                                                                                                                               |
| `mongoUri` | `KEY=mongodb+src://URL...`                                  | A valid MongoDB URI                                 |                                                                                                                                                                                                                                                                        |
| `number`   | `KEY=123`                                                   | A string parsed into a number                       | `float` to accept floating values, `min` / `max` for value                                                                                                                                                                                                             |
| `object`   |                                                             | Alias for `keyvals`                                 |                                                                                                                                                                                                                                                                        |
| `percent`  | `KEY=10%`, `KEY=10`                                         | A string parsed into a number (with suffix removed) | `float` to accept floating values, `min` / `max` for value                                                                                                                                                                                                             |
| `regexp`   | `KEY=/^a(.)c$/i`                                            | RegExp with surrounding slashes                     | `surrounds=true` to accept raw strings without '/' surroundings, `flags` to set default flags (e.g. `flags=i`), `allowPlain=true` (with `surrounds=true`) to parse non-surround strings as plain-text, `plainPrefix` + `plainSuffix` to decorate the plain text RegExp |
| `set`      | `KEY=foo, bar, baz`                                         | CSV of values cast into a Set                       | `min` / `max` for value count                                                                                                                                                                                                                                          |
| `string`   | `KEY=some long string`                                      | Any valid string                                    | `enum` for an array of values, `min` / `max` for string length                                                                                                                                                                                                         |
| `style`    | `KEY=bold red` / `KEY=bgwhite + yellow`                     | Chalk compatible color styling                      |                                                                                                                                                                                                                                                                        |
| `uri`      | `KEY=https://somewhere.com`                                 | A valid URI                                         | `parse=false` to specify that the parsed URL object should be returned rather than the string                                                                                                                                                                          |
