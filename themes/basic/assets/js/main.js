/*
 * Main Menu Toggle
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

/*
 * Table of Contents Toggle
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