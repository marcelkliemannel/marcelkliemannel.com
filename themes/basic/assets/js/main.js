/**
 * Main menu toggle
 */
var mainMenuVertical = document.querySelector(".main-menu-vertical");
var mainMenuVerticalToggle = document.querySelector(".main-menu-vertical-toggle");
mainMenuVerticalToggle.addEventListener("click", function(e) {
  if (mainMenuVertical.style.display === "block") {
    mainMenuVertical.style.display = "none";

    // Icon
    mainMenuVerticalToggle.classList.remove("icon-cross")
    mainMenuVerticalToggle.classList.add("icon-menu")

    mainMenuVerticalToggle.classList.remove("main-menu-vertical-toggle-menu-visible");
  } 
  else {
    mainMenuVertical.style.display = "block";
    
    // Icon
    mainMenuVerticalToggle.classList.remove("icon-menu")
    mainMenuVerticalToggle.classList.add("icon-cross")

    mainMenuVerticalToggle.classList.add("main-menu-vertical-toggle-menu-visible");
  }
  e.preventDefault()
});


/**
 * Table of contents toggle
 */
var tableOfContents = document.getElementById("TableOfContents");
if (tableOfContents !== null) {
  var tableOfContentsToggle = document.querySelector(".table-of-contents-toggle-link");
  tableOfContentsToggle.addEventListener("click", function(e) {
    if (tableOfContents.style.display === "inline-block") {
      tableOfContents.style.display = "none";
    } 
    else {
      tableOfContents.style.display = "inline-block";
    }
    e.preventDefault()
  });
}

/**
 * Code block copy button
 */
document.querySelectorAll('.highlight').forEach(function (highlightDiv) {
  var button = document.createElement('button');
  button.className = 'copy-Button button-like button-like-inverted-dark button-like-size-l';
  button.type = 'button';
  button.innerHTML = '<span class="icon-copy"></span> Copy';
  button.addEventListener("click", () => copyCodeToClipboard(button, highlightDiv));

  highlightDiv.appendChild(button);
});

async function copyCodeToClipboard(button, highlightDiv) {
  const codeToCopy = highlightDiv.querySelector(":last-child > .chroma > code").innerText;

  navigator.clipboard.writeText(codeToCopy).then(function() {
    showToast("Code copied.")
  }, function(err) {
    console.error('Async: Could not copy text: ', err);
  });
}

function showToast(message) {
  var toast = document.getElementById("toast");
  toast.className = "show";
  toast.innerText = message
  setTimeout(function(){ toast.className = toast.className.replace("show", ""); }, 3000);
}
