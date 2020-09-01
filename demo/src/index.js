
// import some polyfill to ensure everything works OK
import 'core-js/stable'
import 'regenerator-runtime/runtime'

// import bootstrap's javascript part
import 'bootstrap'

// import font awesome fonts
import '@fortawesome/fontawesome-free/css/all.css'

import * as sai from '../src/sai-experiment'

console.log('loading track')

const audioCtx = new AudioContext()
const instrument = {
  oscillators: [
    {
      type: 'sine',
      gain: 1,
      freqOsc: {
        type: 'sine',
        amount: 0,
        frequency: 10
      }
    }
  ],
  filters: [
    {
      type: 'highpass',
      frequency: 0,
      gain: 0,
      q: 1000
    }
  ],
  attack: 0.05,
  decay: 0.05,
  sustainLevel: 0.5,
  sustainTime: 0.2,
  release: 0.1,
  gain: 0.2,

  noise: 0,
  delay: 0,
  delayTime: 0.3,
  panAmount: 0,
  panFrequency: 2
}
const t = new sai.Track(audioCtx, instrument)
t.output.connect(audioCtx.destination)

console.log('trying to get midi access')
window.navigator.requestMIDIAccess().then(function (midiAccess) {
  console.log('midi access granted')
  const inputs = midiAccess.inputs.values()
  for (let input = inputs.next(); input && !input.done; input = inputs.next()) {
    input.value.onmidimessage = receiveMessage
  }
})

const receiveMessage = function (mm) {
  const message = new sai.MidiMessage(mm.data)
  console.log(message)
  t.midiMessage(message)
}
