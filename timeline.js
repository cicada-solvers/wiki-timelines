
class DataSource {
  constructor() {
    this.datasets = null;
  }

  // Initializes the DataSource: reads available data sets.
  init() {
    let self = this;

    fetch('./data/index.json')
    .then(response => response.json())
    .then(json => {
      self.datasets = new vis.DataSet(json, {
        fieldId: "name"
      });
    })

    .catch(error => {
      // TODO: error message
      console.log(error)
    });
  }

  load(dataset_name) {
    let dataset = this.datasets.get(dataset_name);

    fetch(`./data/${dataset.filename}`)
    .then(response => response.json())
    .then(data => {
      window.timeline.add_group(dataset.name, data, dataset.description);
    })
  }
}

class Timeline {
  constructor() {
    this.items = new vis.DataSet();
    this.groups = new vis.DataSet();

    this.item_counter = 1;
    this.group_counter = 1;
  }

  init() {
    // Configuration for the timeline
    let options = {
      multiselect: true, // Allow multiple selection with Ctrl+Click

      zoomMax: 10*365*24*60*60*1000, // 10 years
      stack: false,
      stackSubgroups: true,

      // Enable changing group order by dragging them
      groupOrderSwap: (a, b, groups) => {
        [a.order, b.order] = [b.order, a.order]
      },
      groupEditable: true,

      // Prevents strange height changes when moving around
      groupHeightMode: 'fixed',

      groupTemplate: group => {
        let group_element = document.createElement("div");
        group_element.classList.add('dataset-header');

        let name = document.createElement("span");
        name.innerText = group.content;
        name.classList.add('dataset-name');

        let description = document.createElement("div");
        description.innerText = group.description;
        description.classList.add('dataset-description');

        group_element.appendChild(name);
        group_element.appendChild(description);

        return group_element;
      },

      height: "100%",

      moment: date => vis.moment(date).utc() // Display UTC time
    };

    let container = document.getElementById('timeline');
    this.timeline = new vis.Timeline(container, this.items, this.groups, options);


    // When dragging an item, use the "grabbing" cursor
    let group_names = container.getElementsByClassName('vis-labelset')[0];

    let observer = new MutationObserver((mutationList, observer) => {
      for (let mutation of mutationList) {
        if (mutation.target === group_names)
          continue;

        let is_one_dragged = Array.from(group_names.children).some(e => e.classList.contains('vis-group-is-dragging'));
        console.log(is_one_dragged);
        group_names.style.cursor = is_one_dragged ? "grabbing" : "pointer";
      }
    });
    observer.observe(group_names, {
      attributes: true,
      subtree: true
    });
  }

  fit() {
    this.timeline.fit();
  }

  add_group(name, data, description) {
    let group_id = this.group_counter++;

    // Declare the group
    this.groups.add({
      id: group_id,
      content: name, // + " " + group_id,
      order: group_id,
      description: description
    });

    // Add the timestamps
    for (let d of data) {
      this.items.add({
        id: this.item_counter++,

        group: group_id,
        subgroup: ['Welcome', 'Problems?', 'Val\u0113te!'].includes(d['title']) ? 'plaintext' : 'maginobion',
        content: d['title'],
        start: vis.moment.unix(d["timestamp"])
      })
    }
  }
}

var timeline = window.timeline = new Timeline();
var data_source = window.data_source = new DataSource();

timeline.init();
data_source.init();

setTimeout(() => {
  for (let i = 0; i < 1; i++)
    data_source.load("r/a2e7j6ic78h0j posts");
}, 1000);
setTimeout(() => {
  timeline.fit();
}, 1500);

// Controls
document.getElementById("controls-center").addEventListener('click', ev => {
  timeline.fit();
});
document.getElementById("controls-permalink").addEventListener('click', ev => {
  navigator.clipboard.writeText(location.href);

  // TODO: "Copied!" message
});
