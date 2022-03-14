
class DataSource {
  constructor() {
    this.datasets = null;
  }

  // Initializes the DataSource: reads available data sets.
  async init() {
    let response = await fetch('./data/index.json')
    let json = await response.json();

    this.datasets = new vis.DataSet(json, {
      fieldId: "name"
    });
  }

  async load(dataset_name) {
    let dataset = this.datasets.get(dataset_name);

    if (!dataset) return;

    let response = await fetch(`./data/${dataset.filename}`)
    let data = await response.json();

    timeline.add_group(dataset.name, data, dataset.description);
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
    // Configuration for the timeline
    let options = {
      multiselect: true, // Allow multiple selection with Ctrl+Click

      zoomMax: 10*365*24*60*60*1000, // 10 years
      stack: false,
      stackSubgroups: true,

      // Enable changing group order by dragging them
      groupOrder: (a, b) => a.order - b.order,
      groupOrderSwap: (a, b, groups) => {
        [a.order, b.order] = [b.order, a.order];

        app.update_url();
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
          this.groups.remove(group.id);

          app.update_url();
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

class App {
  constructor() {
    this.timeline = new Timeline();
    this.data_source = new DataSource();

    window.timeline = this.timeline;
    window.data_source = this.data_source;
  }

  async init() {
    this.init_controls();

    // Create timeline
    this.timeline.init();
    this.timeline.set_loading(true);

    // Import dataset information
    await this.data_source.init();

    // Permalink parsing
    if (location.hash.length > 1) {
      let packed_content = location.hash.substr(1);

      await this.restore_state(packed_content);
    }
    this.update_url();

    // Enable timeline
    this.timeline.set_loading(false);
    this.timeline.fit();
  }
  init_controls() {
    const setup_control = (id, callback) => document.getElementById(id)?.addEventListener('click', callback);

    setup_control("controls-center", ev => {
      this.timeline.fit();
    });
    setup_control("controls-permalink", ev => {
      navigator.clipboard.writeText(location.href);

      // TODO: "Copied!" message
    });
    setup_control("controls-load", async ev => {
      let dataset_name = window.prompt("Dataset name:"); // TODO

      this.timeline.set_loading(true);
      await this.load(dataset_name);
      this.update_url();
      this.timeline.set_loading(false);

      this.timeline.fit();
    });
  }

  // Load new dataset
  async load(name) {
    this.timeline.set_loading(true);

    await this.data_source.load(name);

    this.timeline.set_loading(false);
  }

  // Restore timeline state/content
  async restore_state(packed_content) {
    let to_load = [];

    for (let packed_dataset_name of packed_content.split(';'))
      try {
        to_load.push(decodeURIComponent(packed_dataset_name));
      } catch (e) {}

    let promises = [];
    for (let name of to_load) {
      let load_promise = this.data_source.load(name);

      promises.push(load_promise);
    }

    await Promise.all(promises);
  }
  update_url() {
    let sorted = this.timeline.groups
    .map(group => group, { order: 'order' }) // Sort by field 'order'
    .map(group => group.content);

    location.hash = sorted.map(encodeURIComponent).join(';');
  }
}

let app = new App();
app.init();
