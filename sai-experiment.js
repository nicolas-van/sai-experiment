
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
    
    this.output = this.noteGain;
};
sai.Note.prototype.play = function(when, endCallback) {
    this.when = when;
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
    
    this.output = this.input;
};
sai.Track.prototype.playNote = function(note, when, endCallback) {
    when = when || this.audioCtx.currentTime;
    var n = new sai.Note(this.audioCtx, this.instrument, note);
    n.output.connect(this.input);
    n.play(when, endCallback);
    return n;
};

sai.TrackPlayer = function(track, song) {
    this.track = track;
    this.song = song;
    this.state = "stopped";
    this.job = {};
};
sai.TrackPlayer.prototype.playTrack = function(repeat) {
    if (this.state !== "stopped")
        return;
    this.state = "playing";
    var job = {};
    this.job = job;
    var begin = this.track.audioCtx.currentTime;
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
