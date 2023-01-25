# Instagram Export

Export Instagram collections to git-ified and version controllable achieves

# Installation

```sh-session
$ npm install -g instagram-export
```

# Commands

<!-- commands -->

- [`instagram-export fetch`](#instagram-export-fetch)
- [`instagram-export init`](#instagram-export-init)
- [`instagram-export view`](#instagram-export-view)

## `instagram-export fetch`

Fetch Instagram for new posts of an archive

```
USAGE
  $ instagram-export fetch [--open]

FLAGS
  --open

DESCRIPTION
  Fetch Instagram for new posts of an archive
```

_See code: [dist/commands/fetch.ts](https://github.com/mon-jai/instagram-export/blob/v0.0.0/dist/commands/fetch.ts)_

## `instagram-export init`

Initialize a new archive

```
USAGE
  $ instagram-export init

DESCRIPTION
  Initialize a new archive
```

_See code: [dist/commands/init.ts](https://github.com/mon-jai/instagram-export/blob/v0.0.0/dist/commands/init.ts)_

## `instagram-export view`

View archive in a webpage

```
USAGE
  $ instagram-export view [--port <value>]

FLAGS
  --port=<value>  [default: 3000] Specify server port

DESCRIPTION
  View archive in a webpage
```

_See code: [dist/commands/view.ts](https://github.com/mon-jai/instagram-export/blob/v0.0.0/dist/commands/view.ts)_

<!-- commandsstop -->
