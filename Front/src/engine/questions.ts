import params from '../../rules/params-115.json'
import type { Care, Expecting, FieldKey, Household, NoWorkReason, Person, Range, Special } from './types'

export interface Option {
  label: string
  value: unknown
}

export interface Question {
  key: FieldKey
  title: string
  help?: string
  kind: 'choice' | 'number'
  options?: Option[]
  /** number 題的單位，例如「萬元」「歲」 */
  unit?: string
}

const yesNo: Option[] = [
  { label: '是', value: true },
  { label: '不是', value: false },
]
const hasNo: Option[] = [
  { label: '有', value: true },
  { label: '沒有', value: false },
]

const W = 10000
const r = (a: number, b: number): Range => [a, b]

/** 區間邊界刻意對齊門檻：低收 24.9 萬、基本工資 35.4 萬、中低 37.3 萬、租補 73.4 萬／85.6 萬（每人每年） */
const incomeOptions: Option[] = [
  { label: '沒有收入', value: r(0, 0) },
  { label: '25 萬以下', value: r(1, 25 * W) },
  { label: '25～37 萬', value: r(25 * W + 1, 37 * W) },
  { label: '37～60 萬', value: r(37 * W + 1, 60 * W) },
  { label: '60～73 萬', value: r(60 * W + 1, 73 * W) },
  { label: '73～86 萬', value: r(73 * W + 1, 86 * W) },
  { label: '86～120 萬', value: r(86 * W + 1, 120 * W) },
  { label: '120 萬以上', value: r(120 * W + 1, Infinity) },
]

const movableOptions: Option[] = [
  { label: '5 萬以下', value: r(0, 5 * W) },
  { label: '5～15 萬', value: r(5 * W + 1, 15 * W) },
  { label: '15～50 萬', value: r(15 * W + 1, 50 * W) },
  { label: '50～200 萬', value: r(50 * W + 1, 200 * W) },
  { label: '200 萬以上', value: r(200 * W + 1, Infinity) },
]

const realEstateOptions: Option[] = [
  { label: '300 萬以下', value: r(1, 300 * W) },
  { label: '300～837 萬', value: r(300 * W + 1, 837 * W) },
  { label: '837～1,255 萬', value: r(837 * W + 1, 1255 * W) },
  { label: '1,255 萬以上', value: r(1255 * W + 1, Infinity) },
]

const noWorkOptions: Option[] = [
  { label: '都沒有', value: 'none' satisfies NoWorkReason },
  { label: '在學', value: 'student' satisfies NoWorkReason },
  { label: '身心障礙', value: 'disabled' satisfies NoWorkReason },
  { label: '在家照顧家人', value: 'caregiver' satisfies NoWorkReason },
  { label: '懷孕', value: 'pregnant' satisfies NoWorkReason },
  { label: '重病', value: 'ill' satisfies NoWorkReason },
]

const specialOptions: Option[] = [
  { label: '都沒有', value: 'none' satisfies Special },
  { label: '離婚、喪偶或未婚生子，獨自扶養 18 歲以下孩子，而且沒辦法工作或月收入低於基本工資', value: 'singleParent' satisfies Special },
  { label: '配偶過世，或失蹤報案半年以上', value: 'widowed' satisfies Special },
  { label: '因配偶惡意遺棄或虐待而離婚', value: 'abandoned' satisfies Special },
  { label: '家庭暴力受害', value: 'violence' satisfies Special },
  { label: '未婚懷孕 3 個月以上，或生產後 2 個月內', value: 'unwedPregnant' satisfies Special },
  { label: '配偶服刑一年以上，正在執行', value: 'spousePrison' satisfies Special },
  { label: '最近 3 個月發生重大變故，生活陷入困難', value: 'crisis' satisfies Special },
]

const expectingOptions: Option[] = [
  { label: '懷孕中', value: 'pregnant' satisfies Expecting },
  { label: '有 60 天內出生的寶寶', value: 'newborn' satisfies Expecting },
  { label: '都沒有', value: 'none' satisfies Expecting },
]

const careOptions: Option[] = [
  { label: '家人自己帶', value: 'home' satisfies Care },
  { label: '公共或準公共托育（托嬰中心、居家保母）', value: 'public' satisfies Care },
  { label: '私立托嬰中心或一般保母', value: 'private' satisfies Care },
]

function parse(key: FieldKey): { person?: string; field: string } {
  const parts = key.split(':')
  return parts[0] === 'p' ? { person: parts[1], field: parts[2] } : { field: parts[1] }
}

export function getQuestion(h: Household, key: FieldKey): Question {
  const { person, field } = parse(key)
  const p = person ? h.people.find((x) => x.id === person)! : undefined
  const n = p?.name ?? '你'
  const incomeYear = params.values.rentIncomeYear.value
  switch (field) {
    case 'renting':
      return { key, title: '你現在在台北租房子住嗎？', kind: 'choice', options: yesNo }
    case 'landlordFamily':
      return {
        key,
        title: '房東是你的家人或親戚嗎？',
        help: '例如爸媽、祖父母。租家人的房子不能申請租補。',
        kind: 'choice',
        options: yesNo,
      }
    case 'newlywed':
      return { key, title: '你們是這兩年內結婚的嗎？', help: '新婚家庭的所得上限比較寬。', kind: 'choice', options: yesNo }
    case 'special':
      return {
        key,
        title: '你家有沒有以下狀況？',
        help: '用來判斷特殊境遇家庭扶助。只在你的手機上計算，不會上傳。',
        kind: 'choice',
        options: specialOptions,
      }
    case 'expecting':
      return { key, title: '家裡有人懷孕，或有 60 天內出生的寶寶嗎？', kind: 'choice', options: expectingOptions }
    case 'care':
      return {
        key,
        title: `${n}白天主要誰照顧？`,
        help: '育兒津貼和托育補助只能擇一：送公共或準公共托育的話，改領托育補助。',
        kind: 'choice',
        options: careOptions,
      }
    case 'age':
      return { key, title: `${n}今年幾歲？`, kind: 'number', unit: '歲' }
    case 'married':
      return { key, title: `${n}結婚了嗎？`, kind: 'choice', options: [{ label: '已婚', value: true }, { label: '未婚', value: false }] }
    case 'livesWith':
      return { key, title: `${n}跟你住在一起嗎？`, kind: 'choice', options: yesNo }
    case 'sameReg':
      return { key, title: `${n}的戶籍跟你在同一本戶口名簿嗎？`, kind: 'choice', options: yesNo }
    case 'income':
      return {
        key,
        title: `${n}去年報稅的所得大約多少？（一整年）`,
        help: `看的是報稅資料，不是現在的薪水。租補現在用 ${incomeYear} 年度（${incomeYear + 1911} 年）的所得。`,
        kind: 'choice',
        options: incomeOptions,
      }
    case 'incomeExact':
      return {
        key,
        title: `${n}去年報稅的所得，確切是多少？`,
        help: '剛好落在門檻附近，需要確切數字才能判斷。可以看綜所稅各類所得資料清單。',
        kind: 'number',
        unit: '萬元',
      }
    case 'ownsHome':
      return { key, title: `${n}名下有房子嗎？`, help: '有持分也算。', kind: 'choice', options: hasNo }
    case 'realEstate':
      return {
        key,
        title: `${n}名下房屋土地的公告現值大約多少？`,
        help: '公告現值通常遠低於市價，可以看房屋稅單或地價稅單。',
        kind: 'choice',
        options: realEstateOptions,
      }
    case 'movable':
      return { key, title: `${n}的存款加股票、基金大約多少？`, kind: 'choice', options: movableOptions }
    case 'noWork':
      return {
        key,
        title: `${n}現在有沒有以下狀況？`,
        help: '社會救助會把有工作能力、但收入低於基本工資的人，以基本工資推算收入。',
        kind: 'choice',
        options: noWorkOptions,
      }
  }
  throw new Error(`未知的題目：${key}`)
}

/** 回答後回傳新的家庭資料（不改原物件） */
export function applyAnswer(h: Household, key: FieldKey, value: unknown): Household {
  const { person, field } = parse(key)
  if (!person) return { ...h, [field]: value }
  return {
    ...h,
    people: h.people.map((p): Person => {
      if (p.id !== person) return p
      if (field === 'incomeExact') {
        const n = Math.round(Number(value) * W)
        return { ...p, income: [n, n] }
      }
      if (field === 'ownsHome' && value === false) return { ...p, ownsHome: false, realEstate: [0, 0] }
      return { ...p, [field]: value }
    }),
  }
}
