export function more_information(event, content) {
  const text = txt => document.createTextNode(txt);
  const newline = () => document.createElement('br');

  let info = event.data;

  content.appendChild(text(info.description));

  if (info.note) {
    content.appendChild(newline());

    let note = document.createElement('i');
    note.innerText = `Note: ${info.note}`;
    content.appendChild(note);
  }

  if (info.url) {
    content.appendChild(newline());

    let link = document.createElement('a');
    link.href = info.url;
    link.innerText = "More information";
    content.appendChild(link);
  }
}

