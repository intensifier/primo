import _toConsumableArray from "@babel/runtime/helpers/toConsumableArray";
import { bindAll } from 'bind-event-listener';
import { getBindingsForBrokenDrags } from '../util/detect-broken-drag';
function acceptDrop(event) {
  // if the event is already prevented the event we don't need to do anything
  if (event.defaultPrevented) {
    return;
  }
  // Using "move" as the drop effect as that uses the standard
  // cursor. Doing this so the user doesn't think they are dropping
  // on the page
  // Note: using "none" will not allow a "drop" to occur, so we are using "move"
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
  // cancel the default browser behaviour
  // doing this will tell the browser that we have handled the drop
  event.preventDefault();
}
var unbindEvents = null;

/**
 * Block drag operations outside of `@atlaskit/pragmatic-drag-and-drop`
 */
function start() {
  cleanup();
  unbindEvents = bindAll(window, [{
    type: 'dragover',
    listener: acceptDrop
  }, {
    type: 'dragenter',
    listener: acceptDrop
  }, {
    type: 'drop',
    listener: function listener(event) {
      // our lifecycle manager already prevents events, but just being super safe
      event.preventDefault();

      // not setting dropEffect, as `drop.dropEffect` has already been published to the user
      // (lifecycle-manager binds events in the capture phase)

      // we don't need to wait for "dragend", and "dragend" might not even happen,
      // such as when the draggable has been removed during a drag.
      cleanup();
    }
  }, {
    type: 'dragend',
    listener: cleanup
  }].concat(_toConsumableArray(getBindingsForBrokenDrags({
    onDragEnd: cleanup
  }))),
  // being clear that these are added in the bubble phase
  {
    capture: false
  });
}
function cleanup() {
  var _unbindEvents;
  (_unbindEvents = unbindEvents) === null || _unbindEvents === void 0 || _unbindEvents();
  unbindEvents = null;
}

/**
 * TODO: for next major, we could look at do the following:
 *
 * ```diff
 * - preventUnhandled.start();
 * - preventUnhandled.stop();
 * + const stop = preventUnhandled();
 * ```
 */

function stop() {
  var _window$event;
  /**
   * if `stop()` is called in a `"drop"` event, then `event.preventDefault()` won't be called.
   * Our `"drop"` listener calls `event.preventDefault()` for handled drop events
   * ("drop" events caused by dropping over a drop target)
   * `preventUnhandled()` causes every element to become a drop target (according to the browser)
   *
   * To opt out of the default behaviour for a `"drop"` event, we need to make sure
   * that we cancel it.
   *
   * The `"drop"` event listener in core is in the `capture` phase, so people calling
   * `preventUnhandled.stop()` in `onDrop()` will remove the `"drop"` event listener in this
   * file before it has the chance to cancel the event.
   *
   * Being sneaky and using the `window.event` global to sniff out the current event
   */
  if (((_window$event = window.event) === null || _window$event === void 0 ? void 0 : _window$event.type) === 'drop') {
    var _window$event2;
    (_window$event2 = window.event) === null || _window$event2 === void 0 || _window$event2.preventDefault();
  }
  cleanup();
}
export var preventUnhandled = {
  start: start,
  stop: stop
};