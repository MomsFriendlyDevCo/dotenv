import chalk from 'chalk';
import moment from 'moment';
import {Schema} from '#lib/Schema';
import chai, {expect} from 'chai';

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
	});

	it('number', ()=> {
		expect(()=>
			new Schema({v: {type: 'number', min: 10, max: 100}}).apply({v: 11})
		).to.not.throw();

		expect(()=>
			new Schema({v: {type: 'number', min: 10, max: 100}}).apply({v: 9})
		).to.throw();

		expect(()=>
			new Schema({v: {type: 'number', min: 10, max: 100}}).apply({v: 101})
		).to.throw();
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
	});

	it('regexp', ()=> {
		expect(()=>
			new Schema({v: {type: 'regexp'}}).apply({v: '/$a(.)c$/i'})
		).to.not.throw();

		let result = new Schema({v: {type: 'regexp'}}).apply({v: '/$a(.)c$/i'});
		expect(result.v).to.be.an.instanceOf(RegExp);
		expect(result.v.toString()).to.be.deep.equal('/$a(.)c$/i');

		result = new Schema({v: {type: 'regexp', flags: 'i', surrounds: false}}).apply({v: '$a(.)c$'});
		expect(result.v).to.be.an.instanceOf(RegExp);
		expect(result.v.toString()).to.be.deep.equal('/$a(.)c$/i');
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
	});

});
