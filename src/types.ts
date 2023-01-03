import { ReadonlyDeep } from "type-fest"

// The following types are created for constructing other types

type Location = {
  pk: number
  short_name: string
  name: string
  address: string
  city: string
  lng: number
  lat: number
}
type User = { pk: number; username: string; full_name: string }
type Caption = { pk: string; text: string; created_at: number }
type Image = { image_versions2: { candidates: { url: string }[] } }
// All videos contain an "image_versions2" key
type Video = Image & { video_versions: [{ url: string }] }
type Carousel = { carousel_media: (Image | Video)[] }
type UndocumentedProperties = { [Key: string]: any }

// The following types are not meant to be altered once created,
// so we mark them as ReadonlyDeep
// The properties of a Instagram post that will be extracted and saved in the output data file

export type Post = ReadonlyDeep<{
  pk: string
  id: string
  media_type: number
  code: string
  location?: Location
  user: User
  caption?: Caption
}>

// The data structure Instagram used to store posts
// Properties that are not used will not be documented
export type RawPost = ReadonlyDeep<
  Omit<Post, "location" | "user" | "caption"> & {
    location?: Location & UndocumentedProperties
    user: User & UndocumentedProperties
    caption: (Caption & UndocumentedProperties) | null
  } & (Image | Video | Carousel)
>
// The raw data format returned by Instagram
export type InstagramResponse = ReadonlyDeep<{ items: [{ media: RawPost }] }>

// Data structure used in getUrl()
export type Media = ReadonlyDeep<Image | Video>
// The structure of the output data file
export type DataStore = ReadonlyDeep<{ url: string; username: string; download_media: boolean; posts: Post[] }>
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
  NOT_INITIALIZED,
  NO_NEW_POST,
  NO_OVERLAP,
  RATE_LIMIT_REACHED,
  PASSWORD_NOT_FOUND,
  DOWNLOAD_FAILED,
}
