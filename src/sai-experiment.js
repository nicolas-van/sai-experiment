
import _ from 'lodash';

function midiToFrequency(midiNote) {
    return 440 * Math.pow(Math.pow(2, 1/12), midiNote - 69);
}

export function wait(context, callback, when) {
    var test = function() {
        var delta = when - context.currentTime;
        if (delta <= 0) {
            callback();
        } else {
            setTimeout(test, delta * 1000);
        }
    };
    test();
}

var offCtx = new OfflineAudioContext(1, 44100, 44100);
var noiseBuffer = offCtx.createBuffer(1, 44100, 44100);
for (var i = 0; i < noiseBuffer.getChannelData(0).length; i++) {
    noiseBuffer.getChannelData(0)[i] = Math.random() * 2 - 1;
}

export class BaseNode {
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
export class Voice extends BaseNode {
    constructor(context) {
        super(context);
        this._frequency = 440;
        this._detune = 0;
        
        // oscillator 1
        this.osc1 = new Oscillator(context);
        
        // oscillator 2
        this.osc2 = new Oscillator(context);
        
        // oscillators mixer
        this.oscMixer = context.createGain();
        this.osc1.connect(this.oscMixer);
        this.osc2.connect(this.oscMixer);
        
        // filter
        this._filter = context.createBiquadFilter();
        this.oscMixer.connect(this._filter);
        
        // envelope gain
        this._envelope = new Envelope(this.context);
        this._filter.connect(this.envelope.input);
        
        // velocity gain
        this.velocityGain = context.createGain();
        this.envelope.connect(this.velocityGain);
        
        // main gain
        this.output = context.createGain();
        this.velocityGain.connect(this.output);
        
        // lfo
        this._lfo = new Oscillator(context);
        this._lfo.frequency.value = 1;
        
        this._lfoGain = context.createGain();
        this._lfoGain.gain.value = 0;
        this._lfo.connect(this._lfoGain);
        
        this._lfoOsc1Gain = context.createGain();
        this._lfoOsc1Gain.gain.value = 0;
        this._lfoGain.connect(this._lfoOsc1Gain);
        this._lfoOsc1Gain.connect(this.osc1.frequency);
        
        this._lfoOsc2Gain = context.createGain();
        this._lfoOsc2Gain.gain.value = 0;
        this._lfoGain.connect(this._lfoOsc2Gain);
        this._lfoOsc2Gain.connect(this.osc2.frequency);
        
        this._lfoFilterGain = context.createGain();
        this._lfoFilterGain.gain.value = 0;
        this._lfoGain.connect(this._lfoFilterGain);
        this._lfoFilterGain.connect(this._filter.frequency);
    }
    start(when) {
        when = when || this.context.currentTime;
        this.envelope.start(when);
        this.osc1.start(when);
        this.osc2.start(when);
        this._lfo.start(when);
    }
    stop(when) {
        when = when || this.context.currentTime;
        var t = this.envelope.stop(when);
        this.osc1.stop(t);
        this.osc2.stop(t);
        this._lfo.stop(t);
    }
    get frequency() {
        return this._frequency;
    }
    set frequency(val) {
        this._frequency = val;
        this._updateFrequency();
    }
    _updateFrequency() {
        this.osc1.frequency.value = this.frequency;
        this.osc2.frequency.value = this.frequency;
        this._filter.frequency.value = this.frequency;
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
    get envelope() {
        return this._envelope;
    }
    get velocity() {
        return this.velocityGain.gain;
    }
    get lfoType() {
        return this._lfo.type;
    }
    set lfoType(val) {
        this._lfo.type = val;
    }
    get lfoFrequency() {
        return this._lfo.frequency;
    }
    get lfoGain() {
        return this._lfoGain.gain;
    }
    get lfoOsc1Gain() {
        return this._lfoOsc1Gain.gain;
    }
    get lfoOsc2Gain() {
        return this._lfoOsc2Gain.gain;
    }
    get lfoFilterGain() {
        return this._lfoFilterGain.gain;
    }
    get filterType() {
        return this._filter.type;
    }
    set filterType(val) {
        this._filter.type = val;
    }
    get filterDetune() {
        return this._filter.detune;
    }
    get filterQ() {
        return this._filter.Q;
    }
    get filterGain() {
        return this._filter.gain;
    }
}

export class Track extends BaseNode {
    constructor(context) {
        super(context);
        
        this._mixer = context.createGain();
        
        this._voices = new Map();
        
        this.output = this.context.createGain();
        this._mixer.connect(this.output);
        
        this.osc1Type = "sine";
        this.osc1Gain = 0.25;
        this.osc2Type = "sine";
        this.osc2Gain = 0.25;
        this.gain = 0.5;
        this._sustainOn = false;
        this._sustained = new Map();
        this._pitchBend = 0;
        this._pitchBendMaxAmount = 2;
        this._attack = 0.1;
        this._decay = 0.1;
        this._sustain = 1;
        this._release = 0.1;
        this._lfoType = "sine";
        this._lfoFrequency = 1;
        this._lfoGain = 0;
        this._lfoOsc1Gain = 0;
        this._lfoOsc2Gain = 0;
        this._lfoFilterGain = 0;
        this._filterType = "highpass";
        this._filterDetune = 0;
        this._filterQ = 1;
        this._filterGain = 0;
    }
    midiMessage(message) {
        if (message.cmd === MidiMessage.commands.noteOn) {
            this._noteOn(message);
        } else if (message.cmd === MidiMessage.commands.noteOff) {
            this._noteOff(message);
        } else if (message.cmd === MidiMessage.commands.controlChange) {
            if (message.note === MidiMessage.controls.sustain) {
                this._sustainChange(message);
            }
        } else if (message.cmd === MidiMessage.commands.pitchBendChange) {
            this._pitchBendChange(message);
        }
    }
    _noteOn(message) {
        if (this._voices.get(message.note)) {
            this._noteOff(message, true);
        }
        var voice = new Voice(this.context);
        this._voices.set(message.note, voice);
        this._sustained.delete(message.note);
        voice.frequency = midiToFrequency(message.note + (this._pitchBend * this._pitchBendMaxAmount));
        voice.osc1Type = this.osc1Type;
        voice.osc2Type = this.osc2Type;
        voice.osc1Gain.value = this.osc1Gain;
        voice.osc2Gain.value = this.osc2Gain;
        voice.velocity.value = message.velocity / 127;
        voice.envelope.attack = this.attack;
        voice.envelope.decay = this.decay;
        voice.envelope.sustain = this.sustain;
        voice.envelope.release = this.release;
        voice.lfoType = this.lfoType;
        voice.lfoFrequency.value = this.lfoFrequency;
        voice.lfoGain.value = this.lfoGain;
        voice.lfoOsc1Gain.value = this.lfoOsc1Gain;
        voice.lfoOsc2Gain.value = this.lfoOsc2Gain;
        voice.lfoFilterGain.value = this.lfoFilterGain;
        voice.filterType = this.filterType;
        voice.filterDetune.value = this.filterDetune;
        voice.filterQ.value = this.filterQ;
        voice.filterGain.value = this.filterGain;
        voice.connect(this._mixer);
        voice.start();
    }
    _noteOff(message, force) {
        if (! this._voices.get(message.note))
            return;
        if (! this._sustainOn || force) {
            var voice = this._voices.get(message.note);
            voice.stop();
            this._voices.delete(message.note);
        } else {
            this._sustained.set(message.note, true);
        }
    }
    _sustainChange(message) {
        this._sustainOn = message.velocity === 0 ? false : true;
        if (! this._sustainOn) {
            this._sustained.forEach(function(val, key) {
                if (this._voices.get(key)) {
                    var mes = new MidiMessage();
                    mes.note = key;
                    this._noteOff(mes);
                }
            }.bind(this));
            this._sustained = new Map();
        }
    }
    _pitchBendChange(message) {
        var max = Math.pow(2, 14) - 1;
        this._pitchBend = Math.round((((message.pitchBend / max) * 2) - 1) * 1000) / 1000;
        this._voices.forEach((v, k) =>
            v.frequency = midiToFrequency(parseInt(k) + (this._pitchBend * this._pitchBendMaxAmount)));
    }
    get osc1Type() {
        return this._osc1Type;
    }
    set osc1Type(val) {
        this._osc1Type = val;
        this._voices.forEach((v) => v.osc1Type = val);
    }
    get osc1Gain() {
        return this._osc1Gain;
    }
    set osc1Gain(val) {
        this._osc1Gain = val;
        this._voices.forEach((v) => v.osc1Gain.value = val);
    }
    get osc2Type() {
        return this._osc2Type;
    }
    set osc2Type(val) {
        this._osc2Type = val;
        this._voices.forEach((v) => v.osc2Type = val);
    }
    get osc2Gain() {
        return this._osc2Gain;
    }
    set osc2Gain(val) {
        this._osc2Gain = val;
        this._voices.forEach((v) => v.osc2Gain.value = val);
    }
    get gain() {
        return this.output.gain.value;
    }
    set gain(val) {
        this.output.gain.value = val;
    }
    get attack() {
        return this._attack;
    }
    set attack(val) {
        this._attack = val;
    }
    get decay() {
        return this._decay;
    }
    set decay(val) {
        this._decay = val;
    }
    get sustain() {
        return this._sustain;
    }
    set sustain(val) {
        this._sustain = val;
    }
    get release() {
        return this._release;
    }
    set release(val) {
        this._release = val;
    }
    get lfoType() {
        return this._lfoType;
    }
    set lfoType(val) {
        this._lfoType = val;
        this._voices.forEach((v) => v.lfoType = val);
    }
    get lfoFrequency() {
        return this._lfoFrequency;
    }
    set lfoFrequency(val) {
        this._lfoFrequency = val;
        this._voices.forEach((v) => v.lfoFrequency.value = val);
    }
    get lfoGain() {
        return this._lfoGain;
    }
    set lfoGain(val) {
        this._lfoGain = val;
        this._voices.forEach((v) => v.lfoGain.value = val);
    }
    get lfoOsc1Gain() {
        return this._lfoOsc1Gain;
    }
    set lfoOsc1Gain(val) {
        this._lfoOsc1Gain = val;
        this._voices.forEach((v) => v.lfoOsc1Gain.value = val);
    }
    get lfoOsc2Gain() {
        return this._lfoOsc2Gain;
    }
    set lfoOsc2Gain(val) {
        this._lfoOsc2Gain = val;
        this._voices.forEach((v) => v.lfoOsc2Gain.value = val);
    }
    get lfoFilterGain() {
        return this._lfoFilterGain;
    }
    set lfoFilterGain(val) {
        this._lfoFilterGain = val;
        this._voices.forEach((v) => v.lfoFilterGain.value = val);
    }
    get filterType() {
        return this._filterType;
    }
    set filterType(val) {
        this._filterType = val;
        this._voices.forEach((v) => v.filterType = val);
    }
    get filterDetune() {
        return this._filterDetune;
    }
    set filterDetune(val) {
        this._filterDetune = val;
        this._voices.forEach((v) => v.filterDetune.value = val);
    }
    get filterQ() {
        return this._filterQ;
    }
    set filterQ(val) {
        this._filterQ = val;
        this._voices.forEach((v) => v.filterQ.value = val);
    }
    get filterGain() {
        return this._filterGain;
    }
    set filterGain(val) {
        this._filterGain = val;
        this._voices.forEach((v) => v.filterGain.value = val);
    }
}

export class Oscillator extends BaseNode {
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

export class Envelope extends BaseNode {
    constructor(context) {
        super(context);
        this.input = context.createGain();
        this.output = this.input;
        this.input.gain.value = 0;
        
        this.attack = 0;
        this.decay = 0;
        this.sustain = 1;
        this.release = 0;
        this._startTime = null;
    }
    start(when) {
        when = when || this.context.currentTime;
        this._startTime = when;
        var t  = when;
        this.input.gain.setValueAtTime(0, t);
        t += this.attack;
        this.input.gain.linearRampToValueAtTime(1, t);
        t += this.decay;
        this.input.gain.linearRampToValueAtTime(this.sustain, t);
        return t;
    }
    stop(when) {
        when = when || this.context.currentTime;
        var t = when;
        var value;
        var rt = t - this._startTime;
        if (rt < this.attack) {
            value = Math.max(0, rt / this.attack);
        } else if (rt >= this.attack && rt < this.attack + this.decay) {
            value = 1 - (((rt - this.attack) / (this.decay)) * (1 - this.sustain));
        } else {
            value = this.sustain;
        }
        this.input.gain.setValueAtTime(value, t);
        t += this.release;
        this.input.gain.linearRampToValueAtTime(0, t);
        return t;
    }
}

export class MidiMessage {
    constructor(data) {
        this.data = data;
        if (! data)
            this.data = new Uint8Array(3);
    }
    get cmd() {
        return this.data[0] >> 4;
    }
    set cmd(val) {
        this.data[0] = (val << 4) | (this.data[0] & 0xf0);
    }
    get cmdString() {
        return _.findKey(MidiMessage.commands, (x) => x === this.cmd);
    }
    get channel() {
        return this.data[0] & 0x0f;
    }
    set channel(val) {
        this.data[0] = (val & 0x0f) | (this.data[0] & 0xf0);
    }
    get type() {
        return this.data[0] & 0xf0;
    }
    set type(val) {
        this.data[0] = (val & 0xf0) | (this.data[0] & 0x0f);
    }
    get note() {
        return this.data[1];
    }
    set note(val) {
        this.data[1] = val;
    }
    get velocity() {
        return this.data[2];
    }
    set velocity(val) {
        this.data[2] = val;
    }
    get pitchBend() {
        return (this.data[2] << 7) + (this.data[1]); 
    }
}

MidiMessage.commands = {
    noteOff: 0x8,
    noteOn: 0x9,
    polyphonicKeyPressure: 0xA,
    controlChange: 0xB,
    programChange: 0xC,
    channelPressure: 0xD,
    pitchBendChange: 0xE,
};

MidiMessage.controls = {
    sustain: 64,
};
