@MomsFriendlyDevCo/DotEnv
=========================
DotEnv with schema, validation, expiring keys and multi-input support.

Features:

* All standard DotEnv parser / reader
* Mongo like Schema support
* Entirely synchronous - config is available immediately, no waiting on promises or other race conditions


```javascript
import dotenv from '@momsfriendlydevco/dotenv';

let config = dotenv
    .parse('.env')
    .schema({
        host: {required: true, type: String}, // Be explicit for schema paths
        port: Number, // Or general (`required` is implied for types)
        password: {
            type: 'string', // Custom support also for your own types
            cast: v => v.toLowerCase(), // Case incoming values
            destruct: '10s', // Variables not allowed to be read after this time from start (timestring)
        },
    })
    .value() //= {host: String, port: Number, password: String}
```
