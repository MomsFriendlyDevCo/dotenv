import dotenv from '#lib/dotenv';
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

		let config = dotenv
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

});
