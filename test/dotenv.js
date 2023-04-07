import chalk from 'chalk';
import dotenv, {DotEnv} from '#lib/dotenv';
import {expect} from 'chai';

describe('dotenv', ()=> {

	it('should be a simple global class', ()=> {
		expect(dotenv).to.be.an('object');
	});

	it('should support simple getters', ()=> {
		let config = dotenv.parse('FOO=Foo!').value()

		expect(config).to.have.property('FOO', 'Foo!');
	});

	it('should support simple schemas', ()=> {
		let config = dotenv
			.parse('FOO=Foo!\nBAR=123')
			.schema({
				FOO: String,
				BAR: Number,
			})
			.value()

		expect(config).to.have.property('FOO', 'Foo!');
		expect(config).to.have.property('BAR', 123);
	});

	it('should support empty values with defaults', ()=>
		expect(dotenv
			.schema({
				TEST_ANY: {type: 'any', default: 'any!'},
				TEST_ARRAY: {type: 'array', default: [1, 2, 3]},
				TEST_BOOLEAN: {type: 'boolean', default: true},
				TEST_DATE: {type: 'date', default: new Date('1970-01-01T00:00:00')},
				TEST_DURATION: {type: 'duration', default: '1h'},
				TEST_EMAIL: {type: 'email', default: 'someone@somewhere.com'},
				TEST_EMAILS: {type: 'emails', default: 'foo@server.com, bar@server.com'},
				TEST_FLOAT: {type: 'float', default: 3.142},
				TEST_KEYVALS: {type: 'keyvals', default: {foo: 'Foo!', bar: 'Bar!'}},
				TEST_MONGOURI: {type: 'mongouri', default: 'mongodb+srv://server.com'},
				TEST_NUMBER: {type: 'number', default: 2129},
				TEST_OBJECT: {type: 'object', default: {foo: 'Foo2!', bar: 'Bar2!'}},
				TEST_REGEXP: {type: 'regexp', default: /a(.)c/i},
				TEST_SET: {type: 'set', default: new Set(['Foo', 'Bar', 'Baz'])},
				TEST_STRING: {type: 'string', default: 'Test!'},
				TEST_STYLE: {type: 'style', default: 'bold+red'},
				TEST_URI: {type: 'string', default: 'https://server.com'},
			})
			.value()
		).to.deep.equal({
				TEST_ANY: 'any!',
				TEST_ARRAY: [1, 2, 3],
				TEST_BOOLEAN: true,
				TEST_DATE: new Date('1970-01-01T00:00:00'),
				TEST_DURATION: 60 * 60 * 1000,
				TEST_EMAIL: 'someone@somewhere.com',
				TEST_EMAILS: 'foo@server.com, bar@server.com',
				TEST_FLOAT: 3.142,
				TEST_KEYVALS: {foo: 'Foo!', bar: 'Bar!'},
				TEST_MONGOURI: 'mongodb+srv://server.com',
				TEST_NUMBER: 2129,
				TEST_OBJECT: {foo: 'Foo2!', bar: 'Bar2!'},
				TEST_REGEXP: new RegExp(/a(.)c/i),
				TEST_SET: new Set(['Foo', 'Bar', 'Baz']),
				TEST_STRING: 'Test!',
				TEST_STYLE: chalk.bold.red,
				TEST_URI: 'https://server.com',
		})
	);

	it('should support templates', ()=> {
		expect(new DotEnv()
			.parse([
				'FOO=Foo!',
				'BAR=Bar!',
				'FOOBAR=${FOO}-${BAR}',
				"QUZ=${STATE['FOO']}",
			].join('\n'))
			.schema({
				FOO: String,
				BAR: String,
				FOOBAR: String,
				QUZ: String,
			})
			.template()
			.value()
		).to.be.deep.equal({
			FOO: 'Foo!',
			BAR: 'Bar!',
			FOOBAR: 'Foo!-Bar!',
			QUZ: 'Foo!',
		});

		expect(new DotEnv()
			.parse([
				'FOO=Foo!',
				'BAR=Bar!',
				'FOOBAR=${FOO}-${BAR}',
			].join('\n'))
			.schema({
				FOO: String,
				BAR: String,
				FOOBAR: String,
			})
			.template({
				FOO: 'FOO!',
				BAR: 'BAR!',
			})
			.value()
		).to.be.deep.equal({
			FOO: 'Foo!',
			BAR: 'Bar!',
			FOOBAR: 'FOO!-BAR!',
		});
	});

	it('should support destruct (on key access)', resolve => {
		let config = dotenv
			.parse('PASS=hello-world')
			.schema({
				PASS: {type: 'string', destruct: '100ms'},
			})
			.value()

		expect(config).to.be.an('object');

		expect(config).to.have.property('PASS');
		expect(config.PASS).to.be.deep.equal('hello-world');

		setTimeout(()=> {
			expect(()=> {
				let readValue = config.PASS;
				console.log('I got', readValue);
			}).to.throw();

			resolve();
		}, 200);
	});

	it('should support destruct (automatically on timeout)', function(resolve) {
		this.timeout(10 * 1000);

		let config = new DotEnv()
			.parse('SECRET=Yep')
			.schema({
				SECRET: {type: 'string', destruct: {at: '5s', destructValue: 'NOPE!'}},
			})
			.value()

		expect(config).to.be.an('object');

		expect(config).to.have.property('SECRET');
		expect(config.SECRET).to.be.deep.equal('Yep');

		setTimeout(()=> {
			expect(config).to.have.property('SECRET');
			expect(config.SECRET).to.be.deep.equal('NOPE!');

			resolve();
		}, 5500);
	});

	it('should export simple schemas', ()=> {
		let config = dotenv
			.parse([
				'FOOBAR_FOO=Foo!',
				'FOOBAR_BAR=123',
				'BAZBAR_FOO=Foo2!',
				'BAZBAR_BAR=456',
				'BAZBAR_BAZ=Y',
			].join('\n'))
			.schema({
				FOOBAR_FOO: {type: String, default: 'Foo', help: 'Does a thing'},
				FOOBAR_BAR: Number,
				BAZBAR_FOO: {type: String, default: 'Foo'},
				BAZBAR_BAR: Number,
				BAZBAR_BAZ: {type: Boolean, default: false, help: 'Only "Y"/"N" accepted', true: ['Y'], false: ['N']},
			});

		expect(config.export({help: false}).split('\n')).to.deep.equal([
			'# FOOBAR #',
			'FOOBAR_FOO=Foo!',
			'FOOBAR_BAR=123',
			'',
			'# BAZBAR #',
			'BAZBAR_FOO=Foo2!',
			'BAZBAR_BAR=456',
			'BAZBAR_BAZ=Y',
		])

		expect(config.export({values: false}).split('\n')).to.deep.equal([
			'# FOOBAR #',
			'FOOBAR_FOO=Foo # Does a thing',
			'FOOBAR_BAR=',
			'',
			'# BAZBAR #',
			'BAZBAR_FOO=Foo',
			'BAZBAR_BAR=',
			'BAZBAR_BAZ=N # Only "Y"/"N" accepted',
		])
	});

	it('should support schemaGlobs', ()=> {
		expect(new DotEnv()
			.parse([
				'FOO=Foo!',
				'BAR=123',
				'BAZ=456',
				'QUZ=false',
				'FLARP=1',
			].join('\n'))
			.schemaGlob('FOO', String)
			.schemaGlob('B*', {type: Number})
			.schemaGlob('Q?Z', {type: 'boolean'})
			.schemaGlob('FLARP', 'boolean')
			.value()
		).to.deep.equal({
			FOO: 'Foo!',
			BAR: 123,
			BAZ: 456,
			QUZ: false,
			FLARP: true,
		})
	});

	it('should support config key mangling', ()=> {
		let configFactory = ()=> new DotEnv()
			.parse([
				'FOOBAR_FOO=Foo!',
				'FOOBAR_BAR=123',
				'BAZBAR_FOO=Foo2!',
				'BAZBAR_BAR=456',
				'BAZBAR_BAZ=true',
			].join('\n'))
			.schema({
				FOOBAR_FOO: String,
				FOOBAR_BAR: Number,
				BAZBAR_FOO: String,
				BAZBAR_BAR: Number,
				BAZBAR_BAZ: Boolean,
			});

		expect(configFactory().value()).to.deep.equal({
			'FOOBAR_FOO': 'Foo!',
			'FOOBAR_BAR': 123,
			'BAZBAR_FOO': 'Foo2!',
			'BAZBAR_BAR': 456,
			'BAZBAR_BAZ': true,
		});

		expect(configFactory().camelCase().value()).to.deep.equal({
			'foobarFoo': 'Foo!',
			'foobarBar': 123,
			'bazbarFoo': 'Foo2!',
			'bazbarBar': 456,
			'bazbarBaz': true,
		});

		expect(configFactory().mutateKeys('camelCase').value()).to.deep.equal({
			'foobarFoo': 'Foo!',
			'foobarBar': 123,
			'bazbarFoo': 'Foo2!',
			'bazbarBar': 456,
			'bazbarBaz': true,
		});

		expect(configFactory().startCase().value()).to.deep.equal({
			'FoobarFoo': 'Foo!',
			'FoobarBar': 123,
			'BazbarFoo': 'Foo2!',
			'BazbarBar': 456,
			'BazbarBaz': true,
		});

		expect(configFactory().startCase(true).value()).to.deep.equal({
			'Foobar Foo': 'Foo!',
			'Foobar Bar': 123,
			'Bazbar Foo': 'Foo2!',
			'Bazbar Bar': 456,
			'Bazbar Baz': true,
		});

		expect(configFactory().mutateKeys('startCase', true).value()).to.deep.equal({
			'Foobar Foo': 'Foo!',
			'Foobar Bar': 123,
			'Bazbar Foo': 'Foo2!',
			'Bazbar Bar': 456,
			'Bazbar Baz': true,
		});

		expect(configFactory().envCase().value()).to.deep.equal({
			'FOOBAR_FOO': 'Foo!',
			'FOOBAR_BAR': 123,
			'BAZBAR_FOO': 'Foo2!',
			'BAZBAR_BAR': 456,
			'BAZBAR_BAZ': true,
		});

		expect(configFactory().filter('FOOBAR_').value()).to.deep.equal({
			'FOOBAR_FOO': 'Foo!',
			'FOOBAR_BAR': 123,
		});

		expect(configFactory().filter('FOOBAR_').trim('FOOBAR_').value()).to.deep.equal({
			'FOO': 'Foo!',
			'BAR': 123,
		});

		expect(configFactory().filterAndTrim('FOOBAR_').value()).to.deep.equal({
			'FOO': 'Foo!',
			'BAR': 123,
		});

		expect(configFactory().filter(/^FOOBAR_/).value()).to.deep.equal({
			'FOOBAR_FOO': 'Foo!',
			'FOOBAR_BAR': 123,
		});

		expect(configFactory().filter(/^FOOBAR_/).trim('FOOBAR_').value()).to.deep.equal({
			'FOO': 'Foo!',
			'BAR': 123,
		});

		expect(configFactory().filterAndTrim(/^FOOBAR_/).value()).to.deep.equal({
			'FOO': 'Foo!',
			'BAR': 123,
		});

		expect(configFactory().filterAndTrim(/^FOOBAR_/).camelCase().value()).to.deep.equal({
			foo: 'Foo!',
			bar: 123,
		});
	});

	it('should support splitting config into a tree', ()=> {
		let configFactory = ()=> new DotEnv()
			.parse([
				'FOO_BAR_FOO=Foo!',
				'FOO_BAR_BAR=123',
				'FOO_BAR_QUZ=Foo, Bar,Baz',
				'BAR_BAR_FOO=Foo2!',
				'BAR_BAR_BAR=456',
			].join('\n'))
			.schema({
				FOO_BAR_FOO: String,
				FOO_BAR_BAR: Number,
				FOO_BAR_BAZ: {type: Boolean, default: true},
				FOO_BAR_QUZ: {type: Array},
				BAR_BAR_FOO: String,
				BAR_BAR_BAR: Number,
				BAR_BAR_BAZ: {type: Boolean, default: false},
			});

		let idealTree = {
			FOO: {
				BAR: {
					FOO: 'Foo!',
					BAR: 123,
					BAZ: true,
					QUZ: ['Foo', 'Bar', 'Baz'],
				},
			},
			BAR: {
				BAR: {
					FOO: 'Foo2!',
					BAR: 456,
					BAZ: false,
				},
			},
		};


		expect(configFactory().toTree({branches: /^(.+)_(.+)_(.+)/}).value())
			.to.deep.equal(idealTree);

		expect(configFactory().toTree(/^(.+)_(.+)_(.+)/).value())
			.to.deep.equal(idealTree);

		expect(configFactory().toTree({splitter: /_+/}).value())
			.to.deep.equal(idealTree);

		expect(configFactory().toTree(/_+/).value())
			.to.deep.equal(idealTree);

		// Camel case + split into tree
		expect(configFactory().camelCase().toTree({
			splitter: /(?=[A-Z])/,
			rewrite: v => v.toLowerCase(),
		}).value())
			.to.deep.equal({
				foo: {
					bar: {
						foo: 'Foo!',
						bar: 123,
						baz: true,
						quz: ['Foo', 'Bar', 'Baz'],
					},
				},
				bar: {
					bar: {
						foo: 'Foo2!',
						bar: 456,
						baz: false,
					},
				},
			});

		expect(configFactory().toTree(/_+/).deep(false).camelCase().value())
			.to.deep.equal({
				foo: {
					BAR: {
						FOO: 'Foo!',
						BAR: 123,
						BAZ: true,
						QUZ: ['Foo', 'Bar', 'Baz'],
					},
				},
				bar: {
					BAR: {
						FOO: 'Foo2!',
						BAR: 456,
						BAZ: false,
					},
				},
			});

		expect(configFactory().toTree(/_+/).deep().camelCase().value())
			.to.deep.equal({
				foo: {
					bar: {
						foo: 'Foo!',
						bar: 123,
						baz: true,
						quz: ['Foo', 'Bar', 'Baz'],
					},
				},
				bar: {
					bar: {
						foo: 'Foo2!',
						bar: 456,
						baz: false,
					},
				},
			});

		expect(configFactory().set('FOO_BAR_BAR', new URL('http://localhost:8080')).toTree(/_+/).deep().camelCase().value())
			.to.deep.equal({
				foo: {
					bar: {
						foo: 'Foo!',
						bar: new URL('http://localhost:8080'),
						baz: true,
						quz: ['Foo', 'Bar', 'Baz'],
					},
				},
				bar: {
					bar: {
						foo: 'Foo2!',
						bar: 456,
						baz: false,
					},
				},
			});
	});

});
