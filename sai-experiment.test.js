
import 'web-audio-test-api';
import * as sai from './src/sai-experiment.js';

test('exports', () => {
  expect(sai.wait).toBeDefined();
  expect(sai.BaseNode).toBeDefined();
  expect(sai.Voice).toBeDefined();
  expect(sai.Track).toBeDefined();
  expect(sai.Oscillator).toBeDefined();
  expect(sai.Envelope).toBeDefined();
  expect(sai.MidiMessage).toBeDefined();
});
