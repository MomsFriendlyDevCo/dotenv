import {Schema} from '#lib/schema';
import {expect} from 'chai';

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
