import type { FieldKey, Household, Person, ScopeMember } from './types'

/**
 * 每個補助方案對「家庭」的定義不同，這是一般人最搞不懂的地方。
 * 這個檔案只做一件事：依方案圈出「它認定的家庭」。
 */

export interface ScopeResult {
  included: Person[]
  excluded: ScopeMember[]
  /** 可能被排除的人：needs 為空代表要社工評估；有 needs 代表回答問題就能確定 */
  maybe: { person: Person; why: string; needs: FieldKey[] }[]
}

const m = (p: Person, why: string): ScopeMember => ({ id: p.id, name: p.name, why })

export const self = (h: Household): Person => h.people.find((p) => p.role === 'self')!

export function hasSpouse(h: Household): boolean {
  return h.people.some((p) => p.role === 'spouse')
}

export function isMinor(p: Person): boolean | null {
  return p.age === null ? null : p.age < 18
}

/** 單親：沒有配偶、有未成年子女 */
export function isSingleParent(h: Household): boolean {
  return !hasSpouse(h) && h.people.some((p) => p.role === 'child' && isMinor(p) === true)
}

/**
 * 300 億租金補貼（115/1/9 修正作業規定第 2 點第 4 款）：
 * 申請人、配偶、申請人或配偶的未成年子女（含胎兒）、受監護之人。
 */
export function rentScope(h: Household): ScopeResult {
  const r: ScopeResult = { included: [], excluded: [], maybe: [] }
  for (const p of h.people) {
    switch (p.role) {
      case 'self':
      case 'spouse':
        r.included.push(p)
        break
      case 'child': {
        const minor = isMinor(p)
        if (minor === true) r.included.push(p)
        else if (minor === false) r.excluded.push(m(p, '已成年的子女不算租補的家庭成員'))
        else r.maybe.push({ person: p, why: '要看是否未成年', needs: [`p:${p.id}:age`] })
        break
      }
      default:
        r.excluded.push(m(p, '租補只算你、配偶和未成年子女，不論戶籍在不在一起'))
    }
  }
  return r
}

/**
 * 社會救助法第 5 條「家庭應計算人口」：
 * 配偶、一親等直系血親、同一戶籍或共同生活的其他直系血親、認列扶養的納稅義務人。
 * 第 3 項列有可排除的情形（單親家庭未同住且無扶養事實的長輩、已婚未同住且無扶養能力的子女等）。
 */
export function socialScope(h: Household): ScopeResult {
  const r: ScopeResult = { included: [], excluded: [], maybe: [] }
  const singleParent = isSingleParent(h)
  for (const p of h.people) {
    switch (p.role) {
      case 'self':
      case 'spouse':
        r.included.push(p)
        break
      case 'father':
      case 'mother':
        if (singleParent && p.livesWith === false) {
          r.maybe.push({
            person: p,
            why: '單親家庭、沒同住且沒有扶養你的長輩，法律允許排除，但要社工評估',
            needs: [],
          })
        } else if (singleParent && p.livesWith === null) {
          r.maybe.push({ person: p, why: '要看有沒有住在一起', needs: [`p:${p.id}:livesWith`] })
        } else {
          r.included.push(p)
        }
        break
      case 'child': {
        const minor = isMinor(p)
        if (minor === null) {
          r.maybe.push({ person: p, why: '要看子女是否成年', needs: [`p:${p.id}:age`] })
        } else if (minor || p.married === false || (p.married === true && p.livesWith === true)) {
          r.included.push(p)
        } else if (p.married === null) {
          r.maybe.push({ person: p, why: '已婚且沒同住的子女有機會排除', needs: [`p:${p.id}:married`] })
        } else if (p.livesWith === null) {
          r.maybe.push({ person: p, why: '已婚且沒同住的子女有機會排除', needs: [`p:${p.id}:livesWith`] })
        } else {
          r.maybe.push({
            person: p,
            why: '已婚、沒同住的子女，若沒有扶養能力可排除，要社工評估',
            needs: [],
          })
        }
        break
      }
      case 'grandparent':
      case 'grandchild':
        if (p.sameReg === true || p.livesWith === true) {
          r.included.push(p)
        } else if (p.sameReg === false && p.livesWith === false) {
          r.excluded.push(m(p, '祖孫要同戶籍或同住才算'))
        } else {
          const needs: FieldKey[] = []
          if (p.sameReg === null) needs.push(`p:${p.id}:sameReg`)
          if (p.livesWith === null) needs.push(`p:${p.id}:livesWith`)
          r.maybe.push({ person: p, why: '祖孫要同戶籍或同住才算', needs })
        }
        break
      case 'sibling':
        r.excluded.push(m(p, '兄弟姊妹不算（除非他報稅時把你列為扶養）'))
        break
    }
  }
  return r
}

/** 一親等子女：未婚或同住就算；已婚且沒同住的，可請社工評估排除 */
function childOf(
  r: ScopeResult,
  p: Person,
  married: boolean | null,
  livesWith: boolean | null,
  marriedKey: FieldKey,
  livesKey: FieldKey,
  who: string,
) {
  if (married === false || livesWith === true) r.included.push(p)
  else if (married === null) r.maybe.push({ person: p, why: `${who}的子女，已婚且沒同住才有機會排除`, needs: [marriedKey] })
  else if (livesWith === null && livesKey) r.maybe.push({ person: p, why: `${who}的子女，已婚且沒同住才有機會排除`, needs: [livesKey] })
  else r.maybe.push({ person: p, why: `${who}已婚、沒同住的子女，若沒有扶養能力可排除，要社工評估`, needs: [] })
}

/**
 * 以「爸爸或媽媽」為申請人時的家庭範圍（中低收入老人生活津貼發給辦法第 3 條準用社會救助法第 5 條）。
 * 家裡的資料只輸入一次，換成長輩的角度重新圈人：
 *   另一位家長 → 配偶（假設爸媽是夫妻）
 *   你、你的兄弟姊妹 → 長輩的子女
 *   你的子女 → 長輩的孫子女，要跟長輩同住才算（以你是否跟長輩同住推估）
 *   你的配偶 → 不是長輩的直系血親，不算
 */
export function parentScope(h: Household, parent: Person): ScopeResult {
  const r: ScopeResult = { included: [parent], excluded: [], maybe: [] }
  const me = self(h)
  const who = parent.name
  for (const p of h.people) {
    if (p.id === parent.id) continue
    switch (p.role) {
      case 'father':
      case 'mother':
        r.included.push(p)
        break
      case 'self':
        childOf(r, p, hasSpouse(h), parent.livesWith, '', `p:${parent.id}:livesWith`, who)
        break
      case 'sibling':
        childOf(r, p, p.married, null, `p:${p.id}:married`, '', who)
        break
      case 'child':
        if (parent.livesWith === true) r.included.push(p)
        else if (parent.livesWith === false) r.excluded.push(m(p, `孫子女要跟${who}同戶籍或同住才算`))
        else r.maybe.push({ person: p, why: `孫子女要跟${who}同住才算`, needs: [`p:${parent.id}:livesWith`] })
        break
      case 'spouse':
        r.excluded.push(m(p, `${me.name}的配偶不是${who}的直系血親`))
        break
      default:
        r.excluded.push(m(p, `無法確定與${who}的關係，暫不計入`))
    }
  }
  return r
}

/** 祖孫等二親等以上的直系血親：要跟申請人同戶籍或同住才算（以「是否跟你同住」推估） */
function farRelative(r: ScopeResult, p: Person, applicantLivesWithYou: boolean | null, who: string) {
  const together = p.sameReg === true || p.livesWith === true
  const apart = p.sameReg === false && p.livesWith === false
  if (applicantLivesWithYou === true && together) r.included.push(p)
  else if (apart || applicantLivesWithYou === false) r.excluded.push(m(p, `要跟${who}同戶籍或同住才算`))
  else {
    const needs: FieldKey[] = []
    if (p.livesWith === null) needs.push(`p:${p.id}:livesWith`)
    if (p.sameReg === null && p.livesWith !== true) needs.push(`p:${p.id}:sameReg`)
    r.maybe.push({ person: p, why: `要跟${who}同戶籍或同住才算`, needs })
  }
}

/**
 * 以「你的子女」為申請人（例如替有身障的孩子申請）：
 *   你、你的配偶 → 孩子的爸媽（一親等），一定算
 *   你的爸媽、祖父母 → 孩子的祖輩，要同戶籍或同住才算
 *   孩子的兄弟姊妹（你的其他子女）→ 不是直系血親，不算
 */
export function childScope(h: Household, kid: Person): ScopeResult {
  const r: ScopeResult = { included: [kid], excluded: [], maybe: [] }
  const who = kid.name
  // 未成年子女視為跟你同住
  const kidWithYou = isMinor(kid) === true ? true : kid.livesWith
  for (const p of h.people) {
    if (p.id === kid.id) continue
    switch (p.role) {
      case 'self':
      case 'spouse':
        r.included.push(p)
        break
      case 'father':
      case 'mother':
      case 'grandparent':
        farRelative(r, p, kidWithYou, who)
        break
      case 'child':
        r.excluded.push(m(p, `${who}的兄弟姊妹不是直系血親`))
        break
      default:
        r.excluded.push(m(p, `不是${who}的直系血親，或關係無法確定`))
    }
  }
  return r
}

/**
 * 以「你的配偶」為申請人：你、你們的子女算；你的爸媽是配偶的公婆或岳父母，不算。
 * 配偶自己的爸媽也會被算進來，但本試算沒有輸入他們的資料。
 */
export function spouseScope(h: Household, sp: Person): ScopeResult {
  const r: ScopeResult = { included: [sp], excluded: [], maybe: [] }
  for (const p of h.people) {
    if (p.id === sp.id) continue
    switch (p.role) {
      case 'self':
        r.included.push(p)
        break
      case 'child':
        childOf(r, p, isMinor(p) ? false : p.married, p.livesWith, `p:${p.id}:married`, `p:${p.id}:livesWith`, sp.name)
        break
      case 'grandchild':
        farRelative(r, p, true, sp.name)
        break
      default:
        r.excluded.push(m(p, `不是${sp.name}的直系血親`))
    }
  }
  return r
}

/** 依申請人是誰，圈出社會救助法第 5 條的家庭；兄弟姊妹、祖孫當申請人時不支援，回傳 null */
export function anchorScope(h: Household, applicant: Person): ScopeResult | null {
  switch (applicant.role) {
    case 'self':
      return socialScope(h)
    case 'father':
    case 'mother':
      return parentScope(h, applicant)
    case 'child':
      return childScope(h, applicant)
    case 'spouse':
      return spouseScope(h, applicant)
    default:
      return null
  }
}
