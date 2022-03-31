Documentation of the data format.

## `index.json`
Lists registered datasets.

It contains a JSON Array, where each registered dataset is represented by an object with the following properties:
* `name`: User-friendly name of the dataset. Should be unique.
* `description`: User-friendly description of the dataset. Recommended length: < 100 characters.
* `templating_script`: Javascript module exports template functions to generate content on the timeline. The Javascript file should be in the `templates/` folder and have the `.mjs` extension.
* `filename`: JSON file containing the dataset data. Should be present inside this directory.

## Data file format
A data file of a dataset is a JSON file, containing an Array of objects. Each object represents one event, described by the following fields:
* `title`: Title of the event. Will be displayed as the event name on the Timeline if no `title` templates was provided.
* `time`: Time of the event. Three kinds of values are allowed:
  * `{ "type": "timestamp", "timestamp": unix_time}`: `unix_time` is the (UTC) Unix time at which the event happened. **Shorthand:** Instead of specifying an object, the numeric timestamp can be directly given.
  * `{ "type": "range", "range": [start, end]}`: Time range of the event. Both numeric values are unix times. **Shorthand:** Instead of specifying an object, `[start, end]` can be directly given.
  * `{ "type": "approximate", "range": [start, end]}` an Array containnig two numeric values (ie. `[begin, end]`): Approximate time range of the event. Both numeric values are UTC Unix time.
* `category`: Optional, defaults to "default". Events having the same category will be displayed on the same vertical level on the timeline. Allows you to separe events.
* `data`: General purpose object to store other information about the event.

## Event templates
Templates can either return an HTML element or a text string, which will be converted to an HTML text node. `undefined` (equivalent to not returning anything) can also be returned to indicate that the template directly edited the DOM and that no further work needs to be done. `null` can be returned to trigger a template-specific behaviour.
* `title`:
  * Parameters: `event`, `element`
  * Description: this template is used to generate the content displayed on the timeline, as the event name. `event` is the event as found in the datafile, `element` is the HTML element where the title will be inserted.
  * Default: this template defaults to displaying the event `title` property.
  * It is illegal to return `null` for this template.
* `more_information`:
  * Parameters: `event`, `element`
  * Description: this template is used to generate the popup information when an event is selected. `event` is the event as found in the datafile, `element` is the HTML element where the information will be displayed.
  * Default: defaults to the `null` behaviour.
  * When `null` is returned, the information popup will be displayed.
