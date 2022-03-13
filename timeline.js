
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

    if (!dataset) return;

    return fetch(`./data/${dataset.filename}`)
    .then(response => response.json())
    .then(data => {
      timeline.add_group(dataset.name, data, dataset.description);
    })
  }
}

class Timeline {
  constructor() {
    this.container = null;

    this.items = new vis.DataSet();
    this.groups = new vis.DataSet();

    this.item_counter = 1;
    this.group_counter = 1;

    this.loading = false;
  }

  init() {
    let self = this;

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

        let delete_action = document.createElement("div");
        delete_action.classList.add('dataset-delete');
        delete_action.addEventListener('click', ev => {
          self.groups.remove(group.id);
        });

        group_element.appendChild(name);
        group_element.appendChild(description);
        group_element.appendChild(delete_action);

        return group_element;
      },

      height: "100%",

      moment: date => vis.moment(date).utc() // Display UTC time
    };

    let container = this.container = document.getElementById('timeline');
    this.timeline = new vis.Timeline(container, this.items, this.groups, options);

    // When dragging an item, use the "grabbing" cursor
    let group_names = container.getElementsByClassName('vis-labelset')[0];

    let observer = new MutationObserver((mutationList, observer) => {
      for (let mutation of mutationList) {
        if (mutation.target === group_names)
          continue;

        let is_one_dragged = Array.from(group_names.children).some(e => e.classList.contains('vis-group-is-dragging'));
        group_names.style.cursor = is_one_dragged ? "grabbing" : "pointer";
      }
    });
    observer.observe(group_names, {
      attributes: true,
      subtree: true
    });


    // When a line/dot is clicked, select its associated item
    // Note: this code is hacking into vis-timeline's internals. If more hacks are needed, directly editing the library could be simpler and cleaner
    this.timeline.itemSet.body.emitter.on('_change', ev => {
      for (let item of Object.values(this.timeline.itemSet.items)) {
        const clickCallback = ev => {
          let selection = [item.id];

          if (ev.ctrlKey || ev.metaKey || ev.shiftKey)
            selection = selection.concat(this.timeline.getSelection());

          // TODO: trully support Shift+Click

          this.timeline.setSelection(selection);
        }

        if (item.dom && item.dom.dot) item.dom.dot.addEventListener('pointerdown', clickCallback);
        if (item.dom && item.dom.line) item.dom.line.addEventListener('pointerdown', clickCallback);
      }
    });
  }

  fit() {
    this.timeline.fit();
  }

  set_loading(state) {
    this.loading = state;

    let main_element = this.container.parentElement;
    main_element.classList.toggle("loading", state);
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

setTimeout(async () => {
  for (let i = 0; i < 1; i++) {
    timeline.set_loading(true);
    await data_source.load("r/a2e7j6ic78h0j posts");
    timeline.set_loading(false);
  }

  timeline.fit();
}, 1000);

// Controls
const setup_control = (id, callback) => document.getElementById(id)?.addEventListener('click', callback);

setup_control("controls-center", ev => {
  timeline.fit();
});
setup_control("controls-permalink", ev => {
  navigator.clipboard.writeText(location.href);

  // TODO: "Copied!" message
});
setup_control("controls-load", async ev => {
  let dataset_name = window.prompt("Dataset name:"); // TODO

  timeline.set_loading(true);
  await data_source.load(dataset_name);
  timeline.set_loading(false);

  timeline.fit();
});
