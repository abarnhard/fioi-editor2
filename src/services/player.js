PlayerFactory.$inject = ['$q', '$interval', '$sce', 'FioiEditor2Audio', 'FioiEditor2Registry', 'FioiEditor2Signals'];
export function PlayerFactory ($q, $interval, $sce, audio, registry, signals) {
   var service = {};
   var state = {
      options: null, // object with the dumpState() and loadState(state) functions.
      recording: null,
      startTime: null,
      isPlaying: false,
      isPaused: false,
      playInterval: undefined, // angular $interval handler
      playOffset: undefined, // offset in ms (rel. to startTime) of the last event played
      playCursor: undefined // index in recording of the next event to replay
   };

   // Start playing back the given recording.
   service.start = function (recording, options) {
      return $q(function (resolve, reject) {
         if (state.isPlaying)
            return reject('playback is already in progress');
         state.options = options;
         state.recording = recording;
         state.startTime = Date.now();
         state.isPlaying = true;
         state.isPaused = false;
         state.playInterval = $interval(playTick, 20);
         state.playOffset = 0;
         state.playCursor = 0;
         if (recording.audioUrl) {
            state.audio = audio.getPlayer(recording.audioUrl);
            state.audio.play();
         }
         resolve();
      });
   };

   // Pause playback.
   service.pause = function () {
      return $q(function (resolve, reject) {
         if (!state.isPlaying)
            return reject('playback is not in progress');
         if (state.isPaused)
            return resolve();
         if (state.audio)
            state.audio.pause();
         $interval.cancel(state.playInterval);
         state.resumeState = state.options.dumpState();
         state.playInterval = null;
         state.isPaused = true;
         resolve();
      });
   };

   // Resume playback.
   service.resume = function () {
      return $q(function (resolve, reject) {
         if (!state.isPlaying)
            return reject('playback is not in progress');
         if (!state.isPaused)
            resolve();
         state.isPaused = false;
         registry.clear();
         state.options.loadState(state.resumeState);
         if (state.audio)
            state.audio.play();
         // Set a fake startTime such that state.playOffset keeps its meaning
         // as the current position (in milliseconds) in the recording.
         state.startTime = Date.now() - state.playOffset;
         state.playInterval = $interval(playTick, 20);
         return resolve();
      });
   };

   // Stop playback.
   service.stop = function () {
      return $q(function (resolve, reject) {
         // Pause before stopping.
         if (!state.isPaused) {
            return service.pause().then(afterPaused, reject);
         } else {
            return afterPaused();
         }
         function afterPaused () {
            state.isPlaying = false;
            state.isPaused = false;
            state.events = undefined;
            state.options = null;
            state.audio = null;
            resolve();
         }
      });
   };

   service.rewind = function () {
      // audio.currentTime = 0;
   }

   function playTick () {
      // Discard a tick event that was queued before playing was paused or stopped.
      if (!state.playInterval)
         return;
      var cursor = state.playCursor;
      var playUntil;
      if (state.audio) {
         playUntil = Math.floor(state.audio.currentTime * 1000) - state.playOffset;
      } else {
         playUntil = Math.floor(Date.now() - state.startTime - state.playOffset);
      }
      var timeElapsed = 0;
      var events = state.recording.events;
      while (cursor < events.length) {
         var event = events[cursor];
         if (timeElapsed + event[0] > playUntil)
            break;
         timeElapsed += event[0];
         var id = event[1];
         var op = event[2];
         try {
            // An empty target id ('') indicates a global event.
            // Handle these events before passing them to targets and to the
            // replayEvent options, so that the '0' event is able to reload
            // the initial state (and set up the targets mapping) first.
            if (id === '') {
               if (op === '0') {
                  // Global state reset.  Clear the targets registry.
                  registry.clear();
                  state.options.loadState(event[3]);
                  signals.emitUpdate();
               }
            }
            // If we have an object registered as the event's target,
            // automatically pass the event to that object.  Objects
            // typically register when the a state dump is reloaded.
            var target = registry.getTarget(id);
            if (target)
               target.replayEvent(event);
            // Pass all events to the handler in options, if given.
            if (typeof state.options.replayEvent === 'function')
               state.options.replayEvent(event);
            cursor += 1;
         } catch (ex) {
            console.log('An exception occurred!', ex);
            state.exception = ex;
            service.pause();
            break;
         }
      }
      state.playOffset += timeElapsed;
      state.playCursor = cursor;
      if (cursor == events.length) {
         $interval.cancel(state.playInterval);
         state.playInterval = null;
         service.stop();
         signals.emit('done');
      }
   }

   return service;
}