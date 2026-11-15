import assert from 'node:assert';
import { ll2xy, xy2ll, sunFrac, rankWin, tIndex, tDate } from '../web/js/data.js';

console.log('Running JS unit tests...');

// 1. Polar stereographic projection round-trip
const [x, y] = ll2xy(-89.9, 45.0);
const [lat2, lon2] = xy2ll(x, y);
assert(Math.abs(lat2 - (-89.9)) < 1e-4, 'Latitude mismatch in roundtrip');
assert(Math.abs(lon2 - 45.0) < 1e-4, 'Longitude mismatch in roundtrip');
console.log('✓ Polar stereographic projection round-trip passed');

// 2. Solar fraction calculations
assert.strictEqual(sunFrac(1.0, 1.0), 0.5, 'Sun half disc on horizon should be 0.5');
assert.strictEqual(sunFrac(2.0, 1.0), 1.0, 'Sun full disc above horizon should be 1.0');
assert.strictEqual(sunFrac(0.0, 1.0), 0.0, 'Sun full disc below horizon should be 0.0');
console.log('✓ Sun fraction math passed');

// 3. rankWin comparator
const winA = { score: 0.95, margin: 2.1, a: 100 };
const winB = { score: 0.85, margin: 3.5, a: 200 };
const winC = { score: 0.95, margin: 3.0, a: 150 };
assert(rankWin(winA, winB) < 0, 'Higher score should rank first');
assert(rankWin(winC, winA) < 0, 'Equal score with higher margin should rank first');
console.log('✓ Window ranking comparator passed');

console.log('All JS science unit tests passed successfully!');
