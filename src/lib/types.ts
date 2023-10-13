import { ReadonlyDeep } from "type-fest"

import MutableInstagramPost, { CarouselMedia, ImageVersions2, VideoVersion } from "./InstagramPost.js"

// The data structure Instagram used to store posts
export type InstagramPost = ReadonlyDeep<MutableInstagramPost>

// The data format returned by Instagram API
type InstagramProfileResponse = ReadonlyDeep<{ items: InstagramPost[] }>
type InstagramCollectionResponse = ReadonlyDeep<{ items: [{ media: InstagramPost }] }>

export type InstagramResponse = InstagramProfileResponse | InstagramCollectionResponse

export type User = {
  pk: string
  username: string
  full_name: string
}

// The data format we use to store posts
export type Post = ReadonlyDeep<{
  pk: string
  id: string
  code: string
  taken_at: number
  user: User
  coauthor_producers?: User[]
  tagged_user?: User[]
  location?: {
    pk: string
    short_name: string
    name: string
    address: string
    city: string
    lng?: number
    lat?: number
  }
  music_info?: {
    audio_cluster_id: string
    id: string
    title: string
    display_artist: string
    artist_id: string | null
    ig_username: string | null
  }
  caption?: string
}>

// https://stackoverflow.com/a/75212804
export type IWithMediaURL = ReadonlyDeep<{
  image_versions2: ImageVersions2
  video_versions?: VideoVersion[]
}>

export type IWithMedia = ReadonlyDeep<{ code: string; carousel_media: CarouselMedia[] } & IWithMediaURL>

export enum MediaDownloadOption {
  "all" = "all",
  "thumbnail" = "thumbnail",
  "none" = "none"
}

// The structure of the output data file
export type DataStore = ReadonlyDeep<{ url: string; download_media: MediaDownloadOption; posts: Post[] }>

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
  INVALID_COLLECTION_URL
}
