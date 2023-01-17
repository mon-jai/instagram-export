// Generated from https://app.quicktype.io/, with 877 posts scraped on 17-1-2023 and some manual modification
// There will be some fields missing,
// some optional fields may wrongly marked as mandatory,
// and some types may not contain all possible values

export default interface InstagramPost {
  taken_at: number
  pk: string
  id: string
  device_timestamp: DeviceTimestamp
  media_type: number
  code: string
  client_cache_key: string
  filter_type: number
  is_unified_video: boolean
  should_request_ads: boolean
  original_media_has_visual_reply_media: boolean
  caption_is_edited: boolean
  like_and_view_counts_disabled: boolean
  commerciality_status: string
  is_paid_partnership: boolean
  is_visual_reply_commenter_notice_enabled: boolean
  clips_tab_pinned_user_ids: any[]
  has_delayed_metadata: boolean
  has_viewer_saved: boolean
  saved_collection_ids: string[]
  location?: Location
  lat?: number
  lng?: number
  comment_likes_enabled: boolean
  comment_threading_enabled: boolean
  max_num_visible_preview_comments: number
  has_more_comments?: boolean
  next_max_id?: string
  preview_comments?: Caption[]
  comments?: Caption[]
  comment_count: number
  carousel_media_count?: number
  carousel_media?: CarouselMedia[]
  can_see_insights_as_brand: boolean
  photo_of_you: boolean
  is_organic_product_tagging_eligible: boolean
  user: User
  can_viewer_reshare?: boolean
  like_count: number
  has_liked: boolean
  mashup_info?: MashupInfo
  caption: Caption | null
  comment_inform_treatment: CommentInformTreatment
  sharing_friction_info: SharingFrictionInfo
  can_viewer_save: boolean
  is_in_profile_grid: boolean
  profile_grid_control_enabled: boolean
  organic_tracking_token: string
  has_shared_to_fb: number
  product_type: ProductType
  deleted_reason: number
  integrity_review_decision: IntegrityReviewDecision
  commerce_integrity_review_decision: null
  music_metadata: MusicMetadata | null
  is_artist_pick: boolean
  can_view_more_preview_comments?: boolean
  hide_view_all_comment_entrypoint?: boolean
  inline_composer_display_condition?: InlineComposerDisplayCondition
  timeline_pinned_user_ids?: number[]
  usertags?: Usertags
  accessibility_caption?: string
  image_versions2?: ImageVersions2
  original_width?: number
  original_height?: number
  is_dash_eligible?: number
  video_dash_manifest?: string
  video_codec?: string
  number_of_qualities?: number
  video_versions?: VideoVersion[]
  has_audio?: boolean
  video_duration?: number
  view_count?: number
  play_count?: number
  clips_metadata?: ClipsMetadata
  media_cropping_info?: MediaCroppingInfo
  organic_post_id?: string
  expiring_at?: number
  sponsor_tags?: SponsorTag[]
  coauthor_producers?: CoauthorProducer[]
  coauthor_producer_can_see_organic_insights?: null
  is_sidecar_child?: boolean
  crosspost?: Crosspost[]
  comments_disabled?: boolean
  organic_cta_info?: OrganicCtaInfo
  dominant_color?: null | string
  cta_bar_info?: CtaBarInfo
  fb_like_count?: number
  fb_play_count?: number
  likers?: CoauthorProducer[]
  video_subtitles_confidence?: number
  video_subtitles_uri?: string
  thumbnails?: Thumbnails
  injected?: Injected
  is_sensitive_vertical_ad?: boolean
  collapse_comments?: boolean
  link?: null
  link_text?: string
  ad_action?: string
  link_hint_text?: string
  iTunesItem?: null
  ad_link_type?: number
  ad_header_style?: number
  dr_ad_type?: number
  ios_links?: IosLink[]
  android_links?: AndroidLink[]
  force_overlay?: boolean
  hide_nux_text?: boolean
  overlay_text?: string
  overlay_title?: string
  overlay_subtitle?: string
  fb_page_url?: string
  item_client_gap_rules?: ItemClientGapRules
  creative_config?: CreativeConfig
  commenting_disabled_for_viewer?: boolean
  nearly_complete_copyright_match?: boolean
  igtv_exists_in_viewer_series?: boolean
  is_post_live?: boolean
  title?: string
  invited_coauthor_producers?: any[]
  product_tags?: ProductTags
  shop_routing_user_id?: string
  carousel_media_type?: number
}

interface AndroidLink {
  linkType: number
  webUri: string
  androidClass: string
  package: string
  deeplinkUri: string
  callToActionTitle: string
  leadGenFormId: null
  igUserId: number
  appInstallObjectiveInvalidationBehavior: null
  referrerData: null
  isAndroidAppLink: null
}

interface Caption {
  pk: string
  user_id: string
  text: string
  type: number
  created_at: number
  created_at_utc: number
  content_type: string
  status: string
  bit_flags: number
  did_report_as_spam: boolean
  share_enabled: boolean
  user: CoauthorProducer
  is_covered: boolean
  is_ranked_comment: boolean
  media_id: string
  has_translation?: boolean
  private_reply_status: number
  hide_username?: boolean
  parent_comment_id?: string
  has_liked_comment?: boolean
  comment_like_count?: number
}

interface CoauthorProducer {
  pk: string
  username: string
  is_verified: boolean
  profile_pic_id?: string
  profile_pic_url: string
  fbid_v2?: string
  pk_id: string
  is_private: boolean
  full_name: string
  friendship_status?: CoauthorProducerFriendshipStatus
}

interface CoauthorProducerFriendshipStatus {
  following: boolean
  followed_by: boolean
  blocking: boolean
  muting: boolean
  is_private: boolean
  incoming_request: boolean
  outgoing_request: boolean
  is_bestie: boolean
  is_restricted: boolean
  is_feed_favorite: boolean
}

interface CarouselMedia {
  id: string
  media_type: number
  image_versions2: CarouselMediaImageVersions2
  original_width: number
  original_height: number
  accessibility_caption?: string
  pk: string
  carousel_parent_id: string
  commerciality_status?: string
  sharing_friction_info?: SharingFrictionInfo
  usertags?: Usertags
  video_versions?: VideoVersion[]
  video_duration?: number
  is_dash_eligible?: number
  video_dash_manifest?: string
  video_codec?: string
  number_of_qualities?: number
  dominant_color?: null | string
  product_tags?: CarouselMediaProductTags
  shop_routing_user_id?: string
  has_audio?: boolean
  creative_config?: CarouselMediaCreativeConfig
  headline?: Headline
  video_subtitles_uri?: null
  link?: string
  link_text?: string
  link_hint_text?: string
  ios_links?: IosLink[]
  android_links?: AndroidLink[]
  ad_action?: string
  ad_link_type?: number
  force_overlay?: boolean
  hide_nux_text?: boolean
  overlay_text?: string
  overlay_title?: string
  overlay_subtitle?: string
}

interface CarouselMediaCreativeConfig {
  camera_facing: string
  face_effect_id: string
  capture_type: string
  should_render_try_it_on: boolean
  failure_reason: string
  effect_preview: EffectPreview
}

interface EffectPreview {
  name: string
  id: string
  gatekeeper: null
  gatelogic: null
  attribution_user_id: string
  attribution_user: AttributionUser
  thumbnail_image: ThumbnailImage
  effect_actions: EffectAction[]
  effect_action_sheet: EffectActionSheet
  save_status: SaveStatus
  device_position: null
}

interface AttributionUser {
  instagram_user_id: string
  username: string
  profile_picture: ThumbnailImage
}

interface ThumbnailImage {
  uri: string
}

interface EffectActionSheet {
  primary_actions: PrimaryAction[]
  secondary_actions: SecondaryAction[]
}

type PrimaryAction = "TRY_IT" | "SAVE_TO_CAMERA" | "SENDTO" | "VIEW_EFFECT_PAGE"

type SecondaryAction = "EXPLORE_EFFECTS" | "MORE_BY_ACCOUNT" | "REPORT" | "SHARE_LINK"

type EffectAction = "REMOVE" | "PROFILE" | "REPORT" | "LICENSING"

type SaveStatus = "SAVED" | "NOT_SAVED"

interface Headline {
  content_type: string
  user: CoauthorProducer
  user_id: string
  pk: string
  text: string
  type: number
  created_at: number
  created_at_utc: number
  media_id: string
  bit_flags: number
  status: string
}

interface CarouselMediaImageVersions2 {
  candidates: Candidate[]
}

interface Candidate {
  width: number
  height: number
  url: string
}

interface IosLink {
  linkType: number
  webUri: string
  contentId: number
  productPageId: null
  isUniversalLink: null
  deeplinkUri: string
  callToActionTitle: string
  leadGenFormId: null
  igUserId: number
  appInstallObjectiveInvalidationBehavior: null
  skAdNetworkMetadata: null
}

interface CarouselMediaProductTags {
  in: PurpleIn[]
}

interface PurpleIn {
  product: Product
  is_removable: boolean
  position: number[]
  destination: number
}

interface Product {
  name: string
  price: string
  current_price: string
  full_price: string
  product_id: string
  compound_product_id: string
  merchant: Merchant
  description: string
  retailer_id: string
  has_viewer_saved: boolean
  main_image: Image
  main_image_id: string
  thumbnail_image: Image
  review_status: IntegrityReviewDecision
  external_url: string
  checkout_style: string
  can_share_to_story: boolean
  full_price_stripped: string
  current_price_stripped: string
  full_price_amount: string
  current_price_amount: string
  is_in_stock: boolean
  has_variants: boolean
  ig_is_product_editable_on_mobile: boolean
  commerce_review_statistics: CommerceReviewStatistics
  is_entered_in_drawing: boolean
  image_quality_metadata: ImageQualityMetadata
  size_calibration_score: string
  size_calibration_score_num_reviews: number
}

interface CommerceReviewStatistics {
  average_rating: number
  review_count: number
  rating_stars: string[]
}

interface ImageQualityMetadata {
  goodness: Goodness[]
  lifestyle_background: Goodness[]
}

interface Goodness {
  id: string
  score: number
}

interface Image {
  image_versions2: CarouselMediaImageVersions2
  preview: null | string
}

interface Merchant {
  pk: string
  username: string
  disabled_sharing_products_to_guides: boolean
  profile_pic_url: string
  storefront_attribution_username?: string
}

type IntegrityReviewDecision = "approved" | "pending"

interface SharingFrictionInfo {
  should_have_sharing_friction: boolean
  bloks_app_url: null
  sharing_friction_payload: null
}

interface Usertags {
  in: UsertagsIn[]
}

interface UsertagsIn {
  user: CoauthorProducer
  position: number[]
  start_time_in_video_in_sec: null
  duration_in_video_in_sec: null
}

export interface VideoVersion {
  type: number
  width: number
  height: number
  url: string
  id: string
}

interface ClipsMetadata {
  music_info: MusicInfo | null
  original_sound_info: OriginalSoundInfo | null
  audio_type: AudioType
  music_canonical_id: string
  featured_label: null
  mashup_info: MashupInfo
  nux_info: null
  viewer_interaction_settings: null
  branded_content_tag_info: BrandedContentTagInfo
  shopping_info: null
  additional_audio_info: AdditionalAudioInfo
  is_shared_to_fb: boolean
  breaking_content_info: null
  challenge_info: null
  reels_on_the_rise_info: null
  breaking_creator_info: null
  asset_recommendation_info: null
  contextual_highlight_info: null
  clips_creation_entry_point: ClipsCreationEntryPoint
  audio_ranking_info: AudioRankingInfo
  template_info: null
  is_fan_club_promo_video: boolean
  disable_use_in_clips_client_cache: boolean
  content_appreciation_info: ContentAppreciationInfo
  achievements_info: AchievementsInfo
  show_achievements: boolean
  show_tips: boolean
  merchandising_pill_info: null
  is_public_chat_welcome_video: boolean
  professional_clips_upsell_type: number
}

interface AchievementsInfo {
  show_achievements: boolean
  num_earned_achievements: null
}

interface AdditionalAudioInfo {
  additional_audio_username: null
  audio_reattribution_info: AudioReattributionInfo
}

interface AudioReattributionInfo {
  should_allow_restore: boolean
}

interface AudioRankingInfo {
  best_audio_cluster_id: string
}

type AudioType = "original_sounds" | "licensed_music"

interface BrandedContentTagInfo {
  can_add_tag: boolean
}

type ClipsCreationEntryPoint = "feed" | "clips" | ""

interface ContentAppreciationInfo {
  enabled: boolean
}

interface MashupInfo {
  mashups_allowed: boolean
  can_toggle_mashups_allowed: boolean
  has_been_mashed_up: boolean
  formatted_mashups_count: null
  original_media: null
  privacy_filtered_mashups_media_count: null
  non_privacy_filtered_mashups_media_count: number | null
  mashup_type: null
  is_creator_requesting_mashup: boolean
  has_nonmimicable_additional_audio: boolean
}

interface MusicInfo {
  music_asset_info: MusicAssetInfo
  music_consumption_info: MusicConsumptionInfo
  music_canonical_id: null
}

interface MusicAssetInfo {
  audio_cluster_id: string
  id: string
  title: string
  sanitized_title: null
  subtitle: string
  display_artist: string
  artist_id: null | string
  cover_artwork_uri: string
  cover_artwork_thumbnail_uri: string
  progressive_download_url: string
  reactive_audio_download_url: null
  fast_start_progressive_download_url: null | string
  web_30s_preview_download_url: null | string
  highlight_start_times_in_ms: number[]
  is_explicit: boolean
  dash_manifest: null
  has_lyrics: boolean
  audio_asset_id: string
  duration_in_ms: number
  dark_message: null
  allows_saving: boolean
  territory_validity_periods: TerritoryValidityPeriods | null
  ig_username: null | string
}

interface TerritoryValidityPeriods {}

interface MusicConsumptionInfo {
  ig_artist: CoauthorProducer | null
  placeholder_profile_pic_url: string
  should_mute_audio: boolean
  should_mute_audio_reason: string
  should_mute_audio_reason_type: null
  is_bookmarked: boolean
  overlap_duration_in_ms: number
  audio_asset_start_time_in_ms: number
  allow_media_creation_with_music: boolean
  is_trending_in_clips: boolean
  formatted_clips_media_count: null
  streaming_services: null
  display_labels: string[] | null
  should_allow_music_editing: boolean
}

interface OriginalSoundInfo {
  audio_asset_id: string
  music_canonical_id: null
  progressive_download_url: string
  duration_in_ms: number
  dash_manifest: string
  ig_artist: CoauthorProducer
  should_mute_audio: boolean
  hide_remixing: boolean
  original_media_id: string
  time_created: number
  original_audio_title: string
  consumption_info: ConsumptionInfo
  can_remix_be_shared_to_fb: boolean
  formatted_clips_media_count: null
  allow_creator_to_rename: boolean
  audio_parts: any[]
  is_explicit: boolean
  original_audio_subtype: string
  is_audio_automatically_attributed: boolean
  is_reuse_disabled: boolean
  is_xpost_from_fb: boolean
  xpost_fb_creator_info: null
}

interface ConsumptionInfo {
  is_bookmarked: boolean
  should_mute_audio_reason: string
  is_trending_in_clips: boolean
  should_mute_audio_reason_type: null
  display_media_id: null
}

interface CommentInformTreatment {
  should_have_inform_treatment: boolean
  text: string
  url: null
  action_type: null
}

interface CreativeConfig {
  effect_ids?: number[]
  capture_type: string
  creation_tool_info: CreationToolInfo[]
  effect_configs?: EffectConfig[]
}

interface CreationToolInfo {
  camera_tool: number
  duration_selector_seconds: number
  speed_selector: number
  color_filters: string
  appearance_effect: number
  timer_selector_seconds: number
}

interface EffectConfig {
  name: string
  id: string
  failure_reason: string
  failure_code: string
  is_creative_tool: boolean
  gatekeeper: null
  attribution_user_id: string
  attribution_user: AttributionUser
  gatelogic: null
  save_status: SaveStatus
  effect_actions: EffectAction[]
  is_spot_recognition_effect: boolean
  is_spot_effect: boolean
  thumbnail_image: ThumbnailImage
  effect_action_sheet: EffectActionSheet
  device_position: null
  fan_club: null
  formatted_clips_media_count: null
}

type Crosspost = "FB" | "IG"

interface CtaBarInfo {
  primary_text: string
  secondary_text: string
  cta_bar_type: string
  cta_bar_action_metadata: CtaBarActionMetadata
  default_cta_bar_style_metadata: DefaultCtaBarStyleMetadata
  animations_metadata: AnimationsMetadata[]
  should_hide_text_delimiter: boolean
}

interface AnimationsMetadata {
  animation_type: string
  dwell_time_sec: number
  animation_time_sec: number
  cta_bar_style_metadata: CtaBarStyleMetadata
}

interface CtaBarStyleMetadata {
  background_style: PrimaryTextStyleClass
}

interface PrimaryTextStyleClass {
  dark: PrimaryTextStyleDark
  light: PrimaryTextStyleDark
}

interface PrimaryTextStyleDark {
  color: string
}

interface CtaBarActionMetadata {
  action_type: string
}

interface DefaultCtaBarStyleMetadata {
  background_style: SecondaryTextStyleClass
  primary_text_style: PrimaryTextStyleClass
  secondary_text_style: SecondaryTextStyleClass
}

interface SecondaryTextStyleClass {
  dark: SecondaryTextStyleDark
  light: SecondaryTextStyleDark
}

interface SecondaryTextStyleDark {
  alpha: number
  color: string
}

type DeviceTimestamp = number | string

export interface ImageVersions2 {
  candidates: Candidate[]
  additional_candidates?: AdditionalCandidates
  smart_thumbnail_enabled?: boolean
}

interface AdditionalCandidates {
  igtv_first_frame: Candidate
  first_frame: Candidate
  smart_frame: Candidate | null
}

interface Injected {
  label: string
  show_icon: boolean
  hide_label: string
  is_demo: boolean
  view_tags: any[]
  is_holdout: boolean
  tracking_token: null
  show_ad_choices: boolean
  ad_title: string
  about_ad_params: string
  direct_share: boolean
  ad_id: string
  campaign_id: string
  app_id: string
  fb_app_id: string
  page_id: string
  actor_id: string
  media_id: string
  display_viewability_eligible: boolean
  ads_debug_info: null
  should_show_secondary_cta_on_profile: boolean
  creation_source: null
  invalidation_rules: InvalidationRules
  is_luxury_vertical_ad: boolean
  is_shops_ifu_eligible: boolean
  is_bau_ifu_eligible: boolean
  brs_threshold: number
  phone_number: null
  hide_reasons: HideReason[]
  hide_flow_type: number
  ctd_ads_info: CtdAdsInfo
  global_position: number
  is_post_click_afi_eligible: boolean
  is_consent_growth_ifu_eligible: boolean
  is_consent_growth_popup_eligible: boolean
  adtaxon_i18n_top1_l7_prediction: string
  cop_render_output: null
}

interface CtdAdsInfo {
  business_responsiveness_time_text: null
  welcome_message_text: null
  business_response_time_in_sec: null
}

interface HideReason {
  ad?: string
  sponsor?: string
}

interface InvalidationRules {
  meta_ids: string[]
  local_surface: LocalSurface[]
}

interface LocalSurface {
  instruction: Instruction
}

interface Instruction {
  signal: string
  conditions?: Condition[]
}

interface Condition {
  lhs: string
  comparator: string
  rhs: number
}

type InlineComposerDisplayCondition = "impression_trigger" | "never"

interface ItemClientGapRules {
  time_based_insertion_gap_in_seconds: null
  push_up_min_gap: null
  enable_user_engagement_base_insertion: boolean
  user_engagement_based_insertion_settings: null
}

interface Location {
  pk: string
  short_name: string
  facebook_places_id: string
  external_source: string
  name: string
  address: string
  city: string
  has_viewer_saved: boolean
  lng?: number
  lat?: number
  is_eligible_for_guides: boolean
}

interface MediaCroppingInfo {
  square_crop?: SquareCrop
}

interface SquareCrop {
  crop_left: number
  crop_right: number
  crop_top: number
  crop_bottom: number
}

interface MusicMetadata {
  music_canonical_id: string
  audio_type: AudioType | null
  music_info: MusicInfo | null
  original_sound_info: null
  pinned_media_ids: any[] | null
}

interface OrganicCtaInfo {
  cta_type: string
  cta_title: string
  cta_subtitle: string
  cta_action_links: null
}

interface ProductTags {
  in: FluffyIn[]
}

interface FluffyIn {
  product: Product
  is_removable: boolean
  destination: number
}

type ProductType = "carousel_container" | "feed" | "clips" | "ad" | "igtv"

interface SponsorTag {
  permission: boolean
  sponsor: CoauthorProducer
  is_pending: boolean
  sponsor_id: null
  username: null
}

interface Thumbnails {
  video_length: number
  thumbnail_width: number
  thumbnail_height: number
  thumbnail_duration: number
  sprite_urls: string[]
  thumbnails_per_row: number
  total_thumbnail_num_per_sprite: number
  max_thumbnails_per_sprite: number
  sprite_width: number
  sprite_height: number
  rendered_width: number
  file_size_kb: number
}

interface User {
  pk: string
  username: string
  is_verified: boolean
  friendship_status: PurpleFriendshipStatus
  profile_pic_id?: string
  profile_pic_url: string
  pk_id: string
  is_private: boolean
  full_name: string
  account_badges: any[]
  has_anonymous_profile_picture: boolean
  fan_club_info: FanClubInfo
  transparency_product_enabled: boolean
  is_favorite: boolean
  is_unpublished: boolean
  latest_reel_media: number
  show_shoppable_feed?: boolean
  shoppable_posts_count?: number
  merchant_checkout_style?: string
  seller_shoppable_feed_type?: string
  has_active_affiliate_shop?: boolean
  show_account_transparency_details?: boolean
  linked_fb_info?: LinkedFbInfo
  storefront_attribution_username?: string
}

interface FanClubInfo {
  fan_club_id: null
  fan_club_name: null
  is_fan_club_referral_eligible: null
  fan_consideration_page_revamp_eligiblity: null
  is_fan_club_gifting_eligible: null
}

interface PurpleFriendshipStatus {
  following: boolean
  outgoing_request: boolean
  is_bestie: boolean
  is_restricted: boolean
  is_feed_favorite: boolean
}

interface LinkedFbInfo {
  linked_fb_user: LinkedFbUser
}

interface LinkedFbUser {
  id: string
  name: string
  is_valid: boolean
  fb_account_creation_time: null
  link_time: null
}