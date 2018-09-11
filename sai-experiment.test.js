
require('web-audio-test-api');
var sai = require('./dist/sai-experiment.bundle.js');

test('exports', () => {
  expect(sai.wait).toBeDefined();
  expect(sai.BaseNode).toBeDefined();
  expect(sai.Voice).toBeDefined();
  expect(sai.Track).toBeDefined();
  expect(sai.Oscillator).toBeDefined();
  expect(sai.Envelope).toBeDefined();
  expect(sai.MidiMessage).toBeDefined();
});
