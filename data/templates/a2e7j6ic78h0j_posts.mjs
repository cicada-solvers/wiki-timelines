export function more_information(event, content) {
  const text = txt => document.createTextNode(txt);
  const newline = document.createElement('br');

  let info = event.data;

  if (info.distinguished)
    content.appendChild(text(`Author: ${info.author} (as a moderator)`));
  else
    content.appendChild(text(`Author: ${info.author}`));
  content.appendChild(newline);

  let link = document.createElement('a');
  link.href = info.url;
  link.innerText = "View post";
  content.appendChild(link);
}

