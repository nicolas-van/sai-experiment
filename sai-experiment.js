
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
sai.Voice = class Voice extends sai.BaseNode {
    constructor(context) {
        super(context);
        this._note = 69;
        this.attack = 0.5;
        this.decay = 0.5;
        this.sustain = 0.5;
        this.release = 0.5;
        
        // oscillator 1
        this.osc1 = new sai.Oscillator(context);
        
        // oscillator 2
        this.osc2 = new sai.Oscillator(context);
        
        // oscillators mixer
        this.oscMixer = context.createGain();
        this.osc1.connect(this.oscMixer);
        this.osc2.connect(this.oscMixer);
        
        // filter
        //this.filter = context.createBiquadFilter();
        //this.oscMixer.connect(this.filter);
        
        // envelope gain
        this.envelope = context.createGain();
        //this.filter.connect(this.envelope);
        this.oscMixer.connect(this.envelope);
        
        // main gain
        this.output = context.createGain();
        this.envelope.connect(this.output);
        
        // lfo
        /*
        this.lfo = new sai.Oscillator(context);
        
        this.lfoOsc1Gain = context.createGain();
        this.lfoOsc1Gain.gain.value = 0;
        this.lfo.connect(this.lfoOsc1Gain);
        this.lfoOsc1Gain.connect(this.osc1.frequencyParam);
        
        this.lfoOsc2Gain = context.createGain();
        this.lfoOsc2Gain.gain.value = 0;
        this.lfo.connect(this.lfoOsc2Gain);
        this.lfoOsc2Gain.connect(this.osc2.frequencyParam);
        
        this.lfoFilterGain = context.createGain();
        this.lfoFilterGain.gain.value = 0;
        this.lfo.connect(this.lfoFilterGain);
        this.lfoFilterGain.connect(this.filter.frequency);
        */
    }
    start(when) {
        when = when || this.context.currentTime;
        this.startTime = when;
        var t  = when;
        this.envelope.gain.setValueAtTime(0, t);
        t += this.attack;
        this.envelope.gain.linearRampToValueAtTime(1, t);
        t += this.decay;
        this.envelope.gain.linearRampToValueAtTime(this.sustain, t);
        this.osc1.start(when);
        this.osc2.start(when);
        //this.lfo.start(when);
    }
    stop(when) {
        when = when || this.context.currentTime;
        var t = when;
        this.envelope.gain.cancelScheduledValues(t);
        t += this.release;
        this.envelope.gain.linearRampToValueAtTime(0, t);
        this.osc1.stop(t);
        this.osc2.stop(t);
        //this.lfo.stop(t);
    }
    get note() {
        return this._note;
    }
    set note(val) {
        this._note = val;
        this.osc1.frequency.value = midiToFrequency(val);
        this.osc2.frequency.value = midiToFrequency(val);
    }
    get osc1Type() {
        return this.osc1.type;
    }
    set osc1Type(val) {
        this.osc1.type = val;
    }
    get osc1Gain() {
        return this.osc1.gain;
    }
    get osc2Type() {
        return this.osc2.type;
    }
    set osc2Type(val) {
        this.osc2.type = val;
    }
    get osc2Gain() {
        return this.osc2.gain;
    }
}

sai.Track = class Track extends sai.BaseNode {
    constructor(context) {
        super(context);
        
        this._mixer = context.createGain();
        
        this._voices = {};
        
        this.output = this.context.createGain();
        this._mixer.connect(this.output);
        
        this._voices = {};
        
        this.osc1Type = "sine";
        this.osc1Gain = 1;
        this.osc2Type = "sine";
        this.osc2Gain = 1;
        this.gain = 1;
    }
    midiMessage(message) {
        if (message.cmd === sai.MidiMessage.commands.noteOn) {
            if (this._voices[message.note])
                return;
            var voice = new sai.Voice(this.context);
            this._voices[message.note] = voice;
            voice.note = message.note;
            voice.osc1Type = this.osc1Type;
            voice.osc2Type = this.osc2Type;
            voice.osc1Gain.value = this.osc1Gain;
            voice.osc2Gain.value = this.osc2Gain;
            voice.connect(this._mixer);
            voice.start();
        } else if (message.cmd === sai.MidiMessage.commands.noteOff) {
            if (! this._voices[message.note])
                return;
            this._voices[message.note].stop();
            delete this._voices[message.note];
        }
    }
    get osc1Type() {
        return this._osc1Type;
    }
    set osc1Type(val) {
        this._osc1Type = val;
        _.each(this._voices, (v) => v.osc1Type = val);
    }
    get osc1Gain() {
        return this._osc1Gain;
    }
    set osc1Gain(val) {
        this._osc1Gain = val;
        _.each(this._voices, (v) => v.osc1Gain = val);
    }
    get osc2Type() {
        return this._osc2Type;
    }
    set osc2Type(val) {
        this._osc2Type = val;
        _.each(this._voices, (v) => v.osc2Type = val);
    }
    get osc2Gain() {
        return this._osc2Gain;
    }
    set osc2Gain(val) {
        this._osc2Gain = val;
        _.each(this._voices, (v) => v.osc2Gain = val);
    }
    get gain() {
        return this.output.gain.value;
    }
    set gain(val) {
        this.output.gain.value = val;
    }
}

sai.Oscillator = class Oscillator extends sai.BaseNode {
    constructor(context) {
        super(context);
        
        this._type = "sine";
        
        this.osc = context.createOscillator();
        this.oscOutput = context.createGain();
        this.osc.connect(this.oscOutput);
        
        this.whiteNoise = context.createBufferSource();
        this.whiteNoise.buffer = noiseBuffer;
        this.whiteNoise.loop = true;
        this.whiteNoiseOutput = context.createGain();
        this.whiteNoiseOutput.gain.value = 0;
        this.whiteNoise.connect(this.whiteNoiseOutput);
        
        this.output = context.createGain();
        this.oscOutput.connect(this.output);
        this.whiteNoiseOutput.connect(this.output);
    }
    start(when) {
        this.osc.start(when);
        this.whiteNoise.start(when);
    }
    stop(when) {
        this.osc.stop(when);
        this.whiteNoise.stop(when);
    }
    get type() {
        return this._type;
    }
    set type(val) {
        this._type = val;
        if (this._type === "noise") {
            this.whiteNoiseOutput.gain.value = 1;
            this.oscOutput.gain.value = 0;
            this.osc.type = "sine";
        } else {
            this.whiteNoiseOutput.gain.value = 0;
            this.oscOutput.gain.value = 1;
            this.osc.type = this._type;
        }
    }
    get frequency() {
        return this.osc.frequency;
    }
    get gain() {
        return this.output.gain;
    }
}

sai.MidiMessage = class MidiMessage {
    constructor(data) {
        this.cmd = data ? data[0] >> 4 : 0;
        this.channel = data ? data[0] & 0xf : 0;
        this.type = data ? data[0] & 0xf0 : 0;
        this.note = data ? data[1] : 0;
        this.velocity = data ? data[2] : 0;
    }
    get cmdString() {
        return _.findKey(sai.MidiMessage.commands, (x) => x === this.cmd);
    }
}

sai.MidiMessage.commands = {
    noteOff: 0x8,
    noteOn: 0x9,
    polyphonicKeyPressure: 0xA,
    controlChange: 0xB,
    programChange: 0xC,
    channelPressure: 0xD,
    pitchBendChange: 0xE,
};

})();
