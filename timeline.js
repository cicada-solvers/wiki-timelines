
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

    // Load templating code
    let templates = {
      title: (event, element) => {
        return event['title'];
      },
      more_information: (event, element) => {
        return null;
      }
    };

    if (dataset.templating_script !== undefined) {
      try {
        let imported_templates = await import('./data/' + dataset.templating_script);

        if ('title' in imported_templates)
          templates['title'] = imported_templates['title'];
        if ('more_information' in imported_templates)
          templates['more_information'] = imported_templates['more_information'];
      } catch (e) {}
    }

    timeline.add_group({
      name: dataset.name,
      description: dataset.description,
      templates: templates
    }, data);
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

    this.events_selected = [];
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

        let info = group.metadata;

        let name = document.createElement("span");
        name.innerText = info.name;
        name.classList.add('dataset-name');

        let description = document.createElement("div");
        description.innerText = info.description;
        description.classList.add('dataset-description');

        let delete_action = document.createElement("div");
        delete_action.classList.add('dataset-delete');
        delete_action.addEventListener('click', ev => {
          this.groups.remove(group.id);

          // Removing associated items
          let to_remove = [];
          this.items.forEach(item => {
            if (item.group == group.id)
              to_remove.push(item.id);
          });
          this.items.remove(to_remove);

          app.update_url();
        });

        group_element.appendChild(name);
        group_element.appendChild(description);
        group_element.appendChild(delete_action);

        return group_element;
      },

      template: item => {
        let group = this.groups.get(item.group)
        let dataset_templates = group.metadata.templates;

        const to_unix_time = date => date.getTime() / 1000;
        let original_event = {
          title: item['content'],
          time: 'end' in item ? [to_unix_time(item['start']), to_unix_time(item['end'])] : to_unix_time(item['start']),
          category: item['subgroup'],
          data: item['information']
        };

        // Template helper - return 'true' when the template-specific behaviour shouldn't be run.
        const apply_template = (output, element) => {
          if (output === null)
            return false;

          if (output !== undefined) {
            if (typeof output == "string")
              output = document.createTextNode(output);
            element.appendChild(output);
          }
          return true;
        };

        /*
         *  <div class="event">
         *    <div class="event-dropup">
         *      <div class="event-dropup-container">
         *        <div class="event-dropup-content">Author: ..., Link...</div>
         *        <div class="event-dropup-connector"></div>
         *      </div>
         *    </div>
         *    <div "event-content">
         *      Title...
         *    </div>
         *  </div>
         */

        // "More information" section
        let dropup_container = document.createElement('div');
        let content = document.createElement('div');

        let more_information = dataset_templates.more_information(original_event, content);
        if (!apply_template(more_information, content))
          dropup_container.style.display = 'none';

        content.classList.add('event-dropup-content');
        content.addEventListener('pointerdown', e => {
          // This pointer event would normaly bubble to the timeline main element, where
          //  it would be caught by the library and interpreted as "the item was selected".
          // This would cause the item DOM to be "redraw" (= deleted and recreated),
          //  causing some unwanted behaviors (such as preventing clicking on <a> elements).
          //
          // The solution is to stop the element propagation default the visjs callback is ran.
          // Since it was added earlier, we setup this callback to run during the capture phase.
          e.stopPropagation();
        }, true);

        let dropup_connector = document.createElement('div');
        dropup_connector.classList.add('event-dropup-connector');

        dropup_container.classList.add('event-dropup-container');
        dropup_container.appendChild(content);
        dropup_container.appendChild(dropup_connector);

        let dropup = document.createElement('div');
        dropup.classList.add('event-dropup');
        dropup.appendChild(dropup_container);

        let element = document.createElement('div');
        element.classList.add('event');
        element.appendChild(dropup);

        // Generate title using template
        let title = dataset_templates.title(original_event, element);
        apply_template(title, element);

        // Callback triggered when 'element' is added to the DOM.
        // This is quite an ugly hack.
        const on_dom_insertion = function() {
          if (item["approximate_time"])
            element.parentElement?.parentElement?.parentElement?.setAttribute("data-options", "approximate");
        };

        let observer = new MutationObserver(mutations => {
          for (let mutation of mutations) {
            for (let added_node of mutation.addedNodes) {
              if (added_node !== element)
                continue;

              on_dom_insertion();
              observer.disconnect();
              return;
            }
          }
        });
        observer.observe(document, { childList: true, subtree: true });

        return element;
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


    // Handle dropup display
    const handle_dropups = selection => {
      for (let item of selection) {
        if (!this.events_selected.includes(item))
          // Newly selected item
          this.events_selected.push(item);
      }

      for (let selected_item of this.events_selected) {
        if (!selection.includes(selected_item))
          // Unselected item
          this.events_selected = this.events_selected.filter(e => e != selected_item);
      }

      // Iif there is only one selected item, display its dropup
      let should_show = item => this.events_selected.length == 1 && item.id == this.events_selected[0];

      for (let item of Object.values(this.timeline.itemSet.items)) {
        let dropup = item.dom.content.firstChild.firstChild;

        dropup.classList.toggle('event-dropup-shown', should_show(item));
      }
    };

    this.timeline.on('select', properties => handle_dropups(properties.items));


    // When a line/dot is clicked, select its associated item
    // Note: this code is hacking into vis-timeline's internals. If more hacks are needed, directly editing the library could be simpler and cleaner
    this.timeline.itemSet.body.emitter.on('_change', ev => {
      for (let item of Object.values(this.timeline.itemSet.items)) {
        const clickCallback = ev => {
          let selection = [item.id];

          if (ev.ctrlKey || ev.metaKey || ev.shiftKey) {
            let current_selection = this.timeline.getSelection();

            if (current_selection.includes(selection[0]))
              selection = current_selection.filter(id => id != item.id);
            else
              selection = selection.concat(current_selection);
          }

          // TODO: trully support Shift+Click

          this.timeline.setSelection(selection);
          handle_dropups(selection);
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

  add_group(metadata, data) {
    let group_id = this.group_counter++;

    // Declare the group
    this.groups.add({
      id: group_id,
      order: group_id,

      // Sort subgroups by lexicographical order
      subgroupOrder: 'subgroup',

      metadata: metadata
    });

    // Add the timestamps
    for (let d of data) {
      let item_prop = {
        id: this.item_counter++,
        group: group_id,

        content: d['title'],
        information: d['data']
      };

      // Category?
      item_prop['subgroup'] = d['category'] || "default";

      // Time range - shorthand value
      if (d["time"] instanceof Array) {
        let [start, end] = d["time"];

        item_prop["start"] = vis.moment.unix(start);
        item_prop["end"] = vis.moment.unix(end);
      }
      // Time range - { type: 'range', range: [start, end] }
      else if (d["time"].constructor === Object && d["time"].type == "range") {
        let [start, end] = d["time"].range;

        item_prop["start"] = vis.moment.unix(start);
        item_prop["end"] = vis.moment.unix(end);
      }
      // Timestamp - shorthand value
      else if (typeof d["time"] === 'number') {
        item_prop["start"] = vis.moment.unix(d["time"]);
      }
      // Timestamp - { type: 'timestamp', 'timestamp': value }
      else if (d["time"].constructor === Object && d["time"].type == "timestamp") {
        item_prop["start"] = vis.moment.unix(d["time"].timestamp);
      }
      // Approximate time - { type: 'approximate', range: [start, end] }
      else if (d["time"].constructor === Object && d["time"].type == "approximate") {
        let [start, end] = d["time"].range;

        item_prop["start"] = vis.moment.unix(start);
        item_prop["end"] = vis.moment.unix(end);

        item_prop["approximate_time"] = true;
      }

      this.items.add(item_prop);
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

    this.init_searchbar();

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

      let copied = document.getElementById("permalink-copied");
      copied.classList.remove('fade-out');
      setTimeout(() => {
        copied.classList.add('fade-out');
      }, 5);
    });
    setup_control("controls-load", ev => {
      this.display_searchbar();
    });
  }
  init_searchbar() {
    let searchbar = document.getElementById("searchbar");
    let searchbar_input = document.getElementById("searchbar-input");
    let searchbar_results = document.getElementById("searchbar-results");
    let searchbar_no_results = document.getElementById("searchbar-no-results");

    const dismiss_searchbar = () => {
      searchbar_input.value = '';
      searchbar.style.display = 'none';
    };

    // Clicking outside the searchbox dimisses it
    searchbar.addEventListener("click", ev => {
      if (ev.target.id != "searchbar")
        return;

      dismiss_searchbar();
    });
    // Handle input inside of the text field
    searchbar_input.addEventListener("input", ev => {
      let query = ev.target.value;

      let results_found = 0;
      for (let result of searchbar_results.children) {
        if (result.id == "searchbar-no-results") continue;

        let name = result.children[0].innerText;
        let description = result.children[1].innerText;

        if (name.includes(query) || description.includes(query)) {
          result.style.display = "";
          results_found++;
        }
        else {
          result.style.display = "none";
        }
      }

      searchbar_no_results.style.display = results_found == 0 ? "" : "none";
    });

    // Populate search results
    let new_result = (name, description) => {
      let name_span = document.createElement("span");
      name_span.classList.add("searchbar-result-name");
      name_span.innerText = name;

      let description_span = document.createElement("span");
      description_span.classList.add("searchbar-result-description");
      description_span.innerText = description;

      let result = document.createElement("div");
      result.classList.add("searchbar-result");
      result.appendChild(name_span);
      result.appendChild(description_span);

      return result;
    };

    this.data_source.datasets.forEach(dataset => {
      let result = new_result(dataset['name'], dataset['description']);

      result.addEventListener('click', async ev => {
        dismiss_searchbar();

        await this.load(dataset['name']);
        this.update_url();
        this.timeline.fit();
      });

      searchbar_results.appendChild(result);
    });

    // Initially, "No results" should be hidden
    searchbar_no_results.style.display = "none";
  }
  display_searchbar() {
    let searchbar = document.getElementById("searchbar");
    searchbar.style.display = '';
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
    .map(group => group.metadata.name);

    location.hash = sorted.map(encodeURIComponent).join(';');
  }
}

let app = new App();
app.init();
