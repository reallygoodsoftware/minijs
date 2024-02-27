export class EventsExtensions {
  static instance
  static USER_CUSTOM_EVENTS = {}

  constructor() {
    if (EventsExtensions.instance) return EventsExtensions.instance

    EventsExtensions.instance = this
  }

  extend(events) {
    EventsExtensions.USER_CUSTOM_EVENTS = {
      ...EventsExtensions.USER_CUSTOM_EVENTS,
      ...events,
    }
  }
}
