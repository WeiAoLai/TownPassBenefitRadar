/** 依 openapi.yaml v0.1.0 components.schemas 對應的型別。欄位名稱與後端契約一致。 */

export interface Badge {
  level: number
  name: string
  /** 15 分鐘有效的 S3 presigned URL */
  iconUrl: string
}

export interface CurrentUser {
  id: number
  account: string
  displayName: string
  artworkCount: number
  badge?: Badge | null
  createdAt: string
}

export interface Background {
  id: number
  name: string
  imageUrl: string
  unlockThreshold: number
  unlocked: boolean
}

export interface Policy {
  id: number
  category: string
  title: string
  slogan: string
  sourceUrl: string
  startDate: string
  endDate: string
}

export interface AuthorSummary {
  id: number
  displayName: string
  badge?: Badge | null
}

export interface Artwork {
  id: number
  owner: AuthorSummary
  backgroundId: number
  policyId: number
  sloganText: string
  imageUrl: string
  likeCount: number
  downloadCount: number
  likedByMe: boolean
  ownedByMe: boolean
  createdAt: string
}

export interface ArtworkPage {
  content: Artwork[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface CreateArtworkInput {
  image: Blob
  backgroundId: number
  policyId: number
  sloganText: string
}

export interface LikeState {
  artworkId: number
  liked: boolean
  likeCount: number
}

export interface LeaderboardEntry {
  rank: number
  score: number
  artwork: Artwork
}

/** RFC 9457 Problem Details + 穩定業務錯誤碼 */
export interface Problem {
  type: string
  title: string
  status: number
  detail?: string
  instance?: string
  code: string
  traceId: string
}

export interface DownloadResult {
  blob: Blob
  filename: string
}

/** 前端唯一依賴的 API 介面；http 與 mock 兩種實作都必須符合 */
export interface Api {
  getCurrentUser(): Promise<CurrentUser>
  listMyArtworks(page?: number, size?: number): Promise<ArtworkPage>
  listBackgrounds(): Promise<Background[]>
  listPolicyCategories(): Promise<string[]>
  listPolicies(category: string): Promise<Policy[]>
  getRandomPolicy(): Promise<Policy>
  listArtworks(page?: number, size?: number): Promise<ArtworkPage>
  createArtwork(input: CreateArtworkInput): Promise<Artwork>
  getArtwork(id: number): Promise<Artwork>
  likeArtwork(id: number): Promise<LikeState>
  unlikeArtwork(id: number): Promise<LikeState>
  downloadArtwork(id: number): Promise<DownloadResult>
  getLeaderboard(): Promise<LeaderboardEntry[]>
}
