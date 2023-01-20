import chai, {expect} from 'chai';
import chalk from 'chalk';
import {DotEnv} from '#lib/dotenv';
import moment from 'moment';
import {Schema} from '#lib/Schema';
import {URL} from 'node:url';

chai.config.truncateThreshold = 999;

describe('dotenv.Schema', ()=> {

	it('should apply simple schema defaults to empty config', ()=>
		expect(
			(new Schema({
				foo: {default: 'Foo'},
				bar: {default: 123},
				baz: {default: ()=> 456},
			})).apply({})
		).to.deep.equal({
			foo: 'Foo',
			bar: 123,
			baz: 456,
		})
	)

	it('should apply simple schema when values are present', ()=>
		expect(
			(new Schema({
				foo: {default: 'Foo'},
				bar: {default: 123},
				baz: {default: ()=> 456},
			})).apply({
				bar: 789,
			})
		).to.deep.equal({
			foo: 'Foo',
			bar: 789,
			baz: 456,
		})
	);

	it('should type cast', ()=>
		expect(
			(new Schema({
				foo: Number,
				bar: {type: Number},
				baz: 'NUMBER',
			})).apply({
				foo: '1',
				bar: '2',
				baz: 3,
			})
		).to.deep.equal({
			foo: 1,
			bar: 2,
			baz: 3,
		})
	);

});


describe('dotenv.Schema (validation)', ()=> {

	it('meta: invalid', ()=> {
		expect(()=>
			new Schema({v: {type: '!!!INVALID!!!'}}).apply({v: 'FOO!'})
		).to.throw();

		expect(()=>
			new Schema({v: '!!!INVALID!!!'}).apply({v: 'FOO!'})
		).to.throw();

		expect(()=>
			new Schema({v: {type: false}}).apply({v: 'FOO!'})
		).to.throw();

		expect(()=>
			new Schema({v: false}).apply({v: 'FOO!'})
		).to.throw();
	});

	it('any', ()=> {
		expect(()=>
			new Schema({
				a: 'any',
				b: 'any',
				c: 'any',
				d: 'any',
				e: 'any',
				f: 'any',
			}).apply({
				a: 6,
				b: 'string!',
				c: false,
				d: true,
				e: [],
				f: {},
			})
		).to.not.throw();
	});

	it('array', ()=> {
		expect(()=>
			new Schema({v: {type: 'array', min: 1, max: 3}}).apply({v: 'foo,bar'})
		).to.not.throw();

		expect(()=>
			new Schema({v: {type: 'array', min: 1, max: 3}}).apply({v: ''})
		).to.throw();

		expect(()=>
			new Schema({v: {type: 'array', min: 1, max: 3}}).apply({v: 'foo, bar,baz, quz'})
		).to.throw();

		expect(()=>
			new Schema({v: {type: 'array', subType: {type: 'number', min: 1, max: 3}}}).apply({v: '1, 2, 3'})
		).to.not.throw();

		expect(()=>
			new Schema({v: {type: 'array', subType: {type: 'number', min: 1, max: 3}}}).apply({v: '1, 4, 3'})
		).to.not.throw();

		expect(()=>
			new Schema({v: {type: 'array', subType: 'string'}}).apply({v: 'foo,bar,baz'})
		).to.not.throw();

		expect(()=>
			new Schema({v: {type: 'array', subType: 'string'}}).apply({v: 'foo,bar,baz,quz'})
		).to.not.throw();

		expect(
			new Schema({v: {type: 'array', subType: 'string', split: 'whitespace'}}).apply({v: 'foo bar baz quz'})
		).to.deep.equal({
			v: ['foo', 'bar', 'baz', 'quz'],
		});

		expect(
			new DotEnv().parse('ARR=').schema({ARR: {type: 'array', required: false}}).value()
		).to.deep.equal({
			ARR: undefined,
		});

		expect(
			new DotEnv().parse('ARR=').schema({ARR: {type: 'array', required: false, default: ''}}).value()
		).to.deep.equal({
			ARR: undefined,
		});

		expect(
			new DotEnv().parse('ARR=').schema({ARR: {type: 'array', required: false, default: 'foo,bar, baz'}}).value()
		).to.deep.equal({
			ARR: ['foo', 'bar', 'baz'],
		});
	});

	it('boolean', ()=> {
		expect(()=>
			new Schema({
				a: 'boolean',
				b: Boolean,
				c: {type: 'boolean'},
				d: {type: Boolean},
			}).apply({
				a: '1',
				b: 'yes',
				c: 'true',
				d: 'false',
			})
		).to.not.throw();

		expect(()=>
			new Schema({
				a: {type: 'boolean', true: ['yup']},
				b: {type: Boolean, false: ['nope']},
			}).apply({
				a: 'yup',
				b: 'nope',
			})
		).to.not.throw();

		expect(()=>
			new Schema({
				a: {type: 'boolean', true: ['1'], false: ['2']},
			}).apply({
				a: 'true',
			})
		).to.throw();

		expect(
			new DotEnv().parse('BOOL=').schema({BOOL: {type: 'boolean', required: false}}).value()
		).to.deep.equal({
			BOOL: undefined,
		});

		expect(
			new DotEnv().parse('BOOL=').schema({BOOL: {type: 'boolean', default: true}}).value()
		).to.deep.equal({
			BOOL: true,
		});

		expect(
			new DotEnv().parse('BOOL=').schema({BOOL: {type: 'boolean', default: false}}).value()
		).to.deep.equal({
			BOOL: false,
		});
	});

	it('date', ()=> {
		expect(()=>
			new Schema({v: {
				type: 'date',
				min: moment().subtract(1, 'd').toDate(),
				max: moment().add(1, 'd').toDate(),
			}}).apply({v: new Date()})
		).to.not.throw();

		expect(()=>
			new Schema({v: {
				type: 'date',
				min: moment().subtract(1, 'd').toDate(),
				max: moment().add(1, 'd').toDate(),
			}}).apply({v: moment().subtract(1, 'w').toDate()})
		).to.throw();

		expect(()=>
			new Schema({v: {
				type: 'date',
				min: moment().subtract(1, 'd').toDate(),
				max: moment().add(1, 'd').toDate(),
			}}).apply({v: moment().add(1, 'w').toDate()})
		).to.throw();

		expect(
			new DotEnv().parse('DATE=').schema({DATE: {type: 'date', required: false}}).value()
		).to.deep.equal({
			DATE: undefined,
		});

		expect(
			new DotEnv().parse('DATE=').schema({DATE: {type: 'date', default: new Date('2022-01-01T00:00:00Z')}}).value()
		).to.deep.equal({
			DATE: new Date('2022-01-01T00:00:00Z'),
		});
	});

	it('duration', ()=> {
		expect(()=>
			new Schema({v: {
				type: 'duration',
			}}).apply({v: '10m'})
		).to.not.throw();

		expect(()=>
			new Schema({v: 'duration'}).apply({v: '2w'})
		).to.not.throw();

		expect(()=>
			new Schema({v: 'duration'}).apply({v: ''})
		).to.throw();

		expect(
			new DotEnv().parse('DURATION=').schema({DURATION: {type: 'duration', required: false}}).value()
		).to.deep.equal({
			DURATION: undefined,
		});

		expect(
			new DotEnv().parse('DURATION=').schema({DURATION: {type: 'duration', default: '10m'}}).value()
		).to.deep.equal({
			DURATION: 60 * 1000 * 10,
		});
	});

	it('email', ()=> {
		expect(()=>
			new Schema({v: 'email'}).apply({v: 'someone@somewhere.com'})
		).to.not.throw();

		expect(()=>
			new Schema({v: 'email'}).apply({v: 'Mr. Someone <someone@somewhere.com>'})
		).to.not.throw();

		expect(()=>
			new Schema({v: 'email'}).apply({v: 'http://someone.com'})
		).to.throw();

		expect(
			new DotEnv().parse('EMAIL=').schema({EMAIL: {type: 'email', required: false}}).value()
		).to.deep.equal({
			EMAIL: undefined,
		});

		expect(
			new DotEnv().parse('EMAIL=').schema({EMAIL: {type: 'email', default: 'nope@nope.com'}}).value()
		).to.deep.equal({
			EMAIL: 'nope@nope.com',
		});
	});

	it('emails', ()=> {
		expect(()=>
			new Schema({v: {type: 'emails', min: 1, max: 2}}).apply({v: 'someone@somewhere.com'})
		).to.not.throw();

		expect(()=>
			new Schema({v: {type: 'emails', min: 1, max: 2}}).apply({v: 'Mr. Someone <someone@somewhere.com>'})
		).to.not.throw();

		expect(()=>
			new Schema({v: {type: 'emails', min: 1, max: 2}}).apply({v: 'http://someone.com'})
		).to.throw();

		expect(()=>
			new Schema({v: {type: 'emails', min: 1, max: 2}}).apply({v: ''})
		).to.throw();

		expect(()=>
			new Schema({v: {type: 'emails', min: 1, max: 2}}).apply({v: 'someone@somewhere.com, thing@thing.com, super@man.com'})
		).to.throw();

		expect(
			new DotEnv().parse('EMAILS=').schema({EMAILS: {type: 'emails', required: false}}).value()
		).to.deep.equal({
			EMAILS: undefined,
		});

		expect(
			new DotEnv().parse('EMAILS=').schema({EMAILS: {type: 'emails', default: 'foo@bar.com, baz@quz.com'}}).value()
		).to.deep.equal({
			EMAILS: 'foo@bar.com, baz@quz.com',
		});
	});

	it('float', ()=> {
		expect(()=>
			new Schema({v: {type: 'float', min: 1, max: 2}}).apply({v: 1})
		).to.not.throw();

		expect(()=>
			new Schema({v: {type: 'float', min: 1, max: 2}}).apply({v: 1.1})
		).to.not.throw();

		expect(()=>
			new Schema({v: {type: 'float', min: 1, max: 2}}).apply({v: 0.91})
		).to.throw();

		expect(()=>
			new Schema({v: {type: 'float', min: 1, max: 2}}).apply({v: 2.1})
		).to.throw();

		expect(
			new DotEnv().parse('FLOAT=').schema({FLOAT: {type: 'float', required: false}}).value()
		).to.deep.equal({
			FLOAT: undefined,
		});

		expect(
			new DotEnv().parse('FLOAT=').schema({FLOAT: {type: 'float', default: '3.14'}}).value()
		).to.deep.equal({
			FLOAT: 3.14,
		});

		expect(
			new DotEnv().parse('FLOAT=').schema({FLOAT: {type: 'float', default: 3.14}}).value()
		).to.deep.equal({
			FLOAT: 3.14,
		});
	});

	it('keyvals', ()=> {
		expect(()=>
			new Schema({v: {type: 'keyvals', min: 1, max: 3}}).apply({v: 'foo:Foo!'})
		).to.not.throw();

		expect(()=>
			new Schema({v: {type: 'keyvals', min: 1, max: 3}}).apply({v: 'foo=Foo!'})
		).to.not.throw();

		expect(()=>
			new Schema({v: {type: 'keyvals', min: 1, max: 3}}).apply({v: ''})
		).to.throw();

		expect(()=>
			new Schema({v: {type: 'keyvals', min: 1, max: 3}}).apply({v: 'foo=Foo!, bar=Bar!, baz=Baz!'})
		).to.not.throw();

		expect(()=>
			new Schema({v: {type: 'keyvals', min: 1, max: 3}}).apply({v: 'foo=Foo!, bar=Bar!, baz=Baz!, quz:Quz!'})
		).to.throw();

		expect(
			new DotEnv().parse('KEYVALS=').schema({KEYVALS: {type: 'keyvals', required: false, default: ''}}).value()
		).to.deep.equal({
			KEYVALS: undefined,
		});

		expect(
			new DotEnv().parse('KEYVALS=foo: 1, bar: 2, baz: 3').schema({KEYVALS: 'keyvals'}).value()
		).to.deep.equal({
			KEYVALS: {
				foo: '1',
				bar: '2',
				baz: '3',
			},
		});

		expect(
			new DotEnv().parse('KEYVALS=foo, bar, baz').schema({KEYVALS: {type: 'keyvals', noValue: ''}}).value()
		).to.deep.equal({
			KEYVALS: {
				foo: '',
				bar: '',
				baz: '',
			},
		});

		expect(
			new DotEnv().parse('KEYVALS=foo, bar, baz').schema({KEYVALS: {type: 'keyvals', noValue: {}}}).value()
		).to.deep.equal({
			KEYVALS: {
				foo: {},
				bar: {},
				baz: {},
			},
		});

		expect(
			new DotEnv().parse('KEYVAL=').schema({KEYVAL: {type: 'keyvals', required: false}}).value()
		).to.deep.equal({
			KEYVAL: undefined,
		});

		expect(
			new DotEnv().parse('KEYVAL=').schema({KEYVAL: {type: 'keyvals', default: ''}}).value()
		).to.deep.equal({
			KEYVAL: {},
		});

		expect(
			new DotEnv().parse('KEYVAL=').schema({KEYVAL: {type: 'keyvals', default: 'foo: 1'}}).value()
		).to.deep.equal({
			KEYVAL: {foo: '1'},
		});

		expect(
			new DotEnv().parse('KEYVAL=').schema({KEYVAL: {type: 'keyvals', default: {foo: 1}}}).value()
		).to.deep.equal({
			KEYVAL: {foo: 1},
		});
	});

	it('mongoUri', ()=> {
		expect(()=>
			new Schema({v: 'mongoUri'}).apply({v: 'mongodb+srv://thing.com'})
		).to.not.throw();

		expect(()=>
			new Schema({v: 'mongoUri'}).apply({v: 'https://thing.com'})
		).to.throw();

		expect(()=>
			new Schema({v: 'mongoUri'}).apply({v: 'thing.com'})
		).to.throw();

		expect(
			new DotEnv().parse('MONGOURI=').schema({MONGOURI: {type: 'mongouri', required: false}}).value()
		).to.deep.equal({
			MONGOURI: undefined,
		});
	});

	it('number', ()=> {
		expect(
			new Schema({v: {type: 'number', required: false}}).apply({v: ''})
		).to.deep.equal({v: undefined})

		expect(()=>
			new Schema({v: {type: 'number', min: 10, max: 100}}).apply({v: 11})
		).to.not.throw();

		expect(()=>
			new Schema({v: {type: 'number', min: 10, max: 100}}).apply({v: 9})
		).to.throw();

		expect(()=>
			new Schema({v: {type: 'number', min: 10, max: 100}}).apply({v: 101})
		).to.throw();

		expect(
			new DotEnv().parse('NUMBER=').schema({NUMBER: {type: 'number', required: false}}).value()
		).to.deep.equal({
			NUMBER: undefined,
		});

		expect(
			new DotEnv().parse('NUMBER=').schema({NUMBER: {type: 'number', default: '123456'}}).value()
		).to.deep.equal({
			NUMBER: 123456,
		});

		expect(
			new DotEnv().parse('NUMBER=').schema({NUMBER: {type: 'number', default: 123456}}).value()
		).to.deep.equal({
			NUMBER: 123456,
		});
	});

	it('percent', ()=> {
		expect(()=>
			new Schema({v: {type: 'percent', min: 10, max: 100}}).apply({v: '11%'})
		).to.not.throw();

		expect(()=>
			new Schema({v: {type: 'percent', min: 10, max: 100}}).apply({v: '9%'})
		).to.throw();

		expect(()=>
			new Schema({v: {type: 'percent', min: 10, max: 100}}).apply({v: '101%'})
		).to.throw();

		expect(
			new Schema({v: {type: 'percent', min: 10, max: 100}}).apply({v: '10%'})
		).to.be.deep.equal({v: 10})

		expect(
			new Schema({v: {type: 'percent', min: 10, max: 100}}).apply({v: '10'})
		).to.be.deep.equal({v: 10})

		expect(
			new DotEnv().parse('PERCENT=').schema({PERCENT: {type: 'percent', required: false}}).value()
		).to.deep.equal({
			PERCENT: undefined,
		});

		expect(
			new DotEnv().parse('PERCENT=').schema({PERCENT: {type: 'percent', default: '13%'}}).value()
		).to.deep.equal({
			PERCENT: 13,
		});

		expect(
			new DotEnv().parse('PERCENT=').schema({PERCENT: {type: 'percent', default: 13}}).value()
		).to.deep.equal({
			PERCENT: 13,
		});
	});


	it('set', ()=> {
		expect(()=>
			new Schema({v: {type: 'set', min: 1, max: 3}}).apply({v: 'foo,bar'})
		).to.not.throw();

		expect(()=>
			new Schema({v: {type: 'set', min: 1, max: 3}}).apply({v: ''})
		).to.throw();

		expect(()=>
			new Schema({v: {type: 'set', min: 1, max: 3}}).apply({v: ['foo, bar,baz,quz']})
		).to.throw();

		expect(
			new DotEnv().parse('SET=').schema({SET: {type: 'set', required: false}}).value()
		).to.deep.equal({
			SET: undefined,
		});

		expect(
			new DotEnv().parse('SET=').schema({SET: {type: 'set', default: 'Foo'}}).value()
		).to.deep.equal({
			SET: new Set(['Foo']),
		});

		expect(
			new DotEnv().parse('SET=').schema({SET: {type: 'set', default: new Set(['Foo'])}}).value()
		).to.deep.equal({
			SET: new Set(['Foo']),
		});
	});

	it('regexp', ()=> {
		expect(()=>
			new Schema({v: {type: 'regexp'}}).apply({v: '/^a(.)c$/i'})
		).to.not.throw();

		let result = new Schema({v: {type: 'regexp'}}).apply({v: '/^a(.)c$/i'});
		expect(result.v).to.be.an.instanceOf(RegExp);
		expect(result.v.toString()).to.be.deep.equal('/^a(.)c$/i');

		result = new Schema({v: {type: 'regexp', flags: 'i', surrounds: false}}).apply({v: '^a(.)c$'});
		expect(result.v).to.be.an.instanceOf(RegExp);
		expect(result.v.toString()).to.be.deep.equal('/^a(.)c$/i');

		result = new Schema({v: {type: 'regexp', flags: 'i', acceptPlain: true}}).apply({v: 'foo'});
		expect(result.v).to.be.an.instanceOf(RegExp);
		expect(result.v.toString()).to.be.deep.equal('/foo/i');

		result = new Schema({v: {type: 'regexp', acceptPlain: true, plainPrefix: '^', plainSuffix: '$'}}).apply({v: 'foo'});
		expect(result.v).to.be.an.instanceOf(RegExp);
		expect(result.v.toString()).to.be.deep.equal('/^foo$/');

		expect(
			new DotEnv().parse('REGEXP=').schema({REGEXP: {type: 'regexp', required: false}}).value()
		).to.deep.equal({
			REGEXP: undefined,
		});

		expect(
			new DotEnv().parse('REGEXP=').schema({REGEXP: {type: 'regexp', default: '/a.c/'}}).value()
		).to.deep.equal({
			REGEXP: /a.c/,
		});

		expect(
			new DotEnv().parse('REGEXP=').schema({REGEXP: {type: 'regexp', default: /a.c/}}).value()
		).to.deep.equal({
			REGEXP: /a.c/,
		});
	});

	it('string', ()=> {
		expect(()=>
			new Schema({v: {type: 'string', min: 1, max: 3}}).apply({v: 'hi'})
		).to.not.throw();

		expect(()=>
			new Schema({v: {type: 'string', min: 1, max: 3}}).apply({v: ''})
		).to.throw();

		expect(()=>
			new Schema({v: {type: 'string', min: 1, max: 3}}).apply({v: 'hello'})
		).to.throw();

		expect(()=>
			new Schema({v: {type: 'string', enum: ['foo', 'bar', 'baz']}}).apply({v: 'bar'})
		).to.not.throw();

		expect(()=>
			new Schema({v: {type: 'string', enum: ['foo', 'bar', 'baz']}}).apply({v: 'BAZ!'})
		).to.throw();

		expect(
			new DotEnv().parse('STRING=').schema({STRING: {type: 'string', required: false}}).value()
		).to.deep.equal({
			STRING: undefined,
		});

		expect(
			new DotEnv().parse('STRING=').schema({STRING: {type: 'string', default: 'foo'}}).value()
		).to.deep.equal({
			STRING: 'foo',
		});
	});

	it('style', ()=> {
		process.env.FORCE_COLOR = 3; // Force Chalk to be enabled

		expect(()=>
			new Schema({v: 'style'}).apply({v: 'bold red'})
		).to.not.throw();

		expect(new Schema({v: 'style'}).apply({v: 'red'}))
			.to.be.deep.equal({v: chalk.red});

		expect(new Schema({v: 'style'}).apply({v: 'bgWhite+fgBlack'})) // NOTE: These have to be in bg+fg order to keep Mocha's deep.equal happy
			.to.be.deep.equal({v: chalk.bgWhite.black});

		expect(
			new DotEnv().parse('STYLE=').schema({STYLE: {type: 'style', required: false}}).value()
		).to.deep.equal({
			STYLE: undefined,
		});

		expect(
			new DotEnv().parse('STYLE=').schema({STYLE: {type: 'style', default: 'blue'}}).value()
		).to.deep.equal({
			STYLE: chalk.blue,
		});

		expect(
			new DotEnv().parse('STYLE=').schema({STYLE: {type: 'style', defaultRaw: chalk.blue}}).value()
		).to.deep.equal({
			STYLE: chalk.blue,
		});
	});

	it('uri', ()=> {
		expect(()=>
			new Schema({v: 'uri'}).apply({v: 'https://google.com.au'})
		).to.not.throw();

		expect(new Schema({v: 'style'}).apply({v: 'red'}))
			.to.be.deep.equal({v: chalk.red});

		expect(new Schema({v: 'uri'}).apply({v: 'https://google.com.au'}))
			.to.be.deep.equal({v: 'https://google.com.au'});

		let config = new Schema({v: {type: 'uri', parse: true}}).apply({v: 'https://google.com.au/dir'});
		expect(config).to.be.an('object');
		expect(config.v).to.be.an.instanceOf(URL);
		expect(config.v).to.have.property('protocol', 'https:');
		expect(config.v).to.have.property('host', 'google.com.au');
		expect(config.v).to.have.property('pathname', '/dir');

		expect(
			new DotEnv().parse('URI=').schema({URI: {type: 'uri', required: false}}).value()
		).to.deep.equal({
			URI: undefined,
		});

		expect(
			new DotEnv().parse('URI=').schema({URI: {type: 'uri', default: 'https://google.com.au'}}).value()
		).to.deep.equal({
			URI: 'https://google.com.au',
		});

		let uri = new DotEnv().parse('URI=').schema({URI: {type: 'uri', default: 'https://google.com.au', parse: true}}).value().URI;
		expect(uri.toString()).to.equal('https://google.com.au/');
	});

});
