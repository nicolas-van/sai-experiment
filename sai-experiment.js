
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
        var source = audioCtx.createOscillator();
        source.type = oscillator.type;
        source.frequency.value = midiToFrequency(note);
        var sourceGain = audioCtx.createGain();
        sourceGain.gain.value = oscillator.gain;
        source.connect(sourceGain);
        sourceGain.connect(this.noteGain);
        this.sources.push(source);
    }.bind(this));
    
    var whiteNoise = audioCtx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;
    var noiseGain = audioCtx.createGain();
    noiseGain.gain.value = instrument.noise;
    whiteNoise.connect(noiseGain);
    noiseGain.connect(this.noteGain);
    this.sources.push(whiteNoise);
    
    this.output = this.noteGain;
};
sai.Note.prototype.play = function(when, endCallback) {
    this.when = when;
    var t  = when;
    var v = this.output.gain;
    v.setValueAtTime(0, t);
    t += this.instrument.attack;
    v.linearRampToValueAtTime(1, t);
    t += this.instrument.sustain;
    v.setValueAtTime(1, t);
    t += this.instrument.release;
    v.linearRampToValueAtTime(0, t);
    this.sources.forEach(function(source) {
        source.start();
    }.bind(this));
    wait(this.audioCtx, function() {
        this.kill();
        if (endCallback)
            endCallback();
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
    this.instrument = instrument;
    
    this.input = audioCtx.createGain();
    
    var nodes = [this.input];
    instrument.filters.forEach(function(filter) {
        var node = audioCtx.createBiquadFilter();
        node.type = filter.type;
        node.frequency.value = filter.frequency;
        node.gain.value = filter.gain;
        nodes[nodes.length - 1].connect(node);
        nodes.push(node);
    });
    var last = nodes[nodes.length - 1];
    
    var pannerNode = this.audioCtx.createStereoPanner();
    last.connect(pannerNode);
    this.killed = false;
    var current = audioCtx.currentTime;
    pannerNode.pan.setValueAtTime(instrument.panAmount, current);
    current += instrument.panTime;
    var phase = -1;
    var calcPan = function() {
        if (this.killed)
            return;
        var orig = current;
        while (current <= orig + 5) {
            pannerNode.pan.linearRampToValueAtTime(phase * instrument.panAmount, current);
            current += instrument.panTime;
            phase = - phase;
        }
        wait(audioCtx, calcPan, current - 2.5);
    }.bind(this);
    calcPan();
    
    var volumeGain = this.audioCtx.createGain();
    volumeGain.gain.value = instrument.gain;
    pannerNode.connect(volumeGain);
    
    var delayGain = this.audioCtx.createGain();
    delayGain.gain.value = instrument.delay;
    volumeGain.connect(delayGain);

    var delay = this.audioCtx.createDelay();
    delay.delayTime.value = instrument.delayTime;
    delayGain.connect(delay);
    delay.connect(delayGain);

    var mixer = this.audioCtx.createGain();
    volumeGain.connect(mixer);
    delay.connect(mixer);
    
    this.output = mixer;
};
sai.Track.prototype.playNote = function(note, when, endCallback) {
    when = when || this.audioCtx.currentTime;
    var n = new sai.Note(this.audioCtx, this.instrument, note);
    n.output.connect(this.input);
    n.play(when, endCallback);
    return n;
};
sai.Track.prototype.kill = function() {
    this.killed = true;
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
        }.bind(this), ab + this.song.duration);
};
sai.TrackPlayer.prototype.stop = function() {
    if (this.job.lastNote)
        this.job.lastNote.kill();
    this.job.stopping = true;
    this.state = "stopped";
};

})();
