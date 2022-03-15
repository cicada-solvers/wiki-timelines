Documentation of the data format.

## `index.json`
Lists registered datasets.

It contains a JSON Array, where each registered dataset is represented by an object with the following properties:
* `name`: User-friendly name of the dataset. Should be unique.
* `description`: User-friendly description of the dataset. Recommended length: < 100 characters.
* `filename`: JSON file containing the dataset data. Should be present inside this directory.

## Data file format
A data file of a dataset is a JSON file, containing an Array of objects. Each object represents one event, described by the following fields:
* `title`: Title of the event. Will be displayed as the event name on the Timeline.
* `time`: Time of the event. Two kinds of values are allowed:
  * a numeric value: UTC Unix time, at which the event happened.
  * an Array containnig two numeric values (ie. `[begin, end]`): Time range of the event. Both numeric values are UTC Unix time.
* `category`: Optional. Events having the same category will be displayed on the same vertical level on the timeline. Allows you to separe events.
* `data`: General purpose object to store other information about the event.
