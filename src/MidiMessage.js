
// generating conversion tables for notes
const baseNotes = [
  ['C'],
  ['C#', 'Db'],
  ['D'],
  ['D#', 'Eb'],
  ['E'],
  ['F'],
  ['F#', 'Gb'],
  ['G'],
  ['G#', 'Ab'],
  ['A'],
  ['A#', 'Bb'],
  ['B']
]
const genNoteBaseNames = (nbr) => baseNotes[nbr % 12]
const genNoteOctave = (nbr) => Math.floor(nbr / 12) - 1
const genNoteNames = (nbr) => genNoteBaseNames(nbr).map((el) => el + genNoteOctave(nbr))
const notes = []
const inotes = {}
for (let i = 0; i <= 127; i += 1) {
  const names = genNoteNames(i)
  notes.push(names)
  for (const el of names) {
    inotes[el] = i
  }
}

export default class MidiMessage {
  constructor (data) {
    this.data = data ? this.data : new Uint8Array(3)
  }

  static midiNoteToName (nbr) {
    return notes[nbr][0]
  }

  static nameToMidiNote (name) {
    return inotes[name]
  }

  static midiToFrequency (midiNote) {
    return 440 * Math.pow(Math.pow(2, 1 / 12), midiNote - 69)
  }

  get cmd () {
    return this.data[0] >> 4
  }

  set cmd (val) {
    this.data[0] = (val << 4) | (this.data[0] & 0xf0)
  }

  get cmdString () {
    return _.findKey(MidiMessage.commands, (x) => x === this.cmd)
  }

  get channel () {
    return this.data[0] & 0x0f
  }

  set channel (val) {
    this.data[0] = (val & 0x0f) | (this.data[0] & 0xf0)
  }

  get type () {
    return this.data[0] & 0xf0
  }

  set type (val) {
    this.data[0] = (val & 0xf0) | (this.data[0] & 0x0f)
  }

  get note () {
    return this.data[1]
  }

  set note (val) {
    this.data[1] = val
  }

  get velocity () {
    return this.data[2]
  }

  set velocity (val) {
    this.data[2] = val
  }

  get pitchBend () {
    return (this.data[2] << 7) + (this.data[1])
  }
}

MidiMessage.noteNames = notes

MidiMessage.commands = {
  noteOff: 0x8,
  noteOn: 0x9,
  polyphonicKeyPressure: 0xA,
  controlChange: 0xB,
  programChange: 0xC,
  channelPressure: 0xD,
  pitchBendChange: 0xE
}

MidiMessage.controls = {
  sustain: 64
}
