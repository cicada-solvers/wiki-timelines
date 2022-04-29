export function more_information(event, content) {
  const text = txt => document.createTextNode(txt);
  const newline = document.createElement('br');

  let info = event.data;

  if (info.content) {
    let content_div = document.createElement("div");
    content_div.innerText = info.content;

    content_div.style.overflowX = "scroll";
    content_div.style.whiteSpace = "nowrap";

    content.appendChild(content_div);
    content.appendChild(newline);
  }

  let link = document.createElement('a');
  link.href = info.url;
  link.innerText = "See on Twitter";
  content.appendChild(link);
}

