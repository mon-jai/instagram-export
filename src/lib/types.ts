import { ReadonlyDeep } from "type-fest"

import MutableInstagramPost, { CarouselMedia, ImageVersions2, VideoVersion } from "./InstagramPost.js"

// The data structure Instagram used to store posts
export type InstagramPost = ReadonlyDeep<MutableInstagramPost>

// The data format returned by Instagram API
export type InstagramResponse = ReadonlyDeep<{ items: [{ media: InstagramPost }] }>

type User = {
  pk: string
  username: string
  full_name: string
}

// The data format we use to store posts
export type Post = ReadonlyDeep<{
  pk: string
  id: string
  media_type: number
  code: string
  location?: {
    pk: string
    short_name: string
    name: string
    address: string
    city: string
    lng?: number
    lat?: number
  }
  user: User
  caption?: {
    pk: string
    text: string
    created_at: number
  }
  music_info?: {
    title: string
    id: string
    display_artist: string
    artist_id: string | null
    ig_username: string | null
  }
  coauthor_producers: User[]
}>

// https://stackoverflow.com/a/75212804
export type IWithMediaURL = ReadonlyDeep<{
  image_versions2: ImageVersions2
  video_versions?: VideoVersion[]
}>

export type IWithMedia = ReadonlyDeep<
  { code: string } & (
    | {
        image_versions2: ImageVersions2
        video_versions?: VideoVersion[]
      }
    | { carousel_media: CarouselMedia[] }
  )
>

// The structure of the output data file
export type DataStore = ReadonlyDeep<{ url: string; download_media: boolean; posts: Post[] }>

// The structure used for downloading medias from Instagram
export type MediaSource = ReadonlyDeep<
  { code: string } & (
    | { type: "image"; url: string }
    | { type: "video"; url: string }
    | { type: "carousel"; urls: string[] }
  )
>

// All the errors thrown by us
export enum Errors {
  // init
  DATA_FILE_ALREADY_EXISTS,
  // fetch
  NOT_INITIALIZED,
  RATE_LIMIT_REACHED,
  NO_NEW_POST,
  NO_OVERLAP,
  DOWNLOAD_FAILED,
  // init & fetch
  INVALID_COLLECTION_URL,
}
