import params from '../../rules/params-115.json'
import programs from '../../rules/programs.json'
import { anchorScope, hasSpouse, isMinor, rentScope, self, socialScope, type ScopeResult } from './household'
import { and, atMost, below, div, money, rangeText, sum, wan } from './range'
import type {
  Criterion,
  Evaluation,
  FieldKey,
  Household,
  Person,
  ProgramResult,
  Range,
  ScopeMember,
  Status,
  Tri,
} from './types'

const V = params.values
const MIN_LIVING = V.minLiving.value
const WAGE_YEAR = V.minWageMonthly.value * 12
const UNKNOWN: Range = [0, Infinity]

const uniq = (xs: FieldKey[]) => [...new Set(xs)]
const triToStatus = (t: Tri): Status => (t === 'pass' ? 'likely' : t === 'fail' ? 'no' : 'maybe')

// ---------- 個人數值 ----------

/** 16～64 歲且沒有在學、身障、照顧家人、懷孕、重病 → 有工作能力（社會救助法第 5-3 條） */
function workable(p: Person): boolean | null {
  if (p.age === null) return null
  if (p.age < 16 || p.age >= 65) return false
  if (p.disability && !['none', 'mild'].includes(p.disability)) return false
  if (p.noWork === null) return null
  return p.noWork === 'none'
}

interface IncomeOut {
  range: Range
  needs: FieldKey[]
  floored: boolean
}

/** mode=tax：租補直接看財稅所得；mode=social：社會救助會把有工作能力者以基本工資推算 */
function incomeOf(p: Person, mode: 'tax' | 'social'): IncomeOut {
  if (p.income === null) {
    if (p.age !== null && p.age < 16) return { range: [0, 0], needs: [], floored: false }
    return { range: UNKNOWN, needs: [`p:${p.id}:income`], floored: false }
  }
  const [lo, hi] = p.income
  if (mode === 'tax') return { range: [lo, hi], needs: [], floored: false }
  const w = workable(p)
  if (w === true && lo < WAGE_YEAR) {
    return { range: [Math.max(lo, WAGE_YEAR), Math.max(hi, WAGE_YEAR)], needs: [], floored: true }
  }
  if (w === null && lo < WAGE_YEAR) {
    return { range: [lo, Math.max(hi, WAGE_YEAR)], needs: [`p:${p.id}:noWork`], floored: false }
  }
  return { range: [lo, hi], needs: [], floored: false }
}

function movableOf(p: Person): { range: Range; needs: FieldKey[] } {
  if (p.movable !== null) return { range: p.movable, needs: [] }
  if (p.age !== null && p.age < 16) return { range: [0, 0], needs: [] }
  return { range: UNKNOWN, needs: [`p:${p.id}:movable`] }
}

function realEstateOf(p: Person): { range: Range; needs: FieldKey[] } {
  if (p.age !== null && p.age < 18 && p.ownsHome === null) return { range: [0, 0], needs: [] }
  if (p.ownsHome === false) return { range: [0, 0], needs: [] }
  if (p.ownsHome === null) return { range: UNKNOWN, needs: [`p:${p.id}:ownsHome`] }
  if (p.realEstate === null) return { range: [1, Infinity], needs: [`p:${p.id}:realEstate`] }
  return { range: p.realEstate, needs: [] }
}

/** 區間跨過門檻時，問確切數字 */
function exactNeeds(members: Person[], field: 'income'): FieldKey[] {
  return members
    .filter((p) => p[field] !== null && p[field]![0] !== p[field]![1])
    .map((p) => `p:${p.id}:${field}Exact`)
}

// ---------- 條件 ----------

function incomeCriterion(
  members: Person[],
  cap: number,
  mode: 'tax' | 'social',
  strict: boolean,
  label: string,
  cite: string,
): Criterion {
  const outs = members.map((p) => incomeOf(p, mode))
  const avgMonthly = div(sum(outs.map((o) => o.range)), members.length * 12)
  const tri = strict ? below(avgMonthly, cap) : atMost(avgMonthly, cap)
  let needs = uniq(outs.flatMap((o) => o.needs))
  if (tri === 'unknown' && needs.length === 0) needs = exactNeeds(members, 'income')
  const floored = members.filter((_, i) => outs[i].floored).map((p) => p.name)
  const known = isFinite(avgMonthly[1])
  let detail = `算 ${members.length} 人，平均每人每月所得 ${known ? rangeText(avgMonthly) : '還不確定'}，上限 ${money(cap)}。`
  if (mode === 'tax') detail += `看的是 ${V.rentIncomeYear.value} 年度報稅所得，不是現在的薪水。`
  if (floored.length) detail += `${floored.join('、')}有工作能力但收入低於基本工資，公所通常以基本工資推算。`
  return {
    id: 'income',
    label,
    tri,
    detail,
    gap:
      tri === 'fail'
        ? `平均每人每月至少 ${money(avgMonthly[0])}，超過上限 ${money(avgMonthly[0] - cap)}`
        : undefined,
    cite,
    needs: tri === 'unknown' ? needs : [],
  }
}

function movableCriterion(members: Person[], limit: number, cite: string): Criterion {
  const outs = members.map(movableOf)
  const avg = div(sum(outs.map((o) => o.range)), members.length)
  const tri = atMost(avg, limit)
  return {
    id: 'movable',
    label: '存款與投資',
    tri,
    detail: `平均每人 ${isFinite(avg[1]) ? rangeText(avg, wan) : '還不確定'}，上限每人 ${wan(limit)}。`,
    gap: tri === 'fail' ? `平均每人至少 ${wan(avg[0])}，超過上限 ${wan(avg[0] - limit)}` : undefined,
    cite,
    needs: tri === 'unknown' ? uniq(outs.flatMap((o) => o.needs)) : [],
  }
}

function realEstateCriterion(members: Person[], limit: number, cite: string): Criterion {
  const outs = members.map(realEstateOf)
  const total = sum(outs.map((o) => o.range))
  const tri = atMost(total, limit)
  return {
    id: 'realEstate',
    label: '房屋土地',
    tri,
    detail: `全家公告現值合計 ${isFinite(total[1]) ? rangeText(total, wan) : '還不確定'}，上限 ${wan(limit)}。公告現值通常比市價低很多。`,
    gap: tri === 'fail' ? `全家至少 ${wan(total[0])}，超過上限 ${wan(total[0] - limit)}` : undefined,
    cite,
    needs: tri === 'unknown' ? uniq(outs.flatMap((o) => o.needs)) : [],
  }
}

function noHomeCriterion(members: Person[]): Criterion {
  const owners = members.filter((p) => p.ownsHome === true)
  const unknown = members.filter((p) => p.ownsHome === null && !(p.age !== null && p.age < 18))
  const tri: Tri = owners.length ? 'fail' : unknown.length ? 'unknown' : 'pass'
  return {
    id: 'noHome',
    label: '家庭成員都沒有自有房屋',
    tri,
    detail: '租補的家庭成員（不含爸媽）名下都不能有房子。',
    gap: owners.length ? `${owners.map((p) => p.name).join('、')}名下有房子` : undefined,
    cite: 'rentForm115',
    needs: tri === 'unknown' ? unknown.map((p) => `p:${p.id}:ownsHome`) : [],
  }
}

// ---------- 家庭範圍顯示 ----------

function scopeView(sc: ScopeResult, applicantId: string) {
  return {
    included: sc.included.map<ScopeMember>((p) => ({
      id: p.id,
      name: p.name,
      why: p.id === applicantId ? '申請人' : '算進來',
    })),
    excluded: sc.excluded,
    maybeExcluded: sc.maybe.map<ScopeMember>((x) => ({ id: x.person.id, name: x.person.name, why: x.why })),
  }
}

// ---------- 共用：有「可能排除」的人時，算最壞與最好兩種情況 ----------

interface Decision {
  status: Status
  criteria: Criterion[]
  headline: string
  needs: FieldKey[]
  /** 算進所有可能的人（最壞） */
  worstMembers: Person[]
  /** 只算一定要算的人（最好） */
  bestMembers: Person[]
}

function decide(sc: ScopeResult, crits: (members: Person[]) => Criterion[], short: string): Decision {
  const all = [...sc.included, ...sc.maybe.map((x) => x.person)]
  const worst = crits(all)
  const triWorst = and(worst.map((c) => c.tri))
  let status: Status
  let criteria = worst
  let headline = ''
  const scopeNeeds = sc.maybe.flatMap((x) => x.needs)

  if (sc.maybe.length === 0) {
    status = triToStatus(triWorst)
  } else {
    const best = crits(sc.included)
    const triBest = and(best.map((c) => c.tri))
    if (triWorst === 'pass') status = 'likely'
    else if (triBest === 'fail') {
      status = 'no'
      criteria = best
    } else {
      status = 'maybe'
      if (triWorst === 'fail' && triBest === 'pass') {
        const names = sc.maybe.map((x) => x.person.name).join('、')
        headline = scopeNeeds.length
          ? `要看${names}算不算進來`
          : `如果社工評估可以把${names}排除，就會符合`
      }
    }
  }

  const needs = status === 'maybe' ? uniq([...scopeNeeds, ...criteria.flatMap((c) => c.needs)]) : []
  if (!headline) {
    const gap = criteria.find((c) => c.tri === 'fail')?.gap
    headline =
      status === 'likely'
        ? `很可能符合${short}標準`
        : status === 'no'
          ? `不符合：${gap}`
          : `可能符合，還要確認 ${needs.length} 件事`
  }
  return { status, criteria, headline, needs, worstMembers: all, bestMembers: sc.included }
}

// ---------- 社會救助：低收入戶、中低收入戶 ----------

function evalSocial(h: Household, kind: 'low' | 'mid'): ProgramResult {
  const prog = programs[kind]
  const sc = socialScope(h)
  const cap = kind === 'low' ? MIN_LIVING : V.midIncomeCap.value
  const movLimit = kind === 'low' ? V.movableLimitLow.value : V.movableLimitMid.value
  const reLimit = kind === 'low' ? V.realEstateLimitLow.value : V.realEstateLimitMid.value
  const cite = kind === 'low' ? 'mohw115' : 'tpeMid115'
  const d = decide(
    sc,
    (members) => [
      incomeCriterion(members, cap, 'social', false, '全家平均收入', cite),
      movableCriterion(members, movLimit, cite),
      realEstateCriterion(members, reLimit, cite),
    ],
    prog.short,
  )
  return {
    id: kind,
    program: kind,
    applicant: self(h).id,
    short: prog.short,
    name: prog.name,
    status: d.status,
    headline: d.headline,
    scope: scopeView(sc, self(h).id),
    criteria: d.criteria,
    amount: null,
    needs: d.needs,
    weight: prog.weight,
    impacts: [],
  }
}

// ---------- 個人津貼：中低收入老人生活津貼、身心障礙者生活補助 ----------
// 兩者都以申請人本人為中心圈家庭（準用社會救助法第 5 條），每位符合的家人各算一筆。

function movableTotalCriterion(members: Person[], base: number, step: number, cite: string): Criterion {
  const outs = members.map(movableOf)
  const total = sum(outs.map((o) => o.range))
  const limit = base + step * (members.length - 1)
  const tri = atMost(total, limit)
  return {
    id: 'movable',
    label: '全家存款與投資',
    tri,
    detail: `算 ${members.length} 人，合計 ${isFinite(total[1]) ? rangeText(total, wan) : '還不確定'}，上限 ${wan(limit)}（一人 ${wan(base)}，每多一人加 ${wan(step)}）。`,
    gap: tri === 'fail' ? `全家至少 ${wan(total[0])}，超過上限 ${wan(total[0] - limit)}` : undefined,
    cite,
    needs: tri === 'unknown' ? uniq(outs.flatMap((o) => o.needs)) : [],
  }
}

function avgMonthly(members: Person[]): Range {
  return div(sum(members.map((p) => incomeOf(p, 'social').range)), members.length * 12)
}

const levelName: Record<string, string> = {
  mild: '輕度',
  moderate: '中度',
  severe: '重度',
  profound: '極重度',
}

interface FamilyStatus {
  low: Status
  mid: Status
  /** 一定被算進低收入戶審查的人 */
  lowIn: Set<string>
  /** 可能被算進低收入戶審查的人 */
  lowMaybe: Set<string>
}

const amountRange = (a: { min: number; max: number }) =>
  a.min === a.max ? money(a.min) : `${money(a.min)}～${money(a.max)}`

function evalAllowance(
  h: Household,
  person: Person,
  sc: ScopeResult,
  kind: 'senior' | 'disability',
  fam: FamilyStatus,
): ProgramResult {
  const prog = programs[kind]
  const isSelf = person.role === 'self'
  const short = isSelf ? prog.short : `${prog.short}（${person.name}）`
  const name = isSelf ? prog.name : `${prog.name}（${person.name}）`
  const inFamily = fam.lowIn.has(person.id)
  const hasStatus = inFamily && (fam.low === 'likely' || fam.mid === 'likely')
  const mayGetLow = fam.low !== 'no' && (inFamily || fam.lowMaybe.has(person.id))
  const heavy = person.disability !== 'mild'

  // 申請資格與金額規則
  let firstCrit: Criterion
  let amountFor: (avg: Range, low: boolean) => [number, number]
  let caps: { income: number; movBase: number; movStep: number; re: number; cite: string; movCite: string }
  let note: string
  if (kind === 'senior') {
    const F = V.seniorFull.value
    const Hf = V.seniorHalf.value
    const fullCap = V.seniorFullCap.value
    firstCrit = {
      id: 'age',
      label: '65 歲以上',
      tri: 'pass',
      detail: `${person.name} ${person.age} 歲。另須設籍並實際居住臺北市、最近一年在國內住超過 183 天、沒有公費安置。`,
      cite: 'tpeSenior115',
      needs: [],
    }
    amountFor = (avg, low) => (low ? [F, F] : [avg[1] <= fullCap ? F : Hf, avg[0] <= fullCap ? F : Hf])
    caps = { income: V.seniorIncomeCap.value, movBase: V.seniorMovableBase.value, movStep: V.seniorMovableStep.value, re: V.seniorRealEstate.value, cite: 'tpeSenior115', movCite: 'seniorRule' }
    note = `全家平均每人每月 ${money(fullCap)} 以下領全額 ${money(F)}，${money(fullCap)}～${money(V.seniorIncomeCap.value)} 領半額 ${money(Hf)}。`
  } else {
    const general = heavy ? V.disHeavy.value : V.disMild.value
    const lowTier = heavy ? V.disLowHeavy.value : V.disLowMild.value
    firstCrit = {
      id: 'certificate',
      label: '身心障礙證明',
      tri: 'pass',
      detail: `${person.name}持有${levelName[person.disability ?? 'mild']}身心障礙證明。另須為臺北市核發或註記、設籍並實際居住臺北市、最近一年在國內住超過 183 天、未公費安置。`,
      cite: 'tpeDis115',
      needs: [],
    }
    amountFor = (_avg, low) => (low ? [lowTier, lowTier] : [general, general])
    caps = { income: V.disIncomeCap.value, movBase: V.disMovableBase.value, movStep: V.disMovableStep.value, re: V.disRealEstate.value, cite: 'tpeDis115', movCite: 'tpeDis115' }
    note = `${levelName[person.disability ?? 'mild']}：低收入戶每月 ${money(lowTier)}，中低收入戶或一般戶每月 ${money(general)}。`
  }

  const base = {
    id: `${kind}:${person.id}`,
    program: kind,
    applicant: person.id,
    short,
    name,
    scope: scopeView(sc, person.id),
    weight: prog.weight,
    impacts: [] as string[],
  }

  // 全家很可能列冊低收入戶或中低收入戶：老人津貼免審收入財產；身障補助由社會局主動核發
  if (hasStatus) {
    const [min] = amountFor([0, 0], fam.low === 'likely')
    const max = amountFor([0, 0], mayGetLow)[1]
    const amount = { min, max, unit: '元/月', note }
    return {
      ...base,
      status: 'likely',
      headline: `很可能符合，每月約 ${amountRange(amount)}`,
      criteria: [
        firstCrit,
        {
          id: 'exempt',
          label: '收入與財產',
          tri: 'pass',
          detail:
            kind === 'senior'
              ? '全家很可能取得低收入戶或中低收入戶身分（見上方），取得後免審查收入與財產。'
              : '全家很可能列冊低收入戶或中低收入戶（見上方），列冊後社會局會主動核發，不用另外申請。',
          cite: kind === 'senior' ? 'seniorRule' : 'tpeDis115',
          needs: [],
        },
      ],
      amount,
      needs: [],
    }
  }

  const d = decide(
    sc,
    (members) => [
      firstCrit,
      incomeCriterion(members, caps.income, 'social', false, '全家平均收入', caps.cite),
      movableTotalCriterion(members, caps.movBase, caps.movStep, caps.movCite),
      realEstateCriterion(members, caps.re, caps.cite),
    ],
    prog.short,
  )

  let amount: ProgramResult['amount'] = null
  if (d.status !== 'no') {
    const min = amountFor(avgMonthly(d.worstMembers), false)[0]
    const max = Math.max(amountFor(avgMonthly(d.bestMembers), false)[1], mayGetLow ? amountFor([0, 0], true)[1] : 0)
    const who = sc.maybe.map((x) => x.person.name).join('、')
    const why =
      min < max && kind === 'senior' && who ? `${who}算不算進來，會決定領全額或半額。` :
      min < max && mayGetLow ? '全家若取得低收入戶身分，金額會提高。' : ''
    amount = { min, max, unit: '元/月', note: why + note }
  }
  const headline = d.status === 'likely' && amount ? `很可能符合，每月約 ${amountRange(amount)}` : d.headline
  return { ...base, status: d.status, headline, criteria: d.criteria, amount, needs: d.needs }
}

/** 同一人同時符合老人津貼和身障補助：只能擇一，建議金額高的 */
function applyPickOne(results: ProgramResult[], h: Household) {
  const byPerson = new Map<string, ProgramResult[]>()
  for (const r of results) {
    if (r.status === 'no' || !r.amount) continue
    byPerson.set(r.applicant, [...(byPerson.get(r.applicant) ?? []), r])
  }
  for (const [pid, rs] of byPerson) {
    if (rs.length < 2) continue
    const who = h.people.find((p) => p.id === pid)!.name
    const best = [...rs].sort((a, b) => b.amount!.max - a.amount!.max || b.amount!.min - a.amount!.min)[0]
    for (const r of rs) {
      const others = rs.filter((x) => x !== r)
      r.conflict =
        r === best
          ? { chosen: true, note: `${who}也符合${others.map((x) => x.short).join('、')}，但只能擇一。這項每月最多 ${money(r.amount!.max)}，建議選這項。` }
          : { chosen: false, note: `${who}同時符合${best.short}，只能擇一。建議改領${best.short}（每月最多 ${money(best.amount!.max)}），這項就不用申請。` }
    }
  }
}

// ---------- 300 億租金補貼 ----------

function rentAmount(h: Household, members: Person[], hasLow: boolean, hasMid: boolean): number {
  const t = programs.rent300.amountTable
  const me = self(h)
  const age = me.age ?? 30
  const pregnant = members.some((p) => p.noWork === 'pregnant') || h.expecting === 'pregnant'
  const n = members.length + (pregnant ? 1 : 0)
  const kids = members.filter((p) => p.role === 'child').length + (pregnant ? 1 : 0)
  const econ = hasLow || hasMid
  const social = age >= 65 || members.some((p) => p.noWork === 'disabled' || (p.disability !== null && p.disability !== 'none'))
  const level = (n >= 2 && hasLow) || (n >= 3 && econ) ? 1 : n === 1 && age < 40 && !econ && !social ? 3 : 2
  const boosts = [1]
  if (age >= 18 && age < 40 && !hasSpouse(h)) boosts.push(t.boost.singleYouth)
  if (hasSpouse(h) && h.newlywed === true) boosts.push(t.boost.newlywed)
  if (kids > 0) {
    const c = t.boost.children
    boosts.push(kids <= c.length ? c[kids - 1] : c[c.length - 1] + t.boost.childStep * (kids - c.length))
  }
  if (econ) boosts.push(t.boost.economic)
  if (social) boosts.push(t.boost.social)
  const base = t.levels[String(level) as '1' | '2' | '3']
  return Math.round(base * Math.max(...boosts))
}

function evalRent(h: Household, low: Status, mid: Status): ProgramResult {
  const prog = programs.rent300
  const sc = rentScope(h)
  const members = [...sc.included, ...sc.maybe.map((x) => x.person)]
  const me = self(h)
  const criteria: Criterion[] = []

  criteria.push({
    id: 'adult',
    label: '申請人已成年',
    tri: me.age === null ? 'unknown' : me.age >= 18 ? 'pass' : 'fail',
    detail: '18 歲以上就能自己申請，不用跟爸媽分戶。',
    gap: '申請人未滿 18 歲',
    cite: 'case1631039',
    needs: me.age === null ? [`p:${me.id}:age`] : [],
  })
  criteria.push({
    id: 'renting',
    label: '在台北租屋',
    tri: h.renting === null ? 'unknown' : h.renting ? 'pass' : 'fail',
    detail: '要有租賃契約，房子在臺北市。',
    gap: '目前沒有租屋',
    cite: 'rentForm115',
    needs: h.renting === null ? ['h:renting'] : [],
  })
  if (h.renting !== false) {
    criteria.push({
      id: 'landlord',
      label: '房東不是家人',
      tri: h.landlordFamily === null ? 'unknown' : h.landlordFamily ? 'fail' : 'pass',
      detail: '出租人或房屋所有權人不能是你的家庭成員或直系親屬。',
      gap: '房東是家人或直系親屬',
      cite: 'rentForm115',
      needs: h.landlordFamily === null ? ['h:landlordFamily'] : [],
    })
  }
  criteria.push(noHomeCriterion(members))

  const hasMinor = members.some((p) => p.role === 'child' && isMinor(p) === true)
  const pregnant = members.some((p) => p.noWork === 'pregnant') || h.expecting === 'pregnant'
  const fixedFamily = hasMinor || pregnant || (hasSpouse(h) && h.newlywed === true)
  const cap3 = V.rentIncomeCap.value
  const cap35 = V.rentIncomeCapFamily.value
  const label = '家庭成員平均所得'
  if (fixedFamily || !hasSpouse(h) || h.newlywed === false) {
    criteria.push(incomeCriterion(members, fixedFamily ? cap35 : cap3, 'tax', true, label, fixedFamily ? 'case1631039' : 'rentForm115'))
  } else {
    // 已婚但不知道是不是新婚：兩種上限結果不同時才問
    const a = incomeCriterion(members, cap3, 'tax', true, label, 'rentForm115')
    const b = incomeCriterion(members, cap35, 'tax', true, label, 'case1631039')
    criteria.push(a.tri === b.tri ? a : { ...a, tri: 'unknown', needs: ['h:newlywed', ...a.needs] })
  }

  const tri = and(criteria.map((c) => c.tri))
  const status = triToStatus(tri)
  const scopeNeeds = sc.maybe.flatMap((x) => x.needs)
  const needs = status === 'maybe' ? uniq([...scopeNeeds, ...criteria.flatMap((c) => c.needs)]) : []

  let amount: ProgramResult['amount'] = null
  if (status !== 'no') {
    const min = rentAmount(h, members, low === 'likely', mid === 'likely')
    const max = rentAmount(h, members, low !== 'no', mid !== 'no' || low !== 'no')
    amount = {
      min,
      max,
      unit: '元/月',
      note: `${prog.amountTable.boostNote}實際補貼不會超過你的月租金。`,
    }
  }

  const gap = criteria.find((c) => c.tri === 'fail')?.gap
  const amt = amount ? (amount.min === amount.max ? money(amount.min) : `${money(amount.min)}～${money(amount.max)}`) : ''
  const headline =
    status === 'likely'
      ? `很可能符合，每月約 ${amt}`
      : status === 'no'
        ? `不符合：${gap}`
        : `可能符合（每月約 ${amt}），還要確認 ${needs.length} 件事`

  return {
    id: 'rent300',
    program: 'rent300',
    applicant: me.id,
    short: prog.short,
    name: prog.name,
    status,
    headline,
    scope: scopeView(sc, me.id),
    criteria,
    amount,
    needs,
    weight: prog.weight,
    impacts: [],
  }
}

// ---------- 特殊境遇家庭扶助：子女生活津貼、緊急生活扶助 ----------

const specialText: Record<string, string> = {
  widowed: '配偶過世或失蹤半年以上',
  abandoned: '因配偶惡意遺棄或虐待而離婚',
  violence: '家庭暴力受害',
  unwedPregnant: '未婚懷孕 3 個月以上或產後 2 個月內',
  singleParent: '獨自扶養 18 歲以下子女且不能工作或收入低於基本工資',
  spousePrison: '配偶服刑一年以上',
  crisis: '3 個月內發生重大變故',
}

/** 特殊境遇家庭扶助條例第 4-1 條：申請人、負扶養義務的直系血親卑親屬及其配偶；不算爸媽和配偶 */
function specialScope(h: Household): ScopeResult {
  const r: ScopeResult = { included: [], excluded: [], maybe: [] }
  for (const p of h.people) {
    switch (p.role) {
      case 'self':
        r.included.push(p)
        break
      case 'child': {
        const minor = isMinor(p)
        if (minor === true || p.married === false || p.livesWith === true) r.included.push(p)
        else if (minor === null) r.maybe.push({ person: p, why: '要看子女是否成年', needs: [`p:${p.id}:age`] })
        else if (p.married === null) r.maybe.push({ person: p, why: '已婚且沒同住的子女有機會排除', needs: [`p:${p.id}:married`] })
        else if (p.livesWith === null) r.maybe.push({ person: p, why: '已婚且沒同住的子女有機會排除', needs: [`p:${p.id}:livesWith`] })
        else r.maybe.push({ person: p, why: '已婚、沒同住、沒有工作收入的子女可以排除', needs: [] })
        break
      }
      case 'grandchild':
        if (p.livesWith === true) r.included.push(p)
        else r.excluded.push({ id: p.id, name: p.name, why: '沒有同住的孫子女不算' })
        break
      case 'spouse':
        r.excluded.push({ id: p.id, name: p.name, why: '特殊境遇的家庭範圍不含配偶' })
        break
      default:
        r.excluded.push({ id: p.id, name: p.name, why: '特殊境遇不算爸媽、兄弟姊妹（跟低收入戶不同）' })
    }
  }
  return r
}

function evalSpecial(h: Household, low: Status): ProgramResult[] {
  const me = self(h)
  const kids = h.people.filter((p) => p.role === 'child' && p.age !== null && p.age <= V.specialKidMaxAge.value)
  const minors = h.people.filter((p) => (p.role === 'child' || p.role === 'grandchild') && isMinor(p) === true)
  // 只在可能相關時才出現：65 歲以下，或家裡有未成年孩子
  const relevant = (me.age !== null && me.age <= 65) || minors.length > 0 || (h.special !== null && h.special !== 'none')
  if (!relevant) return []

  const sc = specialScope(h)
  const situation: Criterion = {
    id: 'situation',
    label: '特殊境遇情形',
    tri:
      h.special === null
        ? 'unknown'
        : h.special === 'none' || (h.special === 'widowed' && me.age !== null && me.age > 65)
          ? 'fail'
          : 'pass',
    detail: h.special && h.special !== 'none' ? `符合：${specialText[h.special]}。` : '要符合特殊境遇家庭扶助條例第 4 條的七種情形之一。',
    gap: h.special === 'widowed' ? '配偶過世的情形限 65 歲以下' : '沒有符合特殊境遇的情形',
    cite: 'tpeSpecial115',
    needs: h.special === null ? ['h:special'] : [],
  }
  const crits = (members: Person[]) => [
    situation,
    incomeCriterion(members, V.specialIncomeCap.value, 'social', false, '全家平均收入', 'tpeSpecial115'),
    movableCriterion(members, V.specialMovable.value, 'tpeSpecial115'),
    realEstateCriterion(members, V.specialRealEstate.value, 'tpeSpecial115'),
  ]
  const d = decide(sc, crits, '特殊境遇家庭')
  const scope = scopeView(sc, me.id)
  const out: ProgramResult[] = []

  // 子女生活津貼：第 1～3、5、6 款，且有 15 歲以下子女
  const kidSituations = ['widowed', 'abandoned', 'violence', 'singleParent', 'spousePrison']
  const kidCrit: Criterion = {
    id: 'kids',
    label: '有 15 歲以下子女',
    tri: kids.length ? 'pass' : 'fail',
    detail: kids.length ? `${kids.map((k) => k.name).join('、')}，每人每月 ${money(V.specialKidPerChild.value)}。` : '子女生活津貼補助 15 歲以下的子女或孫子女。',
    gap: '沒有 15 歲以下的子女',
    cite: 'specialAct',
    needs: [],
  }
  const kidTypeCrit: Criterion = {
    id: 'kidType',
    label: '適用子女生活津貼的情形',
    tri: h.special === null ? 'unknown' : kidSituations.includes(h.special) ? 'pass' : 'fail',
    detail: '未婚懷孕、重大變故不適用子女生活津貼，但可以申請緊急生活扶助。',
    gap: '這個情形不適用子女生活津貼',
    cite: 'specialAct',
    needs: [],
  }
  const kidStatus: Status =
    d.status === 'no' || kidCrit.tri === 'fail' || kidTypeCrit.tri === 'fail' ? 'no' : d.status
  const kidAmount = V.specialKidPerChild.value * kids.length
  const kp = programs.specialKids
  const kidCriteria = [...d.criteria, kidCrit, ...(h.special && h.special !== 'none' ? [kidTypeCrit] : [])]
  const kidGap = kidCriteria.find((c) => c.tri === 'fail')?.gap
  out.push({
    id: 'specialKids',
    program: 'specialKids',
    applicant: me.id,
    short: kp.short,
    name: kp.name,
    status: kidStatus,
    headline: kidStatus === 'no' ? `不符合：${kidGap}` : kidStatus === 'likely' ? `很可能符合，每月約 ${money(kidAmount)}` : d.headline,
    scope,
    criteria: kidCriteria,
    amount:
      kidStatus === 'no'
        ? null
        : { min: kidAmount, max: kidAmount, unit: '元/月', note: `${kids.length} 名 15 歲以下子女 × ${money(V.specialKidPerChild.value)}。每年申請一次；獨自扶養的情形每次補助 6 個月，可以申請延長。` },
    needs: kidStatus === 'maybe' ? d.needs : [],
    weight: kp.weight,
    impacts: [
      `只審查${sc.included.map((p) => p.name).join('、')}的收入和財產；爸媽、配偶的資料不會被調查。`,
      '已經領低收入戶生活扶助等同性質補助的話，只補差額。',
      '特殊境遇身分每年要重新申請認定。',
    ],
  })

  // 緊急生活扶助：七種情形都可以，一次發最低生活費 1～3 個月
  const ep = programs.specialEmergency
  const months = V.specialEmergencyMonths.value
  const perMonth = MIN_LIVING
  const eMin = perMonth * (low === 'no' ? months : months - 1)
  const eMax = perMonth * (low === 'likely' ? months - 1 : months)
  const emergencyAmount = { min: Math.min(eMin, eMax), max: Math.max(eMin, eMax) }
  out.push({
    id: 'specialEmergency',
    program: 'specialEmergency',
    applicant: me.id,
    short: ep.short,
    name: ep.name,
    status: d.status,
    headline:
      d.status === 'likely'
        ? `很可能符合，一次約 ${money(emergencyAmount.min)}${emergencyAmount.max > emergencyAmount.min ? `～${money(emergencyAmount.max)}` : ''}`
        : d.headline,
    scope,
    criteria: d.criteria,
    amount:
      d.status === 'no'
        ? null
        : { ...emergencyAmount, unit: '元（一次）', note: `每月 ${money(perMonth)}（最低生活費），最多 3 個月；已是低收入戶最多 2 個月。可以申請延長一次。` },
    needs: d.needs,
    weight: ep.weight,
    impacts: [
      '同一件事一家只能一個人申請，事情發生後 6 個月內要提出。',
      `只審查${sc.included.map((p) => p.name).join('、')}的收入和財產；爸媽、配偶的資料不會被調查。`,
      '核准後社工會定期訪視，生活改善後就會停止。',
    ],
  })
  return out
}

// ---------- 育兒津貼（未滿 2 歲） ----------

function evalChildcare(h: Household): ProgramResult[] {
  const me = self(h)
  const prog = programs.childcare
  const amounts = V.childcareAmounts.value as number[]
  // 出生排行：依年齡由大到小
  const kids = h.people
    .filter((p) => p.role === 'child')
    .sort((a, b) => (b.age ?? 0) - (a.age ?? 0))
  return kids
    .map((k, i) => ({ k, rank: i + 1 }))
    .filter(({ k }) => k.age !== null && k.age < V.childcareMaxAge.value)
    .map(({ k, rank }) => {
      const amount = amounts[Math.min(rank, amounts.length) - 1]
      const care: Criterion = {
        id: 'care',
        label: '沒有使用公共或準公共托育',
        tri: k.care === null ? 'unknown' : k.care === 'public' ? 'fail' : 'pass',
        detail: '自己帶或送私立托育都可以領；送公共或準公共托育改領托育補助。',
        gap: '已使用公共或準公共托育，改申請托育補助',
        cite: 'childcareRule',
        needs: k.care === null ? [`p:${k.id}:care`] : [],
      }
      const age: Criterion = {
        id: 'age',
        label: '未滿 2 歲',
        tri: 'pass',
        detail: `${k.name} ${k.age} 歲，是第 ${rank} 名子女，每月 ${money(amount)}。不看家庭收入。`,
        cite: 'childcareRule',
        needs: [],
      }
      const status = triToStatus(care.tri)
      const name = `${prog.name}（${k.name}）`
      return {
        id: `childcare:${k.id}`,
        program: 'childcare' as const,
        applicant: me.id,
        short: `${prog.short}（${k.name}）`,
        name,
        status,
        headline: status === 'likely' ? `很可能符合，每月 ${money(amount)}` : status === 'no' ? `不符合：${care.gap}` : '要看孩子白天誰照顧',
        scope: { included: [{ id: k.id, name: k.name, why: '幼兒' }], excluded: [], maybeExcluded: [] },
        criteria: [age, care],
        amount: status === 'no' ? null : { min: amount, max: amount, unit: '元/月', note: '第 1 名 5,000 元、第 2 名 6,000 元、第 3 名以上 7,000 元；排行依同一父母所生子女的出生順序。' },
        needs: care.needs,
        weight: prog.weight,
        impacts: [
          '由爸媽或監護人申請，按月撥入申請人帳戶；孩子滿 2 歲就停止。',
          '不看家庭收入，也不會調查其他家人的資料。',
          '送公共或準公共托育的月份改領托育補助，兩者只能擇一。',
        ],
      }
    })
}

// ---------- 臺北市生育補助 ----------

function evalBirth(h: Household): ProgramResult | null {
  const me = self(h)
  const spouse = h.people.find((p) => p.role === 'spouse')
  const young = [me, spouse].some((p) => p && p.age !== null && p.age <= 50)
  if (!young && (h.expecting === null || h.expecting === 'none')) return null
  const prog = programs.birth
  const amounts = V.birthAmounts.value as number[]
  const children = h.people.filter((p) => p.role === 'child').length
  // 懷孕中：下一胎排行＝現有子女數 + 1；60 天內出生：寶寶已在名單上
  const rank = h.expecting === 'pregnant' ? children + 1 : Math.max(children, 1)
  const amount = amounts[Math.min(rank, amounts.length) - 1]
  const crit: Criterion = {
    id: 'expecting',
    label: '懷孕中或 60 天內出生的寶寶',
    tri: h.expecting === null ? 'unknown' : h.expecting === 'none' ? 'fail' : 'pass',
    detail:
      h.expecting === 'pregnant'
        ? `寶寶會是第 ${rank} 名子女，出生後 60 天內申請 ${money(amount)}。`
        : h.expecting === 'newborn'
          ? `第 ${rank} 名新生兒，${money(amount)}，要在出生後 60 天內申請。`
          : '要在新生兒出生後 60 天內申請。',
    gap: '家裡沒有懷孕或 60 天內出生的寶寶',
    cite: 'birthRule',
    needs: h.expecting === null ? ['h:expecting'] : [],
  }
  const reg: Criterion = {
    id: 'registry',
    label: '設籍臺北市',
    tri: 'pass',
    detail: '爸或媽從寶寶出生（或預產）日前 10 個月起連續設籍臺北市，可併計新北市、基隆市（本試算假設符合）。',
    cite: 'birthRule',
    needs: [],
  }
  const status = triToStatus(crit.tri)
  return {
    id: 'birth',
    program: 'birth',
    applicant: me.id,
    short: prog.short,
    name: prog.name,
    status,
    headline: status === 'likely' ? `很可能符合，一次 ${money(amount)}` : status === 'no' ? `不符合：${crit.gap}` : '要看家裡有沒有人懷孕或剛生寶寶',
    scope: { included: [{ id: me.id, name: me.name, why: '申請人' }], excluded: [], maybeExcluded: [] },
    criteria: [crit, reg],
    amount: status === 'no' ? null : { min: amount, max: amount, unit: '元（一次）', note: '第 1 名 4 萬、第 2 名 4.5 萬、第 3 名以後每名 5 萬元。排行依同一父母所生子女的出生順序。' },
    needs: crit.needs,
    weight: prog.weight,
    impacts: [
      '由新生兒的媽媽申請（媽媽過世或行方不明時由爸爸申請），到戶政事務所辦理。',
      '不看收入，不會調查家人的資料。',
      ...(h.expecting === 'pregnant' ? ['寶寶出生後，未滿 2 歲期間自己帶或送私立托育，還可以領育兒津貼。'] : []),
    ],
  }
}

// ---------- 敬老卡、愛心卡 ----------

function evalCards(h: Household): ProgramResult[] {
  const prog = programs.card
  const pts = V.cardPoints.value
  return h.people
    .filter((p) => (p.age !== null && p.age >= 65) || (p.disability !== null && p.disability !== 'none'))
    .map((p) => {
      const elder = p.age !== null && p.age >= 65
      const disabled = p.disability !== null && p.disability !== 'none'
      const kind = elder && disabled ? '敬老卡或愛心卡（擇一張）' : elder ? '敬老卡' : '愛心卡'
      const isSelf = p.role === 'self'
      return {
        id: `card:${p.id}`,
        program: 'card' as const,
        applicant: p.id,
        short: isSelf ? kind.replace('（擇一張）', '') : `${kind.replace('（擇一張）', '')}（${p.name}）`,
        name: isSelf ? kind : `${kind}（${p.name}）`,
        status: 'likely' as const,
        headline: `每月 ${pts} 點`,
        scope: { included: [{ id: p.id, name: p.name, why: '本人' }], excluded: [], maybeExcluded: [] },
        criteria: [
          {
            id: 'who',
            label: elder ? '65 歲以上' : '有身心障礙證明',
            tri: 'pass' as const,
            detail: `${p.name}${elder ? ` ${p.age} 歲` : '持有身心障礙證明'}。須設籍並實際居住臺北市（本試算假設符合）。不看收入。`,
            cite: 'cardRule',
            needs: [],
          },
        ],
        amount: { min: pts, max: pts, unit: '點/月', note: '每點折算 1 元，可搭大眾運輸、用在部分市立場館與醫院掛號；點數當月歸零。' },
        needs: [],
        weight: prog.weight,
        impacts: [
          `${p.name}本人到任一區公所申請，不看收入，也不影響其他補助。`,
          '點數當月沒用完就歸零，很多人有卡卻沒用完，記得每個月用。',
          ...(elder && disabled ? ['每人只能有一張，敬老卡和愛心卡擇一張。'] : []),
        ],
      }
    })
}

// ---------- 國民年金老年基本保證年金 ----------

function evalPension(h: Household, p: Person): ProgramResult {
  const prog = programs.pension
  const isSelf = p.role === 'self'
  const incomeTri: Tri = p.income === null ? 'unknown' : atMost(p.income, V.pensionIncome.value)
  const reLimit = V.pensionRealEstate.value
  const re: Range | null = p.ownsHome === false ? [0, 0] : p.realEstate
  // 唯一自住房屋可再扣 400 萬：介於 500～900 萬之間要看是不是自住
  const reTri: Tri =
    p.ownsHome === null || (p.ownsHome && re === null)
      ? 'unknown'
      : re![1] <= reLimit
        ? 'pass'
        : re![0] > reLimit + 4000000
          ? 'fail'
          : 'unknown'
  const criteria: Criterion[] = [
    {
      id: 'age',
      label: '民國 32 年 10 月 1 日以前出生',
      tri: 'pass',
      detail: `${p.name} ${p.age} 歲（約 83 歲以上）。須在國內設籍、最近 3 年每年住國內超過 183 天，且沒有領軍公教勞農保的老年給付或退休金（本試算假設符合）。`,
      cite: 'pensionNews',
      needs: [],
    },
    {
      id: 'income',
      label: '本人所得',
      tri: incomeTri,
      detail: `只看${p.name}本人，一年所得不超過 50 萬元。`,
      gap: `${p.name}一年所得超過 50 萬元`,
      cite: 'pensionNews',
      needs: p.income === null ? [`p:${p.id}:income`] : [],
    },
    {
      id: 'realEstate',
      label: '本人房屋土地',
      tri: reTri,
      detail: '只看本人名下房地，不超過 500 萬元；唯一自住的房子可以再扣 400 萬元。',
      gap: `${p.name}名下房地超過上限`,
      cite: 'pensionNews',
      needs:
        p.ownsHome === null ? [`p:${p.id}:ownsHome`] : p.ownsHome && p.realEstate === null ? [`p:${p.id}:realEstate`] : [],
    },
  ]
  const status = triToStatus(and(criteria.map((c) => c.tri)))
  const amt = V.pensionAmount.value
  const gap = criteria.find((c) => c.tri === 'fail')?.gap
  return {
    id: `pension:${p.id}`,
    program: 'pension',
    applicant: p.id,
    short: isSelf ? prog.short : `${prog.short}（${p.name}）`,
    name: isSelf ? prog.name : `${prog.name}（${p.name}）`,
    status,
    headline: status === 'likely' ? `很可能符合，每月 ${money(amt)}` : status === 'no' ? `不符合：${gap}` : '可能符合，要確認房地是不是唯一自住',
    scope: { included: [{ id: p.id, name: p.name, why: '本人' }], excluded: [], maybeExcluded: [] },
    criteria,
    amount: status === 'no' ? null : { min: amt, max: amt, unit: '元/月', note: '行政院已通過草案要調到 5,000 元，要等立法院通過。' },
    needs: status === 'maybe' ? criteria.flatMap((c) => c.needs) : [],
    weight: prog.weight,
    impacts: [
      `申請人是${p.name}，錢撥到本人帳戶。`,
      '只看本人的所得和房地，不會調查家人的資料。',
    ],
  }
}

// ---------- 申請後對家人的影響 ----------

function impactsFor(r: ProgramResult, h: Household, all: ProgramResult[]): string[] {
  const nameOf = (id: string) => h.people.find((p) => p.id === id)!.name
  const list = (ids: string[]) => ids.map(nameOf).join('、')
  const inc = r.scope.included.map((m) => m.id)
  const maybe = r.scope.maybeExcluded.map((m) => m.id)
  const outside = h.people.map((p) => p.id).filter((id) => !inc.includes(id) && !maybe.includes(id))
  const apartIds = inc.filter((id) => {
    const p = h.people.find((x) => x.id === id)!
    return p.role !== 'self' && p.livesWith === false
  })
  const apart = apartIds.length ? `（包含沒同住的${list(apartIds)}）` : ''
  const me = self(h)
  const rent = all.find((x) => x.program === 'rent300')!
  const low = all.find((x) => x.program === 'low')!
  const out: string[] = []

  if (r.program === 'rent300') {
    out.push(
      outside.length
        ? `只審查${list(inc)}的所得和房子；${list(outside)}的資料不會被調查，也不影響他們自己的補助。`
        : `審查${list(inc)}的所得和房子。`,
    )
    out.push('家庭成員不能同時接受其他住宅補貼，例如社會住宅或其他租金補貼。')
    if (r.amount && r.amount.max > r.amount.min) {
      out.push(`全家先取得低收入戶或中低收入戶，租補可從每月 ${money(r.amount.min)} 升到 ${money(r.amount.max)}。`)
    }
    return out
  }

  if (r.program === 'low' || r.program === 'mid') {
    out.push(`全戶一起審查：${list(inc)}的收入、存款、房地都會被調查${apart}。`)
    if (maybe.length) out.push(`${list(maybe)}可以請社工評估排除，記得主動說明沒同住、沒扶養的情況。`)
    out.push('核定後全戶取得身分，可連動健保費補助等；每年會複查，收入或家庭狀況改變要主動通報。')
    const parentsOnlyHere = inc.filter(
      (id) => ['father', 'mother'].includes(h.people.find((p) => p.id === id)!.role) && !rent.scope.included.some((m) => m.id === id),
    )
    if (rent.status !== 'no' && parentsOnlyHere.length) {
      out.push(`跟租補不同：這裡會把${list(parentsOnlyHere)}算進來，租補不會。`)
    }
    if (rent.status !== 'no' && rent.amount && rent.amount.max > rent.amount.min) {
      out.push(`取得身分後，租補可升級為每月 ${money(rent.amount.max)}。`)
    }
    const elders = all.filter((x) => x.program === 'senior' && inc.includes(x.applicant)).map((x) => x.applicant)
    if (elders.length) out.push(`取得身分後，${list(elders)}的老人津貼免審收入與財產。`)
    const disabled = all.filter((x) => x.program === 'disability' && inc.includes(x.applicant)).map((x) => x.applicant)
    if (disabled.length) out.push(`列冊後，${list(disabled)}的身障生活補助由社會局主動核發，不用另外申請。`)
    if (r.program === 'mid' && low.status === 'likely') out.push('如果同時符合低收入戶，公所會核定為低收入戶。')
    return out
  }

  // 個人津貼
  const applicant = h.people.find((p) => p.id === r.applicant)!
  const minor = applicant.age !== null && applicant.age < 18
  out.push(`申請人是${applicant.name}，錢撥到${applicant.name}本人的帳戶${minor ? '，由你以法定代理人身分代為申請' : ''}。`)
  const others = inc.filter((id) => id !== applicant.id)
  if (others.length) {
    const meIn = others.includes(me.id) && applicant.id !== me.id
    out.push(
      `${list(others)}的收入和財產也會被調查${apart}，但不會減少他們自己的補助。` +
        (meIn ? `你的收入會影響${applicant.name}能不能領、領多少。` : ''),
    )
  }
  if (maybe.length) out.push(`${list(maybe)}可以請社工評估排除。`)
  // 擇一的建議已顯示在卡片上方的提示框，這裡只放一般規則
  if (!r.conflict && r.program === 'senior') out.push('與老農津貼、國民年金老年基本保證年金、身心障礙者生活補助只能擇一。')
  if (r.program === 'disability') out.push('所有政府生活補助津貼每月合計不能超過基本工資 29,500 元（低收入戶生活扶助、榮民就養金除外）。')
  return out
}

// ---------- 全家整合 ----------

export function evaluate(h: Household): Evaluation {
  const low = evalSocial(h, 'low')
  const mid = evalSocial(h, 'mid')
  const rent = evalRent(h, low.status, mid.status)
  const tips: string[] = []

  const fam: FamilyStatus = {
    low: low.status,
    mid: mid.status,
    lowIn: new Set(low.scope.included.map((m) => m.id)),
    lowMaybe: new Set(low.scope.maybeExcluded.map((m) => m.id)),
  }

  // 每位 65 歲以上或有身障證明的家人，各用他自己的角度圈家庭再算一次
  const personal: ProgramResult[] = []
  for (const p of h.people) {
    const elder = p.age !== null && p.age >= 65
    const disabled = p.disability !== null && p.disability !== 'none'
    if (!elder && !disabled) continue
    const sc = anchorScope(h, p)
    if (!sc) {
      const what = [elder && '老人津貼', disabled && '身障生活補助'].filter(Boolean).join('或')
      tips.push(`${p.name}也可能符合${what}，但要以${p.name}為主角另外試算（家庭範圍不同）。`)
      continue
    }
    if (elder) personal.push(evalAllowance(h, p, sc, 'senior', fam))
    if (disabled) personal.push(evalAllowance(h, p, sc, 'disability', fam))
  }
  // 老年基本保證年金：只看本人，任何家人都可以
  for (const p of h.people) {
    if (p.age !== null && p.age >= V.pensionMinAge.value) personal.push(evalPension(h, p))
  }
  // 老人津貼、身障補助、基本保證年金：同一人只能擇一
  applyPickOne(personal, h)

  const birth = evalBirth(h)
  const results = [
    rent,
    low,
    mid,
    ...personal,
    ...evalSpecial(h, low.status),
    ...evalChildcare(h),
    ...(birth ? [birth] : []),
    ...evalCards(h),
  ]
  for (const r of results) if (!r.impacts.length) r.impacts = impactsFor(r, h, results)
  return { results, tips }
}
