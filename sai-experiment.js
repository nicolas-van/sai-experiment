
(function() {
"use strict";

window.sai = {};

function midiToFrequency(midiNote) {
    return 440 * Math.pow(Math.pow(2, 1/12), midiNote - 69);
};

function wait(audioCtx, callback, when) {
    var test = function() {
        var delta = when - audioCtx.currentTime;
        if (delta <= 0) {
            callback();
        } else {
            setTimeout(test, delta * 1000);
        }
    };
    test();
};
sai.wait = wait;

var offCtx = new OfflineAudioContext(1, 44100, 44100);
var noiseBuffer = offCtx.createBuffer(1, 44100, 44100);
for (var i = 0; i < noiseBuffer.getChannelData(0).length; i++) {
    noiseBuffer.getChannelData(0)[i] = Math.random() * 2 - 1;
}

/*
    A note for unique usage.
*/
sai.Note = function(audioCtx, instrument, note) {
    this.audioCtx = audioCtx;
    this.instrument = instrument;
    this.noteGain = audioCtx.createGain();
    this.noteGain.gain.value = 0;
    
    this.sources = [];
    instrument.oscillators.forEach(function(oscillator) {
        var sourceGain = audioCtx.createGain();
        sourceGain.gain.value = oscillator.gain;
        sourceGain.connect(this.noteGain);
        var fOsc, fOscGain = null;
        if (oscillator.freqOsc) {
            var fOsc = audioCtx.createOscillator();
            var fOscGain = audioCtx.createGain();
            fOsc.connect(fOscGain);
            fOsc.type = oscillator.freqOsc.type;
            fOsc.frequency.value = oscillator.freqOsc.frequency;
            fOscGain.gain.value = midiToFrequency(note) * oscillator.freqOsc.amount;
            this.sources.push(fOsc);
        }
        if (oscillator.type === "noise") {
            var whiteNoise = audioCtx.createBufferSource();
            whiteNoise.buffer = noiseBuffer;
            whiteNoise.loop = true;    
            var noiseFilter = audioCtx.createBiquadFilter();
            noiseFilter.type = "bandpass";
            noiseFilter.frequency.value = midiToFrequency(note);
            whiteNoise.connect(noiseFilter);
            // compensation of gain to make it more audible on low notes
            sourceGain.gain.value *= 1 + (( -(note - 69)) / (12 * 4));
            noiseFilter.connect(sourceGain);
            if (fOsc)
                fOscGain.connect(noiseFilter.frequency);
            this.sources.push(whiteNoise);
        } else {
            var source = audioCtx.createOscillator();
            source.type = oscillator.type;
            source.frequency.value = midiToFrequency(note);
            source.connect(sourceGain);
            if (fOsc)
                fOscGain.connect(source.frequency);
            this.sources.push(source);
        }
    }.bind(this));
    
    this.output = this.noteGain;
};
sai.Note.prototype.play = function(when, setEnd, endCallback) {
    when = when || this.audioCtx.currentTime;
    setEnd = setEnd === undefined ? true : setEnd;
    this.when = when;
    var t  = when;
    var v = this.output.gain;
    v.setValueAtTime(0, t);
    t += this.instrument.attack;
    v.linearRampToValueAtTime(1, t);
    t += this.instrument.decay;
    v.linearRampToValueAtTime(this.instrument.sustainLevel, t);
    this.decayEnd = t;
    this.endCallback = endCallback;
    if (setEnd) {
        this.end(t + this.instrument.sustainTime);
    }
    this.sources.forEach(function(source) {
        source.start();
    }.bind(this));
};
sai.Note.prototype.end = function(when) {
    if (this.ended)
        return;
    this.ended = true;
    when = when || this.audioCtx.currentTime;
    when = Math.max(when, this.decayEnd);
    var t = when;
    var v = this.output.gain;
    v.setValueAtTime(this.instrument.sustainLevel, t);
    t += this.instrument.release;
    v.linearRampToValueAtTime(0, t);
    wait(this.audioCtx, function() {
        this.kill();
        if (this.endCallback)
            this.endCallback();
    }.bind(this), t);
};
sai.Note.prototype.kill = function() {
    this.sources.forEach(function(source) {
        source.stop();
    }.bind(this));
    this.output.disconnect();
};

sai.Track = function(audioCtx, instrument) {
    this.audioCtx = audioCtx;
    
    this.input = audioCtx.createGain();
    
    var nodes = [this.input];
    instrument.filters.forEach(function(filter) {
        var node = audioCtx.createBiquadFilter();
        node.type = filter.type;
        nodes[nodes.length - 1].connect(node);
        nodes.push(node);
    });
    this.lastFilter = nodes[nodes.length - 1];
    this.filters = nodes.slice(1);
    
    this.pannerNode = this.audioCtx.createStereoPanner();
    this.lastFilter.connect(this.pannerNode);
    this.panOsc = this.audioCtx.createOscillator();
    this.panOscGain = this.audioCtx.createGain();
    this.panOsc.connect(this.panOscGain);
    this.panOscGain.connect(this.pannerNode.pan);
    this.panOsc.start();
    
    this.volumeGain = this.audioCtx.createGain();
    this.pannerNode.connect(this.volumeGain);
    
    this.delayGain = this.audioCtx.createGain();
    this.volumeGain.connect(this.delayGain);

    this.delay = this.audioCtx.createDelay();
    this.delayGain.connect(this.delay);
    this.delay.connect(this.delayGain);

    this.mixer = this.audioCtx.createGain();
    this.volumeGain.connect(this.mixer);
    this.delay.connect(this.mixer);
    
    this.output = this.mixer;

    this.setInstrument(instrument);
};
sai.Track.prototype.setInstrument = function(instrument) {
    this.instrument = instrument;
    for (var i = 0; i < this.filters.length && i < instrument.filters.length; i++) {
        if (i >= instrument.filters.length)
            return;
        this.filters[i].frequency.value = instrument.filters[i].frequency;
        this.filters[i].gain.value = instrument.filters[i].gain;
        this.filters[i].Q.value = instrument.filters[i].q;
    }
    this.panOsc.frequency.value = instrument.panFrequency;
    this.panOscGain.gain.value = instrument.panAmount;
    this.volumeGain.gain.value = instrument.gain;
    this.delayGain.gain.value = instrument.delay;
    this.delay.delayTime.value = instrument.delayTime;
};
sai.Track.prototype.playNote = function(note, when, setEnd, endCallback) {
    when = when || this.audioCtx.currentTime;
    setEnd = setEnd === undefined ? true : setEnd;
    var n = new sai.Note(this.audioCtx, this.instrument, note);
    n.output.connect(this.input);
    n.play(when, setEnd, endCallback);
    return n;
};
sai.Track.prototype.kill = function() {
    this.panOsc.stop();
};

sai.TrackPlayer = function(track, song) {
    this.track = track;
    this.song = song;
    this.state = "stopped";
    this.job = {};
};
sai.TrackPlayer.prototype.playTrack = function(repeat, when) {
    if (this.state !== "stopped")
        return;
    this.state = "playing";
    var job = {};
    this.job = job;
    var begin = when || this.track.audioCtx.currentTime;
    var current = 0;
    var notes = this.song.notes;
    var handleNote = function() {
        if (job.stopping)
            return;
        if (current >= notes.length) {
            if (repeat) {
                current = 0;
                begin = begin + this.song.duration;
            } else
                return;
        }
        var noteTime = begin + notes[current][0];
        job.lastNote = this.track.playNote(notes[current][1], noteTime);
        current += 1;
        wait(this.track.audioCtx, handleNote, noteTime);
    }.bind(this);
    handleNote();
    if (! repeat)
        wait(this.track.audioCtx, function() {
            if (job.stopping)
                return;
            this.state = "stopped";
        }.bind(this), begin + this.song.duration);
};
sai.TrackPlayer.prototype.stop = function() {
    if (this.job.lastNote)
        this.job.lastNote.kill();
    this.job.stopping = true;
    this.state = "stopped";
};

})();
