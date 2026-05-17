const mainMenuVertical = document.querySelector(".main-menu-vertical");
const mainMenuVerticalToggle = document.querySelector(".main-menu-vertical-toggle");

if (mainMenuVertical && mainMenuVerticalToggle) {
  mainMenuVerticalToggle.addEventListener("click", function (event) {
    event.preventDefault();

    const menuIsVisible = mainMenuVertical.classList.toggle("main-menu-vertical-visible");
    mainMenuVerticalToggle.classList.toggle("main-menu-vertical-toggle-menu-visible", menuIsVisible);
    mainMenuVerticalToggle.classList.toggle("icon-cross", menuIsVisible);
    mainMenuVerticalToggle.classList.toggle("icon-menu", !menuIsVisible);
    mainMenuVerticalToggle.setAttribute("aria-expanded", String(menuIsVisible));
  });
}

const tableOfContents = document.getElementById("TableOfContents");
const tableOfContentsToggle = document.querySelector(".table-of-contents-toggle-link");

if (tableOfContents && tableOfContentsToggle) {
  tableOfContentsToggle.addEventListener("click", function (event) {
    event.preventDefault();

    const tableOfContentsIsVisible = tableOfContents.classList.toggle("table-of-contents-visible");
    tableOfContentsToggle.setAttribute("aria-expanded", String(tableOfContentsIsVisible));
  });
}

document.querySelectorAll(".highlight").forEach(function (highlightDiv) {
  const button = document.createElement("button");
  button.className = "copy-button button-like button-like-inverted-dark button-like-size-l";
  button.type = "button";
  button.innerHTML = '<span class="icon-copy"></span> Copy';
  button.addEventListener("click", function () {
    copyCodeToClipboard(highlightDiv);
  });

  highlightDiv.appendChild(button);
});

function copyCodeToClipboard(highlightDiv) {
  const code = highlightDiv.querySelector(".lntd:last-child code, .chroma > pre code, .chroma > code");

  if (!code) {
    return;
  }

  navigator.clipboard.writeText(code.innerText).then(function () {
    showToast("Code copied to clipboard.");
  }, function (error) {
    console.error("Async: Could not copy text: ", error);
  });
}

function showToast(message) {
  const toast = document.getElementById("toast");

  if (!toast) {
    return;
  }

  toast.className = "show";
  toast.innerText = message;

  setTimeout(function () {
    toast.className = toast.className.replace("show", "");
  }, 3000);
}
