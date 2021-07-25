---
# Don't create single pages: https://gohugo.io/content-management/build-options/#listing-pages-without-publishing-them
title: "Projects"
_build:
  render: true
cascade:
  _build:
    render: false
    list: true
---