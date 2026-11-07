import type { Household, Person, Range, Role } from './types'

const roleName: Record<Role, string> = {
  self: '你',
  spouse: '配偶',
  father: '爸爸',
  mother: '媽媽',
  child: '子女',
  grandparent: '祖父母',
  grandchild: '孫子女',
  sibling: '兄弟姊妹',
}

let seq = 0
export function newPerson(role: Role, init: Partial<Person> = {}): Person {
  seq += 1
  return {
    id: role === 'self' ? 'self' : `${role}${seq}`,
    role,
    name: roleName[role],
    age: null,
    married: null,
    sameReg: null,
    livesWith: null,
    income: null,
    ownsHome: null,
    realEstate: null,
    movable: null,
    noWork: null,
    disability: 'none',
    care: null,
    ...init,
  }
}

export function emptyHousehold(selfAge: number | null = null): Household {
  return {
    people: [newPerson('self', { age: selfAge })],
    renting: null,
    landlordFamily: null,
    newlywed: null,
    special: null,
    expecting: null,
  }
}

const x = (n: number): Range => [n, n]

export interface Persona {
  id: string
  title: string
  story: string
  household: Household
}

/** 三位示範人物：全部資料填好，用來測試與 demo 直接看結果 */
export function personas(): Persona[] {
  return [
    {
      id: 'xiaoan',
      title: '小安，25 歲租屋上班族',
      story: '戶籍還在爸媽家，爸媽有房子。成年了，可以自己申請租補嗎？',
      household: {
        people: [
          newPerson('self', { age: 25, married: false, income: x(480000), ownsHome: false, realEstate: x(0), movable: [0, 50000], noWork: 'none' }),
          newPerson('father', { age: 58, sameReg: true, livesWith: false, income: x(900000), ownsHome: true, realEstate: x(9000000), movable: [500001, 2000000], noWork: 'none' }),
          newPerson('mother', { age: 56, sameReg: true, livesWith: false, income: x(400000), ownsHome: false, realEstate: x(0), movable: [150001, 500000], noWork: 'none' }),
        ],
        renting: true,
        landlordFamily: false,
        newlywed: null,
        special: 'none',
        expecting: 'none',
      },
    },
    {
      id: 'meiling',
      title: '美玲，34 歲單親媽媽',
      story: '離婚後一個人帶兩個孩子租屋，月收入不到基本工資，小兒子有中度身障證明。媽媽住在外縣市、名下有房，也沒有給她生活費。',
      household: {
        people: [
          newPerson('self', { age: 34, married: false, income: x(330000), ownsHome: false, realEstate: x(0), movable: [0, 50000], noWork: 'none' }),
          newPerson('child', { name: '大女兒', age: 8 }),
          newPerson('child', { name: '小兒子', age: 5, disability: 'moderate' }),
          newPerson('mother', { age: 62, sameReg: false, livesWith: false, income: x(600000), ownsHome: true, realEstate: x(9000000), movable: [50001, 150000], noWork: 'none' }),
        ],
        renting: true,
        landlordFamily: false,
        newlywed: null,
        special: 'singleParent',
        expecting: 'none',
      },
    },
    {
      id: 'ama',
      title: '阿嬌阿嬤，78 歲獨居',
      story: '住在自己的老公寓，靠年金過日子，有中度身障證明。兒子結婚後住新北，很少拿錢回家。',
      household: {
        people: [
          newPerson('self', { name: '你', age: 78, married: false, income: x(50000), ownsHome: true, realEstate: x(4000000), movable: [50001, 150000], noWork: 'none', disability: 'moderate' }),
          newPerson('child', { name: '兒子', age: 50, married: true, sameReg: false, livesWith: false, income: x(1200000), ownsHome: true, realEstate: x(6000000), movable: [500001, 2000000], noWork: 'none' }),
        ],
        renting: false,
        landlordFamily: null,
        newlywed: null,
        special: 'none',
        expecting: 'none',
      },
    },
    {
      id: 'zhiming',
      title: '志明，45 歲，替 72 歲的爸爸試算',
      story: '跟爸媽同住。想知道爸爸能不能領老人津貼，卻不知道自己的薪水和已婚妹妹也會被算進去。',
      household: {
        people: [
          newPerson('self', { age: 45, married: false, income: x(1100000), ownsHome: false, realEstate: x(0), movable: [50001, 150000], noWork: 'none' }),
          newPerson('father', { age: 72, sameReg: true, livesWith: true, income: x(60000), ownsHome: true, realEstate: x(6500000), movable: [50001, 150000], noWork: 'none' }),
          newPerson('mother', { age: 70, sameReg: true, livesWith: true, income: x(0), ownsHome: false, realEstate: x(0), movable: [0, 50000], noWork: 'none' }),
          newPerson('sibling', { name: '妹妹', age: 40, married: true, sameReg: false, livesWith: false, income: x(1200000), ownsHome: false, realEstate: x(0), movable: [500001, 2000000], noWork: 'none' }),
        ],
        renting: false,
        landlordFamily: null,
        newlywed: null,
        special: 'none',
        expecting: 'none',
      },
    },
    {
      id: 'ajie',
      title: '阿傑，31 歲，太太懷第二胎',
      story: '一家三口租屋，老大 1 歲在家自己帶，太太懷孕中。想知道生小孩、養小孩有哪些補助。',
      household: {
        people: [
          newPerson('self', { age: 31, married: true, income: x(650000), ownsHome: false, realEstate: x(0), movable: [150001, 500000], noWork: 'none' }),
          newPerson('spouse', { name: '太太', age: 30, income: x(500000), ownsHome: false, realEstate: x(0), movable: [50001, 150000], noWork: 'pregnant' }),
          newPerson('child', { name: '老大', age: 1, care: 'home' }),
        ],
        renting: true,
        landlordFamily: false,
        newlywed: false,
        special: 'none',
        expecting: 'pregnant',
      },
    },
  ]
}
