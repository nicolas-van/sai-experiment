
(function() {
"use strict";

function midiToFrequency(midiNote) {
    return 440 * Math.pow(Math.pow(2, 1/12), midiNote - 69);
};

})();
