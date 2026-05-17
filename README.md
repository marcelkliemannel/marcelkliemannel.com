# marcelkliemannel.com

[Personal website with articles, bookmarks, and open-source projects, mainly about software development.](https://marcelkliemannel.com)

## Development

This site is built with Hugo Extended. The expected Hugo version is pinned in `.mise.toml`.

```bash
mise install
brew install sass/sass/sass
hugo server
```

Production builds should run with Dart Sass available on `PATH`:

```bash
hugo --gc --minify
```

## License

The articles are licensed under [Attribution-NoDerivatives 4.0 International](https://creativecommons.org/licenses/by-nd/4.0/?ref=chooser-v1).
