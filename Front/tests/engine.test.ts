import { describe, expect, it } from 'vitest'
import { evaluate } from '../src/engine/evaluate'
import { nextQuestion } from '../src/engine/nextQuestion'
import { applyAnswer, getQuestion } from '../src/engine/questions'
import { emptyHousehold, newPerson, personas } from '../src/engine/personas'
import type { Household } from '../src/engine/types'

const byId = (h: Household) => {
  const ev = evaluate(h)
  return { ev, rent: ev.results[0], low: ev.results[1], mid: ev.results[2] }
}
const persona = (id: string) => personas().find((p) => p.id === id)!.household

describe('小安：成年單身、戶籍在爸媽家', () => {
  const { rent, low, ev } = byId(persona('xiaoan'))

  it('租補只算他自己，爸媽的房子不影響', () => {
    expect(rent.scope.included.map((m) => m.name)).toEqual(['你'])
    expect(rent.status).toBe('likely')
  })

  it('第三級 3,000 × 單身青年 1.2 倍 = 3,600 元', () => {
    expect(rent.amount).toMatchObject({ min: 3600, max: 3600 })
  })

  it('低收入戶會把沒同住的爸媽算進來，所以不符合', () => {
    expect(low.scope.included.map((m) => m.name)).toEqual(['你', '爸爸', '媽媽'])
    expect(low.status).toBe('no')
    // 租補不調查爸媽；低收入戶會，且明講跟租補不同
    expect(ev.results[0].impacts[0]).toContain('爸爸、媽媽的資料不會被調查')
    expect(low.impacts.some((t) => t.includes('跟租補不同'))).toBe(true)
  })
})

describe('美玲：單親媽媽，媽媽沒同住', () => {
  const { rent, low, mid } = byId(persona('meiling'))

  it('低收入戶取決於社工能不能排除媽媽', () => {
    expect(low.status).toBe('maybe')
    expect(low.scope.maybeExcluded.map((m) => m.name)).toEqual(['媽媽'])
    expect(low.headline).toContain('排除')
  })

  it('中低收入戶即使算進媽媽也符合', () => {
    expect(mid.status).toBe('likely')
  })

  it('租補 3 人、有中低收入戶 → 第一級 8,000 × 兩名子女 1.6 倍', () => {
    expect(rent.status).toBe('likely')
    expect(rent.amount).toMatchObject({ min: 12800, max: 12800 })
  })
})

describe('阿嬌阿嬤：獨居、兒子已婚沒同住', () => {
  const { rent, low } = byId(persona('ama'))

  it('沒有租屋，租補不適用', () => {
    expect(rent.status).toBe('no')
  })

  it('若社工評估排除兒子就符合低收入戶', () => {
    expect(low.status).toBe('maybe')
    expect(low.scope.maybeExcluded.map((m) => m.name)).toEqual(['兒子'])
  })
})

describe('中低收入老人生活津貼', () => {
  const senior = (h: Household, who: string) => evaluate(h).results.find((r) => r.id === `senior:${who}`)

  it('阿嬤：社工評估排除兒子就能領全額 8,329 元', () => {
    const h = persona('ama')
    const s = senior(h, 'self')!
    expect(s.status).toBe('maybe')
    expect(s.scope.maybeExcluded.map((m) => m.name)).toEqual(['兒子'])
    expect(s.amount?.max).toBe(8329)
  })

  it('志明：用爸爸的角度圈家庭，志明自己和已婚妹妹都會被算進來', () => {
    const h = persona('zhiming')
    const dadId = h.people.find((p) => p.role === 'father')!.id
    const { results } = evaluate(h)
    const dad = results.find((r) => r.id === `senior:${dadId}`)!
    expect(dad.scope.included.map((m) => m.name).sort()).toEqual(['你', '媽媽', '爸爸'].sort())
    expect(dad.scope.maybeExcluded.map((m) => m.name)).toEqual(['妹妹'])
    // 算進妹妹：平均 49,167 元超過 39,960 元；排除妹妹：32,222 元，落在半額區間
    expect(dad.status).toBe('maybe')
    expect(dad.amount).toMatchObject({ min: 4164, max: 4164 })
    expect(dad.impacts.some((t) => t.includes('你的收入會影響爸爸能不能領'))).toBe(true)
    // 媽媽 70 歲也各算一筆
    expect(results.filter((r) => r.program === 'senior')).toHaveLength(2)
  })

  it('全家很可能是低收入戶時，長輩免審收入與財產、領全額', () => {
    const h: Household = {
      people: [
        newPerson('self', { age: 70, married: false, income: [0, 0], ownsHome: false, realEstate: [0, 0], movable: [0, 50000], noWork: 'none' }),
      ],
      renting: false,
      landlordFamily: null,
      newlywed: null,
      special: 'none',
      expecting: 'none',
    }
    const s = senior(h, 'self')!
    expect(s.status).toBe('likely')
    expect(s.criteria.some((c) => c.id === 'exempt')).toBe(true)
    expect(s.amount).toMatchObject({ min: 8329, max: 8329 })
  })

  it('65 歲以下的人不會出現老人津貼', () => {
    expect(evaluate(persona('xiaoan')).results.some((r) => r.program === 'senior')).toBe(false)
  })
})

describe('身心障礙者生活補助', () => {
  it('美玲的小兒子：以孩子為中心圈家庭，姊姊和外婆不算；列冊中低收入戶後主動核發', () => {
    const h = persona('meiling')
    const kid = h.people.find((p) => p.name === '小兒子')!
    const r = evaluate(h).results.find((x) => x.id === `disability:${kid.id}`)!
    expect(r.scope.included.map((m) => m.name).sort()).toEqual(['你', '小兒子'].sort())
    expect(r.scope.excluded.map((m) => m.name).sort()).toEqual(['大女兒', '媽媽'].sort())
    expect(r.status).toBe('likely')
    expect(r.criteria.some((c) => c.id === 'exempt')).toBe(true)
    // 中低收入戶 5,437 元；若全家取得低收入戶，中度以上 9,485 元
    expect(r.amount).toMatchObject({ min: 5437, max: 9485 })
    expect(r.impacts[0]).toContain('由你以法定代理人身分代為申請')
  })

  it('阿嬤同時符合老人津貼和身障補助：只能擇一，建議金額較高的身障補助', () => {
    const { results } = evaluate(persona('ama'))
    const senior = results.find((r) => r.id === 'senior:self')!
    const dis = results.find((r) => r.id === 'disability:self')!
    expect(dis.conflict?.chosen).toBe(true)
    expect(senior.conflict?.chosen).toBe(false)
    expect(senior.conflict?.note).toContain('只能擇一')
  })

  it('沒有身障證明的人不會出現身障補助', () => {
    expect(evaluate(persona('xiaoan')).results.some((r) => r.program === 'disability')).toBe(false)
  })

  it('身障家人讓租補適用社會弱勢加碼', () => {
    const h: Household = {
      // 年收 40 萬 → 每月 33,333 元，超過中低收入戶上限，所以只有身障的社會弱勢加碼
      people: [newPerson('self', { age: 30, married: false, income: [400000, 400000], ownsHome: false, realEstate: [0, 0], movable: [0, 50000], noWork: 'none', disability: 'severe' })],
      renting: true,
      landlordFamily: false,
      newlywed: null,
      special: 'none',
      expecting: 'none',
    }
    const rent = evaluate(h).results[0]
    // 一人、有社會弱勢身分 → 第二級 5,000；單身青年 1.2 與社會弱勢 1.2 取高 → 6,000 起
    expect(rent.amount!.min).toBe(6000)
  })
})

describe('臺北市 115 年中低收入戶標準', () => {
  it('收入上限是 29,635 元（不是最低生活費 1.5 倍的 31,116 元）', () => {
    const h: Household = {
      people: [newPerson('self', { age: 40, married: false, income: [360000, 360000], ownsHome: false, realEstate: [0, 0], movable: [0, 50000], noWork: 'none' })],
      renting: false,
      landlordFamily: null,
      newlywed: null,
      special: 'none',
      expecting: 'none',
    }
    // 36 萬 / 12 = 30,000 元：超過 29,635
    const mid = evaluate(h).results.find((r) => r.id === 'mid')!
    expect(mid.status).toBe('no')
  })
})

describe('真實訴願案 1631-039（115 年）', () => {
  it('3 人家庭平均每人每月 88,756 元，超過 71,327 元上限而不符合', () => {
    const h: Household = {
      people: [
        newPerson('self', { age: 40, married: true, income: [2000000, 2000000], ownsHome: false }),
        newPerson('spouse', { age: 38, income: [1195208, 1195208], ownsHome: false }),
        newPerson('child', { age: 6 }),
      ],
      renting: true,
      landlordFamily: false,
      newlywed: false,
      special: 'none',
      expecting: 'none',
    }
    const { rent } = byId(h)
    expect(rent.status).toBe('no')
    const income = rent.criteria.find((c) => c.id === 'income')!
    expect(income.tri).toBe('fail')
    expect(income.gap).toContain('88,756')
  })
})

describe('聰明問', () => {
  it('從空白開始，不問用不到的題目，十幾題內問完', () => {
    // 模擬小安一路回答
    const truth = persona('xiaoan')
    let h = emptyHousehold(25)
    h.people.push(...truth.people.slice(1).map((p) => ({ ...p, income: null, ownsHome: null, realEstate: null, movable: null, noWork: null, livesWith: null, sameReg: null })))
    const asked: string[] = []
    for (let i = 0; i < 30; i++) {
      const key = nextQuestion(evaluate(h), new Set())
      if (!key) break
      asked.push(key)
      getQuestion(h, key) // 每題都要有題目文字
      const [, pid, field] = key.split(':')
      let value: unknown
      if (key.startsWith('h:')) value = (truth as never)[pid]
      else {
        const src = truth.people.find((p) => p.id === pid) ?? truth.people[0]
        value = field === 'incomeExact' ? src.income![0] / 10000 : (src as never)[field]
      }
      h = applyAnswer(h, key, value)
    }
    const { rent, low, mid } = byId(h)
    expect(rent.status).toBe('likely')
    expect(low.status).toBe('no')
    expect(mid.status).toBe('no')
    expect(asked.length).toBeLessThanOrEqual(15)
    // 房東是不是家人只有在有租屋時才需要問；兄弟姊妹之類的不會被問
    expect(asked.every((k) => !k.includes('sibling'))).toBe(true)
  })

  it('一個方案確定不符合後，不再問只跟它有關的題目', () => {
    let h = emptyHousehold(30)
    h = applyAnswer(h, 'h:renting', false)
    const ev = evaluate(h)
    expect(ev.results[0].status).toBe('no')
    const key = nextQuestion(ev, new Set())
    expect(key).not.toBe('h:landlordFamily')
  })
})

describe('第一批新增補助', () => {
  const find = (h: Household, id: string) => evaluate(h).results.find((r) => r.id === id)

  it('美玲（單親、收入低於基本工資）：子女生活津貼 2 名 × 2,950 元，不算外婆', () => {
    const h = persona('meiling')
    const r = find(h, 'specialKids')!
    expect(r.status).toBe('likely')
    expect(r.amount).toMatchObject({ min: 5900, max: 5900, unit: '元/月' })
    expect(r.scope.excluded.map((m) => m.name)).toContain('媽媽')
  })

  it('美玲：緊急生活扶助一次 2～3 個月最低生活費（低收入戶還在確認，所以是區間）', () => {
    const r = find(persona('meiling'), 'specialEmergency')!
    expect(r.amount).toMatchObject({ min: 41488, max: 62232, unit: '元（一次）' })
  })

  it('沒有特殊境遇的人不符合', () => {
    expect(find(persona('xiaoan'), 'specialKids')!.status).toBe('no')
  })

  it('阿傑：老大 1 歲自己帶 → 育兒津貼第 1 名 5,000 元；太太懷第二胎 → 生育補助 4.5 萬', () => {
    const h = persona('ajie')
    const kid = h.people.find((p) => p.name === '老大')!
    expect(find(h, `childcare:${kid.id}`)).toMatchObject({ status: 'likely', amount: { min: 5000 } })
    expect(find(h, 'birth')).toMatchObject({ status: 'likely', amount: { min: 45000, unit: '元（一次）' } })
  })

  it('阿傑：胎兒算進租補家庭，老大加胎兒 2 名子女 → 第二級 5,000 × 1.6 = 8,000 元', () => {
    expect(find(persona('ajie'), 'rent300')!.amount).toMatchObject({ min: 8000, max: 8000 })
  })

  it('送公共托育就不能領育兒津貼', () => {
    const h = persona('ajie')
    const kid = h.people.find((p) => p.name === '老大')!
    kid.care = 'public'
    expect(find(h, `childcare:${kid.id}`)!.status).toBe('no')
  })

  it('阿嬤 78 歲又有身障證明：敬老卡或愛心卡擇一張，每月 600 點', () => {
    const r = find(persona('ama'), 'card:self')!
    expect(r.name).toBe('敬老卡或愛心卡（擇一張）')
    expect(r.amount).toMatchObject({ min: 600, unit: '點/月' })
  })

  it('85 歲長輩同時符合老人津貼和基本保證年金：擇一，建議金額高的老人津貼', () => {
    const h: Household = {
      people: [newPerson('self', { age: 85, married: false, income: [30000, 30000], ownsHome: false, realEstate: [0, 0], movable: [0, 50000], noWork: 'none' })],
      renting: false,
      landlordFamily: null,
      newlywed: null,
      special: 'none',
      expecting: 'none',
    }
    const { results } = evaluate(h)
    const pension = results.find((r) => r.id === 'pension:self')!
    const senior = results.find((r) => r.id === 'senior:self')!
    expect(pension.amount?.min).toBe(4049)
    expect(senior.conflict?.chosen).toBe(true)
    expect(pension.conflict?.chosen).toBe(false)
  })

  it('83 歲以下不會出現基本保證年金', () => {
    expect(evaluate(persona('ama')).results.some((r) => r.program === 'pension')).toBe(false)
  })
})
