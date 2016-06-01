
(function() {
"use strict";

window.sai = {};

function midiToFrequency(midiNote) {
    return 440 * Math.pow(Math.pow(2, 1/12), midiNote - 69);
};

function wait(context, callback, when) {
    var test = function() {
        var delta = when - context.currentTime;
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

sai.BaseNode = class BaseNode {
    constructor(context) {
        this._context = context;
    }
    get context() {
        return this._context;
    }
    connect(target) {
        this.output.connect(target);
    }
    disconnect(target) {
        this.output.disconnect(target);
    }
}

/*
    A note for unique usage.
*/
sai.Note = class Note extends sai.BaseNode {
    constructor(context, instrument, note) {
        super(context);
        this.instrument = instrument;
        this.noteGain = context.createGain();
        this.noteGain.gain.value = 0;
        
        this.sources = [];
        instrument.oscillators.forEach(function(oscillator) {
            var sourceGain = context.createGain();
            sourceGain.gain.value = oscillator.gain;
            sourceGain.connect(this.noteGain);
            var fOsc, fOscGain = null;
            if (oscillator.freqOsc) {
                var fOsc = context.createOscillator();
                var fOscGain = context.createGain();
                fOsc.connect(fOscGain);
                fOsc.type = oscillator.freqOsc.type;
                fOsc.frequency.value = oscillator.freqOsc.frequency;
                fOscGain.gain.value = midiToFrequency(note) * oscillator.freqOsc.amount;
                this.sources.push(fOsc);
            }
            if (oscillator.type === "noise") {
                var whiteNoise = context.createBufferSource();
                whiteNoise.buffer = noiseBuffer;
                whiteNoise.loop = true;    
                var noiseFilter = context.createBiquadFilter();
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
                var source = context.createOscillator();
                source.type = oscillator.type;
                source.frequency.value = midiToFrequency(note);
                source.connect(sourceGain);
                if (fOsc)
                    fOscGain.connect(source.frequency);
                this.sources.push(source);
            }
        }.bind(this));
        
        this.output = this.noteGain;
    }
    play(when, setEnd, endCallback) {
        when = when || this.context.currentTime;
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
    }
    end(when) {
        if (this.ended)
            return;
        this.ended = true;
        when = when || this.context.currentTime;
        when = Math.max(when, this.decayEnd);
        var t = when;
        var v = this.output.gain;
        v.setValueAtTime(this.instrument.sustainLevel, t);
        t += this.instrument.release;
        v.linearRampToValueAtTime(0, t);
        wait(this.context, function() {
            this.kill();
            if (this.endCallback)
                this.endCallback();
        }.bind(this), t);
    }
    kill() {
        this.sources.forEach(function(source) {
            source.stop();
        }.bind(this));
        this.output.disconnect();
    }
}

sai.Track = class Track extends sai.BaseNode {
    constructor(context, instrument) {
        super(context);
        
        this._input = context.createGain();
        
        var nodes = [this._input];
        instrument.filters.forEach(function(filter) {
            var node = context.createBiquadFilter();
            node.type = filter.type;
            nodes[nodes.length - 1].connect(node);
            nodes.push(node);
        });
        this.lastFilter = nodes[nodes.length - 1];
        this.filters = nodes.slice(1);
        
        this.pannerNode = this.context.createStereoPanner();
        this.lastFilter.connect(this.pannerNode);
        this.panOsc = this.context.createOscillator();
        this.panOscGain = this.context.createGain();
        this.panOsc.connect(this.panOscGain);
        this.panOscGain.connect(this.pannerNode.pan);
        this.panOsc.start();
        
        this.volumeGain = this.context.createGain();
        this.pannerNode.connect(this.volumeGain);
        
        this.delay = new sai.Delay(this.context);
        this.volumeGain.connect(this.delay.input);
        
        this.output = this.context.createGain();
        this.delay.connect(this.output);

        this.setInstrument(instrument);
    }
    setInstrument(instrument) {
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
        this.delay.gain = instrument.delay;
        this.delay.delayTime = instrument.delayTime;
    }
    playNote(note, when, setEnd, endCallback) {
        when = when || this.context.currentTime;
        setEnd = setEnd === undefined ? true : setEnd;
        var n = new sai.Note(this.context, this.instrument, note);
        n.connect(this._input);
        n.play(when, setEnd, endCallback);
        return n;
    }
    kill() {
        this.panOsc.stop();
    }
}

sai.Delay = class Delay extends sai.BaseNode {
    constructor(context) {
        super(context);
        this.input = this.context.createGain();
        
        this.delayGain = this.context.createGain();
        this.input.connect(this.delayGain);

        this.delay = this.context.createDelay();
        this.delayGain.connect(this.delay);
        this.delay.connect(this.delayGain);
        
        this.output = this.context.createGain();
        this.delay.connect(this.output);
        this.input.connect(this.output);
    }
    get gain() {
        return this.delayGain.gain.value;
    }
    set gain(val) {
        this.delayGain.gain.value = val;
    }
    get delayTime() {
        return this.delay.delayTime.value;
    }
    set delayTime(val) {
        this.delay.delayTime.value = val;
    }
}

})();
