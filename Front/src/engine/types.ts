/** 區間 [最小, 最大]，Infinity 代表沒有上限。不知道確切數字時用區間表示。 */
export type Range = [number, number]

export type Tri = 'pass' | 'fail' | 'unknown'
export type Status = 'likely' | 'maybe' | 'no'

export type Role =
  | 'self'
  | 'spouse'
  | 'father'
  | 'mother'
  | 'child'
  | 'grandparent'
  | 'grandchild'
  | 'sibling'

/** 身心障礙證明等級；none 代表沒有證明 */
export type Disability = 'none' | 'mild' | 'moderate' | 'severe' | 'profound'

/** 未滿 2 歲幼兒白天誰照顧（育兒津貼與托育補助擇一） */
export type Care = 'home' | 'public' | 'private'

/** 特殊境遇家庭扶助條例第 4 條第 1 項的七種情形 */
export type Special =
  | 'widowed'
  | 'abandoned'
  | 'violence'
  | 'unwedPregnant'
  | 'singleParent'
  | 'spousePrison'
  | 'crisis'
  | 'none'

export type Expecting = 'pregnant' | 'newborn' | 'none'

/** 為什麼沒有工作能力（社會救助法的「有工作能力」判斷用） */
export type NoWorkReason = 'student' | 'disabled' | 'caregiver' | 'pregnant' | 'ill' | 'none'

export interface Person {
  id: string
  role: Role
  /** 畫面上的稱呼，例如「你」「爸爸」「大女兒」 */
  name: string
  age: number | null
  married: boolean | null
  /** 跟你在同一本戶口名簿 */
  sameReg: boolean | null
  livesWith: boolean | null
  /** 去年（審查年度）報稅所得，年 */
  income: Range | null
  ownsHome: boolean | null
  /** 名下房屋土地公告現值合計 */
  realEstate: Range | null
  /** 存款加股票、基金 */
  movable: Range | null
  noWork: NoWorkReason | null
  disability: Disability | null
  care: Care | null
}

export interface Household {
  people: Person[]
  /** 現在是否在台北租屋 */
  renting: boolean | null
  /** 房東是不是家人或直系親屬 */
  landlordFamily: boolean | null
  /** 申請前兩年內結婚 */
  newlywed: boolean | null
  /** 特殊境遇（只在你的手機上計算） */
  special: Special | null
  /** 家裡有人懷孕，或有 60 天內出生的寶寶 */
  expecting: Expecting | null
}

/** 可以問的欄位。p:<人>:<欄位> 或 h:<欄位> */
export type FieldKey = string

export interface Criterion {
  id: string
  /** 白話的條件名稱 */
  label: string
  tri: Tri
  /** 這個條件的計算說明，含數字 */
  detail: string
  /** 不符合時差在哪 */
  gap?: string
  cite: string
  /** 判斷不出來時，問哪些欄位可以幫忙 */
  needs: FieldKey[]
}

export interface ScopeMember {
  id: string
  name: string
  why: string
}

export interface Scope {
  included: ScopeMember[]
  excluded: ScopeMember[]
  /** 法律有例外、需要社工評估才能排除的人 */
  maybeExcluded: ScopeMember[]
}

export type ProgramKey =
  | 'rent300'
  | 'low'
  | 'mid'
  | 'senior'
  | 'disability'
  | 'pension'
  | 'specialKids'
  | 'specialEmergency'
  | 'childcare'
  | 'birth'
  | 'card'

export interface ProgramResult {
  /** 結果的唯一 id；老人津貼每位長輩一筆，例如 senior:father3 */
  id: string
  program: ProgramKey
  /** 申請人是誰（老人津貼才有意義） */
  applicant: string
  /** 狀態列、表格用的短名稱 */
  short: string
  name: string
  status: Status
  /** 一句話結論 */
  headline: string
  scope: Scope
  criteria: Criterion[]
  /** unit：元/月、元（一次）、點/月 */
  amount: { min: number; max: number; unit: string; note: string } | null
  needs: FieldKey[]
  weight: number
  /** 申請後對家人的影響、會不會被調查、能不能跟其他補助一起領 */
  impacts: string[]
  /** 同一人同時符合、但只能擇一的補助 */
  conflict?: { chosen: boolean; note: string }
}

export interface Evaluation {
  results: ProgramResult[]
  /** 跨方案的建議，例如「先拿到低收入戶身分，租補會升級」 */
  tips: string[]
}
