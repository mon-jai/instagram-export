# Instagram Export

Export Instagram collections to git-ified and version controllable achieves

# Installation

```sh-session
$ npm install -g instagram-export
```

# Commands

<!-- commands -->

- [`instagram-export delete CODE`](#instagram-export-delete-code)
- [`instagram-export fetch`](#instagram-export-fetch)
- [`instagram-export init`](#instagram-export-init)
- [`instagram-export view`](#instagram-export-view)

## `instagram-export delete CODE`

Delete a post from an archive

```
USAGE
  $ instagram-export delete CODE

ARGUMENTS
  CODE  Code of posts to be deleted from the archive (could be more than one)

DESCRIPTION
  Delete a post from an archive
```

_See code: [dist/commands/delete.ts](https://github.com/mon-jai/instagram-export/blob/v0.8.0/dist/commands/delete.ts)_

## `instagram-export fetch`

Fetch Instagram for new posts of an archive

```
USAGE
  $ instagram-export fetch [--open] [--refetch] [--max-page <value>]

FLAGS
  --max-page=<value>  Maximum pages to fetch
  --open              Open Puppeteer in a window
  --refetch           Re-fetch the whole collection and update existing posts

DESCRIPTION
  Fetch Instagram for new posts of an archive
```

_See code: [dist/commands/fetch.ts](https://github.com/mon-jai/instagram-export/blob/v0.8.0/dist/commands/fetch.ts)_

## `instagram-export init`

Initialize a new archive

```
USAGE
  $ instagram-export init

DESCRIPTION
  Initialize a new archive

  Supported URL:
  https://instagram.com/{username}/
  https://instagram.com/{username}/saved/all-posts/
  https://instagram.com/{username}/saved/{collection_name}/{collection_id}/
```

_See code: [dist/commands/init.ts](https://github.com/mon-jai/instagram-export/blob/v0.8.0/dist/commands/init.ts)_

## `instagram-export view`

View archive in a webpage

```
USAGE
  $ instagram-export view [--dev] [--port <value>]

FLAGS
  --dev           Use `src/view.html` instead of downloaded assets
  --port=<value>  [default: 80] Specify server port

DESCRIPTION
  View archive in a webpage
```

_See code: [dist/commands/view.ts](https://github.com/mon-jai/instagram-export/blob/v0.8.0/dist/commands/view.ts)_

<!-- commandsstop -->
