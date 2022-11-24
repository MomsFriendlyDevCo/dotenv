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

});
