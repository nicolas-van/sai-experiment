
(function() {
"use strict";

window.sai = {};

function midiToFrequency(midiNote) {
    return 440 * Math.pow(Math.pow(2, 1/12), midiNote - 69);
};

sai.Note = function(audioCtx, instrument, note) {
    this.audioCtx = audioCtx;
    this.instrument = instrument;
    this.noteGain = audioCtx.createGain();
    this.noteGain.gain.value = 0;
    
    this.sources = [];
    instrument.oscillators.forEach(function(oscillator) {
        var source = audioCtx.createOscillator();
        source.type = oscillator.type;
        source.frequency.value = midiToFrequency(note);
        var sourceGain = audioCtx.createGain();
        sourceGain.gain.value = oscillator.gain;
        source.connect(sourceGain);
        sourceGain.connect(this.noteGain);
        this.sources.push(source);
    }.bind(this));
    
    this.output = this.noteGain;
};
sai.Note.prototype.play = function(when) {
    var t  = when;
    var v = this.output.gain;
    v.setValueAtTime(0, t);
    t += this.instrument.attack;
    v.linearRampToValueAtTime(this.instrument.gain, t);
    t += this.instrument.sustain;
    v.setValueAtTime(this.instrument.gain, t);
    t += this.instrument.release;
    v.linearRampToValueAtTime(0, t);
    this.sources.forEach(function(source) {
        source.start();
    }.bind(this));
};

sai.Track = function(audioCtx, instrument) {
    this.audioCtx = audioCtx;
    this.instrument = instrument;
    
    this.input = audioCtx.createGain();
    
    this.output = this.input;
};
sai.Track.prototype.playNote = function(note, when) {
    var n = new sai.Note(this.audioCtx, this.instrument, note);
    n.output.connect(this.input);
    n.play(when);
};

})();
