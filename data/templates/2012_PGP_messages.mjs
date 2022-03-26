export function more_information(event, content) {
  const text = txt => document.createTextNode(txt);
  const newline = () => document.createElement('br');

  let info = event.data;

  if (info.is_individual) {
    content.appendChild(text(`This signature was unique to each participant.`));
    content.appendChild(newline());
    content.appendChild(newline());
  }

  if ("isitcicada" in info) {
    let link = document.createElement("a");
    link.href = info.isitcicada;
    link.innerText = "Check signature";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    content.appendChild(link);
  }
  else if ("incomplete_signature" in info) {
    let warning = document.createElement('div');
    warning.style.width = '500px';
    warning.style.whiteSpace = 'pre-line';

    let bold_title = document.createElement('span');
    bold_title.style.fontWeight = 'bold';
    bold_title.innerText = '⚠️  Incomplete signature ⚠️ : ';

    let explanation = text(info.incomplete_signature);

    warning.append(bold_title);
    warning.append(explanation);
    content.appendChild(warning);
  }
}

export function title(event, element) {
  let info = event.data;

  let displayed_title = event.title;
  if ("incomplete_signature" in info)
    // Prefix with an icon to indicate that caution should be advised.
    displayed_title = "⚠️ " + displayed_title;

  return displayed_title;
}

